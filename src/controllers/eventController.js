const crypto = require('crypto');
const slugify = require('slugify');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Invitation = require('../models/Invitation');
const EventAccessToken = require('../models/EventAccessToken');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');
const env = require('../config/env');

async function buildUniquePortalSlug(source, excludeId) {
  const base = slugify(source || 'evento', { lower: true, strict: true }) || 'evento';
  let slug = base;
  let counter = 1;
  const query = () => ({ externalPortalSlug: slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
  while (await Event.exists(query())) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

function normalizeExternalPortalSettings(settings = {}) {
  return {
    rsvpEnabled: settings.rsvpEnabled !== false,
    albumEnabled: settings.albumEnabled !== false,
    passEnabled: settings.passEnabled !== false,
    calendarEnabled: settings.calendarEnabled !== false,
    showLocation: settings.showLocation !== false,
    brandLabel: settings.brandLabel,
    welcomeMessage: settings.welcomeMessage
  };
}

async function ensureExternalPortalPayload(payload, currentEvent) {
  if (payload.mode !== 'external_dashboard' && currentEvent?.mode !== 'external_dashboard') return payload;
  const next = { ...payload };
  if (!next.externalPortalSlug && !currentEvent?.externalPortalSlug) {
    next.externalPortalSlug = await buildUniquePortalSlug(next.title || currentEvent?.title, currentEvent?._id);
  }
  if (next.externalPortalSettings || !currentEvent?.externalPortalSettings) {
    next.externalPortalSettings = normalizeExternalPortalSettings(next.externalPortalSettings);
  }
  return next;
}

function publicGuest(guest) {
  return {
    id: guest._id,
    name: guest.name,
    email: guest.email,
    allowedCompanions: guest.allowedCompanions,
    status: guest.status,
    communicationStatus: guest.communicationStatus,
    checkInCode: guest.checkInCode,
    qrCode: guest.qrCode,
    tableName: guest.tableName,
    seatLabel: guest.seatLabel,
    companions: guest.companions || []
  };
}

function publicExternalEvent(event) {
  return {
    id: event._id,
    mode: event.mode,
    type: event.type,
    title: event.title,
    hosts: event.hosts,
    date: event.date,
    venue: event.venue,
    agenda: event.agenda,
    externalSiteUrl: event.externalSiteUrl,
    externalSiteLabel: event.externalSiteLabel,
    externalPortalSlug: event.externalPortalSlug,
    externalPortalEnabled: event.externalPortalEnabled,
    externalPortalSettings: normalizeExternalPortalSettings(event.externalPortalSettings || {})
  };
}

exports.list = asyncHandler(async (req, res) => {
  const events = await Event.find({ owner: req.user._id }).sort('-createdAt');
  res.json({ events });
});

exports.create = asyncHandler(async (req, res) => {
  const payload = await ensureExternalPortalPayload(req.validated.body);
  const event = await Event.create({ ...payload, owner: req.user._id });
  res.status(201).json({ event });
});

exports.get = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, owner: req.user._id });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  res.json({ event });
});

exports.update = asyncHandler(async (req, res) => {
  const current = await Event.findOne({ _id: req.params.id, owner: req.user._id });
  if (!current) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const payload = await ensureExternalPortalPayload(req.validated.body, current);
  const event = await Event.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, payload, { new: true });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  res.json({ event });
});

exports.publicByPortalSlug = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    externalPortalSlug: req.params.portalSlug,
    mode: 'external_dashboard',
    externalPortalEnabled: { $ne: false }
  });
  if (!event) {
    const error = new Error('Portal no disponible');
    error.statusCode = 404;
    throw error;
  }
  res.json({ event: publicExternalEvent(event) });
});

exports.publicGuestAccess = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    externalPortalSlug: req.params.portalSlug,
    mode: 'external_dashboard',
    externalPortalEnabled: { $ne: false }
  }).select('_id');
  if (!event) {
    const error = new Error('Portal no disponible');
    error.statusCode = 404;
    throw error;
  }
  const guest = await Guest.findOne({
    event: event._id,
    email: req.validated.body.email.toLowerCase().trim()
  }).select('name email allowedCompanions status communicationStatus checkInCode qrCode tableName seatLabel companions invitationToken');
  if (!guest) {
    const error = new Error('Este correo no esta en la lista de invitados');
    error.statusCode = 403;
    throw error;
  }
  res.json({ guest: publicGuest(guest) });
});

exports.publicGuestByToken = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    externalPortalSlug: req.params.portalSlug,
    mode: 'external_dashboard',
    externalPortalEnabled: { $ne: false }
  }).select('_id');
  if (!event) {
    const error = new Error('Portal no disponible');
    error.statusCode = 404;
    throw error;
  }
  const guest = await Guest.findOne({
    event: event._id,
    invitationToken: String(req.params.token || '').trim()
  }).select('name email allowedCompanions status communicationStatus checkInCode qrCode tableName seatLabel companions invitationOpenedAt');
  if (!guest) {
    const error = new Error('Link personalizado invalido');
    error.statusCode = 404;
    throw error;
  }
  guest.invitationOpenedAt = guest.invitationOpenedAt || new Date();
  if (guest.communicationStatus === 'sent') guest.communicationStatus = 'opened';
  await guest.save();
  res.json({ guest: publicGuest(guest) });
});

exports.listAccessLinks = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const links = await EventAccessToken.find({ owner: req.user._id, event: event._id }).sort('-createdAt');
  res.json({ links: links.map((link) => ({
    id: link._id,
    role: link.role,
    label: link.label,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
    lastUsedAt: link.lastUsedAt,
    createdAt: link.createdAt,
    url: `${env.clientUrl}/external-access/${link.token}`
  })) });
});

exports.createAccessLink = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const days = Number(req.validated.body.days || 7);
  const access = await EventAccessToken.create({
    owner: req.user._id,
    event: event._id,
    token: crypto.randomBytes(24).toString('hex'),
    role: req.validated.body.role,
    label: req.validated.body.label,
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  });
  res.status(201).json({
    link: {
      id: access._id,
      role: access.role,
      label: access.label,
      expiresAt: access.expiresAt,
      url: `${env.clientUrl}/external-access/${access.token}`
    }
  });
});

exports.revokeAccessLink = asyncHandler(async (req, res) => {
  const link = await EventAccessToken.findOneAndUpdate(
    { _id: req.params.linkId, event: req.params.eventId, owner: req.user._id },
    { revokedAt: new Date() },
    { new: true }
  );
  if (!link) {
    const error = new Error('Link no encontrado');
    error.statusCode = 404;
    throw error;
  }
  res.json({ message: 'Link revocado' });
});

async function primaryInvitationForEvent(eventId, owner) {
  const published = await Invitation.findOne({ event: eventId, owner, status: 'published' }).sort('-publishedAt');
  if (published) return published;
  return Invitation.findOne({ event: eventId, owner }).sort('-createdAt');
}

function personalizedPublicUrl(invitation, guest) {
  const baseUrl = `${env.publicBaseUrl}/i/${invitation.slug}`;
  return guest.invitationToken ? `${baseUrl}?t=${encodeURIComponent(guest.invitationToken)}` : baseUrl;
}

function markEmailResult(guest, { type, status, error }) {
  guest.lastMessageType = type;
  guest.lastMessageChannel = 'email';
  if (status === 'sent') {
    guest.communicationStatus = 'sent';
    guest.lastMessageSentAt = new Date();
    guest.lastMessageError = undefined;
  } else {
    guest.communicationStatus = 'failed';
    guest.lastMessageError = String(error || 'No se pudo enviar el correo').slice(0, 240);
  }
}

exports.sendEmailBulk = asyncHandler(async (req, res) => {
  if (!req.validated.body.confirm) {
    const error = new Error('Confirma el envio masivo antes de continuar');
    error.statusCode = 400;
    throw error;
  }
  if (!emailService.isEmailConfigured()) {
    const error = new Error('SMTP no configurado');
    error.statusCode = 501;
    throw error;
  }
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const invitation = await primaryInvitationForEvent(event._id, req.user._id);
  if (!invitation) {
    const error = new Error('Crea una invitacion antes de enviar email');
    error.statusCode = 400;
    throw error;
  }

  const query = { owner: req.user._id, event: event._id, email: { $exists: true, $ne: '' } };
  if (req.validated.body.guestIds?.length) query._id = { $in: req.validated.body.guestIds };
  const guests = await Guest.find(query).sort('name').limit(200);
  const type = req.validated.body.messageType || 'invitation';
  const results = [];

  for (const guest of guests) {
    try {
      await emailService.sendGuestInvitationEmail({
        to: guest.email,
        guest,
        event,
        invitation,
        publicUrl: personalizedPublicUrl(invitation, guest),
        type
      });
      markEmailResult(guest, { type, status: 'sent' });
      await guest.save();
      results.push({ guest: guest._id, status: 'sent' });
    } catch (error) {
      markEmailResult(guest, { type, status: 'failed', error: error.message });
      await guest.save();
      results.push({ guest: guest._id, status: 'failed', error: error.message });
    }
  }

  res.json({
    requested: guests.length,
    sent: results.filter((item) => item.status === 'sent').length,
    skipped: 0,
    failed: results.filter((item) => item.status === 'failed').length,
    results
  });
});
