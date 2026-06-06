const slugify = require('slugify');
const Invitation = require('../models/Invitation');
const Event = require('../models/Event');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

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
  res.json({ invitation, publicUrl: `${env.publicBaseUrl}/i/${invitation.slug}` });
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
