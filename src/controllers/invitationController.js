const slugify = require('slugify');
const Invitation = require('../models/Invitation');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const emailService = require('../services/emailService');

async function buildUniqueSlug(source) {
  const base = slugify(source || 'invitacion', { lower: true, strict: true });
  let slug = base;
  let counter = 1;
  while (await Invitation.exists({ slug })) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

exports.list = asyncHandler(async (req, res) => {
  const invitations = await Invitation.find({ owner: req.user._id }).populate('event template').sort('-createdAt');
  res.json({ invitations });
});

exports.create = asyncHandler(async (req, res) => {
  const payload = req.validated.body;
  const event = await Event.findOne({ _id: payload.event, owner: req.user._id });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const slug = await buildUniqueSlug(payload.slug || event.title);
  const invitation = await Invitation.create({ ...payload, owner: req.user._id, slug });
  res.status(201).json({ invitation, publicUrl: `${env.publicBaseUrl}/i/${invitation.slug}` });
});

exports.update = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, req.validated.body, { new: true });
  if (!invitation) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ invitation });
});

exports.publish = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    { status: 'published', publishedAt: new Date() },
    { new: true }
  );
  if (!invitation) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }
  const publicUrl = `${env.publicBaseUrl}/i/${invitation.slug}`;
  if (req.user.email) {
    try {
      await emailService.sendInvitationPublishedEmail({ to: req.user.email, invitation, publicUrl });
    } catch (error) {
      console.warn('Invitation published email failed:', error.message);
    }
  }
  res.json({ invitation, publicUrl });
});

exports.unpublish = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, { status: 'unpublished' }, { new: true });
  if (!invitation) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ invitation });
});

exports.publicBySlug = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).populate('event template');
  if (!invitation) {
    const error = new Error('Invitacion no encontrada o no publicada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ invitation });
});

exports.guestAccess = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).select('event');
  if (!invitation) {
    const error = new Error('Invitacion no disponible');
    error.statusCode = 404;
    throw error;
  }

  const guest = await Guest.findOne({
    event: invitation.event,
    email: req.validated.body.email.toLowerCase().trim()
  }).select('name email allowedCompanions status');

  if (!guest) {
    const error = new Error('Este correo no esta en la lista de invitados');
    error.statusCode = 403;
    throw error;
  }

  res.json({
    guest: {
      id: guest._id,
      name: guest.name,
      email: guest.email,
      allowedCompanions: guest.allowedCompanions,
      status: guest.status
    }
  });
});
