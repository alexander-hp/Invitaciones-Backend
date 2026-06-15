const slugify = require('slugify');
const Invitation = require('../models/Invitation');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Template = require('../models/Template');
const { getEffectivePlanLimits } = require('../config/plans');
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

function publicEvent(event) {
  if (!event || typeof event === 'string') return event;
  return {
    id: event._id,
    type: event.type,
    title: event.title,
    hosts: event.hosts,
    date: event.date,
    venue: event.venue,
    agenda: event.agenda
  };
}

function publicTemplate(template) {
  if (!template || typeof template === 'string') return template;
  return {
    id: template._id,
    name: template.name,
    eventType: template.eventType,
    tier: template.tier,
    previewImageUrl: template.previewImageUrl,
    config: template.config
  };
}

function publicInvitation(invitation) {
  const content = invitation.content?.toObject ? invitation.content.toObject() : { ...(invitation.content || {}) };
  delete content.privateAlbum;
  content.giftRegistry = (content.giftRegistry || []).sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
  content.giftSettings = content.giftSettings || { enabled: true, showRegistry: true, showEnvelope: true };
  content.dedicationSettings = content.dedicationSettings || { enabled: true, requireApproval: true };
  return {
    id: invitation._id,
    slug: invitation.slug,
    status: invitation.status,
    accessMode: invitation.accessMode,
    rsvpSettings: invitation.rsvpSettings,
    content,
    publishedAt: invitation.publishedAt,
    event: publicEvent(invitation.event),
    template: publicTemplate(invitation.template)
  };
}

function publicGuest(guest) {
  return {
    id: guest._id,
    name: guest.name,
    email: guest.email,
    allowedCompanions: guest.allowedCompanions,
    status: guest.status,
    checkInCode: guest.checkInCode,
    qrCode: guest.qrCode,
    tableName: guest.tableName,
    seatLabel: guest.seatLabel,
    companions: guest.companions || []
  };
}

async function assertInvitationPlanLimits(user, event, payload) {
  const limits = getEffectivePlanLimits(user, event);
  const galleryCount = payload.content?.gallery?.length || 0;
  if (galleryCount > limits.galleryImages) {
    const error = new Error(`Tu plan permite hasta ${limits.galleryImages} imagenes de galeria`);
    error.statusCode = 402;
    throw error;
  }
  if (payload.content?.musicUrl && !limits.music) {
    const error = new Error('La musica requiere Evento Individual o Pro');
    error.statusCode = 402;
    throw error;
  }
  if (payload.content?.hideBranding && !limits.whiteLabel) {
    const error = new Error('Ocultar la marca KyndraSoft requiere plan Pro');
    error.statusCode = 402;
    throw error;
  }
  if (payload.template) {
    const template = await Template.findById(payload.template).select('tier');
    if (template?.tier === 'premium' && !limits.premiumTemplates) {
      const error = new Error('Las plantillas premium requieren Evento Individual o Pro');
      error.statusCode = 402;
      throw error;
    }
  }
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
  await assertInvitationPlanLimits(req.user, event, payload);
  const slug = await buildUniqueSlug(payload.slug || event.title);
  const invitation = await Invitation.create({ ...payload, owner: req.user._id, slug });
  res.status(201).json({ invitation, publicUrl: `${env.publicBaseUrl}/i/${invitation.slug}` });
});

exports.update = asyncHandler(async (req, res) => {
  const currentInvitation = await Invitation.findOne({ _id: req.params.id, owner: req.user._id }).select('_id event');
  if (!currentInvitation) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }
  const event = await Event.findOne({ _id: currentInvitation.event, owner: req.user._id }).select('_id plan');
  await assertInvitationPlanLimits(req.user, event, req.validated.body);
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
  res.json({ invitation: publicInvitation(invitation) });
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
  }).select('name email allowedCompanions status checkInCode qrCode tableName seatLabel companions');

  if (!guest) {
    const error = new Error('Este correo no esta en la lista de invitados');
    error.statusCode = 403;
    throw error;
  }

  res.json({ guest: publicGuest(guest) });
});

exports.guestByToken = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).select('event');
  if (!invitation) {
    const error = new Error('Invitacion no disponible');
    error.statusCode = 404;
    throw error;
  }

  const guest = await Guest.findOne({
    event: invitation.event,
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
