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

function isEnabled() {
  return activeProvider() !== 'disabled';
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
  const response = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(env.openWaSessionId)}/messages/send-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': env.openWaApiKey
    },
    body: JSON.stringify({ chatId, text })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || 'OpenWA rechazo el mensaje');
    error.statusCode = response.status;
    error.providerResponse = data;
    throw error;
  }
  return data;
}

async function sendMessage({ owner, guest, event, invitation, type = 'invitation', text }) {
  const provider = activeProvider();
  const phone = normalizePhone(guest.phone);
  const finalText = buildText({ guest, event, invitation, type, text });
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
    const payload = provider === 'meta'
      ? buildMetaTemplatePayload({ phone, type, guest, event, invitation })
      : { phone, text: finalText };
    const providerResponse = provider === 'meta' ? await sendMeta(payload) : await sendOpenWa(payload);
    const messageId = providerResponse?.messages?.[0]?.id || providerResponse?.id || providerResponse?.messageId;
    log.payload = provider === 'meta' ? { templateName, to: phone } : { chatId: `${phone}@c.us` };
    log.providerResponse = providerResponse;
    log.messageId = messageId;
    log.status = 'sent';
    log.sentAt = new Date();
    await log.save();
    return { log, provider, status: 'sent', messageId };
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
  isEnabled,
  normalizePhone,
  publicInvitationUrl,
  buildText,
  buildMetaTemplatePayload,
  sendMessage,
  updateMessageStatus,
  verifyMetaSignature
};
