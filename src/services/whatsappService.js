const crypto = require('crypto');
const env = require('../config/env');
const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');

const TEMPLATE_BY_TYPE = {
  invitation: 'invitation_link',
  reminder: 'rsvp_reminder',
  event_reminder: 'event_reminder',
  location_change: 'event_reminder',
  thanks: 'thank_you'
};

function activeProvider() {
  return ['meta', 'openwa'].includes(env.whatsappProvider) ? env.whatsappProvider : 'disabled';
}

function fallbackProvider() {
  const fallback = env.whatsappFallbackProvider;
  const active = activeProvider();
  return ['meta', 'openwa'].includes(fallback) && fallback !== active ? fallback : '';
}

function isMetaConfigured() {
  return Boolean(env.whatsappPhoneNumberId && env.whatsappAccessToken);
}

function isOpenWaConfigured() {
  return Boolean(env.openWaBaseUrl && env.openWaApiKey && env.openWaSessionId);
}

function isEnabled() {
  return activeProvider() !== 'disabled';
}

function isFallbackEnabled() {
  const fallback = fallbackProvider();
  if (fallback === 'meta') return isMetaConfigured();
  if (fallback === 'openwa') return isOpenWaConfigured();
  return false;
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `52${digits}` : digits;
}

function publicInvitationUrl(invitation, guest) {
  if (!invitation?.slug) return env.publicBaseUrl;
  const token = guest?.invitationToken ? `?t=${encodeURIComponent(guest.invitationToken)}` : '';
  return `${env.publicBaseUrl}/i/${invitation.slug}${token}`;
}

function eventDateText(event) {
  return event?.date ? new Date(event.date).toLocaleDateString('es-MX') : '';
}

function eventLocationText(event) {
  return [event?.venue?.name, event?.venue?.address].filter(Boolean).join(' - ');
}

function buildText({ guest, event, invitation, type, text }) {
  if (text) return text;
  const title = event?.title || invitation?.content?.headline || 'nuestro evento';
  const date = eventDateText(event);
  const location = eventLocationText(event);
  const link = publicInvitationUrl(invitation, guest);

  if (type === 'reminder') {
    return [
      `Hola ${guest.name}, te recordamos confirmar tu asistencia a ${title}.`,
      date ? `Fecha: ${date}` : '',
      link,
      'Tu confirmacion nos ayuda a organizar mejor el evento.'
    ].filter(Boolean).join('\n\n');
  }

  if (type === 'event_reminder' || type === 'location_change') {
    return [
      `Hola ${guest.name}, te compartimos un recordatorio para ${title}.`,
      date ? `Fecha: ${date}` : '',
      location ? `Lugar: ${location}` : '',
      link
    ].filter(Boolean).join('\n\n');
  }

  if (type === 'thanks') {
    return [
      `Hola ${guest.name}, gracias por confirmar tu asistencia a ${title}.`,
      date ? `Nos vemos el ${date}.` : '',
      location ? `Lugar: ${location}` : '',
      'Nos encantara verte ahi.'
    ].filter(Boolean).join('\n\n');
  }

  return [
    `Hola ${guest.name}, te comparto tu invitacion digital para ${title}.`,
    date ? `Fecha: ${date}` : '',
    location ? `Lugar: ${location}` : '',
    link,
    'Por favor confirma tu asistencia desde el enlace.'
  ].filter(Boolean).join('\n\n');
}

function buildMetaTemplatePayload({ phone, type, guest, event, invitation }) {
  const templateName = TEMPLATE_BY_TYPE[type] || TEMPLATE_BY_TYPE.invitation;
  const link = publicInvitationUrl(invitation, guest);
  const components = [{
    type: 'body',
    parameters: [
      { type: 'text', text: guest.name },
      { type: 'text', text: event?.title || invitation?.content?.headline || 'nuestro evento' },
      { type: 'text', text: eventDateText(event) || 'fecha por confirmar' },
      { type: 'text', text: link }
    ]
  }];

  return {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'es_MX' },
      components
    }
  };
}

async function sendMeta(payload) {
  if (!env.whatsappPhoneNumberId || !env.whatsappAccessToken) {
    const error = new Error('Meta WhatsApp Cloud API no configurada');
    error.statusCode = 501;
    throw error;
  }
  const url = `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.whatsappAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Meta WhatsApp rechazo el mensaje');
    error.statusCode = response.status;
    error.providerResponse = data;
    throw error;
  }
  return data;
}

async function sendOpenWa({ phone, text }) {
  if (!env.openWaBaseUrl || !env.openWaApiKey || !env.openWaSessionId) {
    const error = new Error('OpenWA no configurado');
    error.statusCode = 501;
    throw error;
  }
  const baseUrl = env.openWaBaseUrl.replace(/\/$/, '');
  const chatId = `${phone}@c.us`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.whatsappOpenWaTimeoutMs);
  const response = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(env.openWaSessionId)}/messages/send-text`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': env.openWaApiKey
    },
    body: JSON.stringify({ chatId, text })
  }).finally(() => clearTimeout(timeout));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || 'OpenWA rechazo el mensaje');
    error.statusCode = response.status;
    error.providerResponse = data;
    throw error;
  }
  return data;
}

function openWaMediaEndpoint(mediaType) {
  return {
    image: 'send-image',
    video: 'send-video',
    audio: 'send-audio',
    document: 'send-document'
  }[mediaType];
}

async function sendOpenWaMedia({ phone, media }) {
  if (!env.openWaBaseUrl || !env.openWaApiKey || !env.openWaSessionId) {
    const error = new Error('OpenWA no configurado');
    error.statusCode = 501;
    throw error;
  }
  const endpoint = openWaMediaEndpoint(media?.type);
  if (!endpoint) {
    const error = new Error('Tipo de media WhatsApp no soportado');
    error.statusCode = 400;
    throw error;
  }
  const baseUrl = env.openWaBaseUrl.replace(/\/$/, '');
  const chatId = `${phone}@c.us`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.whatsappOpenWaTimeoutMs);
  const response = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(env.openWaSessionId)}/messages/${endpoint}`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': env.openWaApiKey
    },
    body: JSON.stringify({
      chatId,
      url: media.url,
      base64: media.base64,
      mimetype: media.mimetype,
      filename: media.filename,
      caption: media.caption
    })
  }).finally(() => clearTimeout(timeout));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || 'OpenWA rechazo el archivo');
    error.statusCode = response.status;
    error.providerResponse = data;
    throw error;
  }
  return data;
}

function shouldFallbackFromOpenWa(error, normalizedMedia) {
  if (activeProvider() !== 'openwa' || fallbackProvider() !== 'meta' || !isFallbackEnabled()) return false;
  if (normalizedMedia) return false;
  if (error.name === 'AbortError') return true;
  if (!error.statusCode) return true;
  return error.statusCode === 501 || error.statusCode >= 500;
}

async function sendViaProvider(provider, { phone, type, guest, event, invitation, text, normalizedMedia }) {
  if (provider === 'meta') {
    if (normalizedMedia) {
      const error = new Error('Media por Meta requiere plantillas/media aprobada; usa OpenWA o configura template oficial');
      error.statusCode = 501;
      throw error;
    }
    const payload = buildMetaTemplatePayload({ phone, type, guest, event, invitation });
    return {
      payload: { templateName: TEMPLATE_BY_TYPE[type] || TEMPLATE_BY_TYPE.invitation, to: phone },
      providerResponse: await sendMeta(payload)
    };
  }

  const payload = normalizedMedia ? { phone, media: normalizedMedia } : { phone, text };
  return {
    payload: { chatId: `${phone}@c.us`, media: normalizedMedia ? { type: normalizedMedia.type, url: normalizedMedia.url, filename: normalizedMedia.filename } : undefined },
    providerResponse: normalizedMedia ? await sendOpenWaMedia(payload) : await sendOpenWa(payload)
  };
}

function normalizeMedia(media, fallbackCaption) {
  if (!media) return undefined;
  const normalized = {
    type: media.type,
    url: media.url ? String(media.url).trim() : undefined,
    base64: media.base64 ? String(media.base64).trim() : undefined,
    mimetype: media.mimetype ? String(media.mimetype).trim() : undefined,
    filename: media.filename ? String(media.filename).trim() : undefined,
    caption: media.caption ? String(media.caption).trim() : fallbackCaption
  };
  if (!normalized.url && !normalized.base64) {
    const error = new Error('El archivo WhatsApp requiere url o base64');
    error.statusCode = 400;
    throw error;
  }
  if (normalized.base64 && !normalized.mimetype) {
    const error = new Error('El archivo WhatsApp en base64 requiere mimetype');
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

async function sendMessage({ owner, guest, event, invitation, type = 'invitation', text, media }) {
  const provider = activeProvider();
  const phone = normalizePhone(guest.phone);
  const finalText = buildText({ guest, event, invitation, type, text });
  const normalizedMedia = normalizeMedia(media, finalText);
  const templateName = provider === 'meta' ? (TEMPLATE_BY_TYPE[type] || TEMPLATE_BY_TYPE.invitation) : undefined;
  const log = await WhatsAppMessageLog.create({
    owner,
    event: event?._id || event,
    invitation: invitation?._id || invitation,
    guest: guest?._id || guest,
    provider,
    type,
    phone,
    textPreview: finalText.slice(0, 500),
    templateName,
    payload: normalizedMedia ? { media: { type: normalizedMedia.type, url: normalizedMedia.url, filename: normalizedMedia.filename } } : undefined,
    status: provider === 'disabled' ? 'skipped' : 'pending'
  });

  if (!phone) {
    log.status = 'failed';
    log.error = 'Invitado sin telefono';
    log.failedAt = new Date();
    await log.save();
    return { log, provider, status: log.status, manualText: finalText };
  }

  if (provider === 'disabled') {
    return { log, provider, status: 'skipped', manualText: finalText };
  }

  try {
    let finalProvider = provider;
    let sendResult;
    try {
      sendResult = await sendViaProvider(provider, { phone, type, guest, event, invitation, text: finalText, normalizedMedia });
    } catch (error) {
      if (!shouldFallbackFromOpenWa(error, normalizedMedia)) throw error;
      log.fallbackFrom = 'openwa';
      log.fallbackError = error.message;
      finalProvider = 'meta';
      sendResult = await sendViaProvider('meta', { phone, type, guest, event, invitation, text: finalText, normalizedMedia });
    }
    const providerResponse = sendResult.providerResponse;
    const messageId = providerResponse?.messages?.[0]?.id
      || providerResponse?.data?.messageId
      || providerResponse?.data?.id
      || providerResponse?.id
      || providerResponse?.messageId;
    log.provider = finalProvider;
    log.templateName = finalProvider === 'meta' ? (TEMPLATE_BY_TYPE[type] || TEMPLATE_BY_TYPE.invitation) : undefined;
    log.payload = sendResult.payload;
    log.providerResponse = providerResponse;
    log.messageId = messageId;
    log.status = 'sent';
    log.sentAt = new Date();
    await log.save();
    return { log, provider: finalProvider, status: 'sent', messageId };
  } catch (error) {
    log.status = 'failed';
    log.error = error.message;
    log.providerResponse = error.providerResponse;
    log.failedAt = new Date();
    await log.save();
    throw error;
  }
}

async function updateMessageStatus({ provider, messageId, status, payload }) {
  if (!messageId) return null;
  const allowedStatus = ['sent', 'delivered', 'read', 'failed'].includes(status) ? status : 'sent';
  const update = {
    status: allowedStatus,
    providerResponse: payload
  };
  if (allowedStatus === 'delivered') update.deliveredAt = new Date();
  if (allowedStatus === 'read') update.readAt = new Date();
  if (allowedStatus === 'failed') update.failedAt = new Date();
  return WhatsAppMessageLog.findOneAndUpdate({ provider, messageId }, update, { new: true });
}

function verifyMetaSignature(req) {
  if (!env.whatsappAppSecret) return true;
  const signature = req.get('x-hub-signature-256');
  if (!signature || !req.rawBody) return false;
  const expected = `sha256=${crypto.createHmac('sha256', env.whatsappAppSecret).update(req.rawBody).digest('hex')}`;
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

module.exports = {
  activeProvider,
  fallbackProvider,
  isEnabled,
  isFallbackEnabled,
  isMetaConfigured,
  isOpenWaConfigured,
  normalizePhone,
  publicInvitationUrl,
  buildText,
  buildMetaTemplatePayload,
  sendMessage,
  updateMessageStatus,
  verifyMetaSignature
};
