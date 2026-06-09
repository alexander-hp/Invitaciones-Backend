const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Invitation = require('../models/Invitation');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');
const env = require('../config/env');

exports.list = asyncHandler(async (req, res) => {
  const events = await Event.find({ owner: req.user._id }).sort('-createdAt');
  res.json({ events });
});

exports.create = asyncHandler(async (req, res) => {
  const event = await Event.create({ ...req.validated.body, owner: req.user._id });
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
  const event = await Event.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, req.validated.body, { new: true });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  res.json({ event });
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
