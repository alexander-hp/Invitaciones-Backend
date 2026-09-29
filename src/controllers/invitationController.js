const CustomTemplateSubmission = require('../models/CustomTemplateSubmission');
const crypto = require('crypto');
const slugify = require('slugify');
const Invitation = require('../models/Invitation');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Template = require('../models/Template');
const AlbumAsset = require('../models/AlbumAsset');
const Dedication = require('../models/Dedication');
const Rsvp = require('../models/Rsvp');
const SongRequest = require('../models/SongRequest');
const { getEffectivePlanLimits } = require('../config/plans');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const emailService = require('../services/emailService');
const whatsappService = require('../services/whatsappService');
const { logEventActivity } = require('../services/eventLogService');
const { requireEventAccess } = require('../utils/eventAccess');
const VisualDesignRevision = require('../models/VisualDesignRevision');
const { signGuestSession, verifyGuestSessionForEvent } = require('../utils/guestSession');

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
    time: event.time,
    venue: event.venue,
    agenda: event.agenda
  };
}

function getDefaultItineraryTitle(eventType) {
  switch (eventType) {
    case 'boda': return 'Ceremonia / Recepción';
    case 'xv': return 'Recepción de XV Años';
    case 'graduacion': return 'Recepción de Graduación';
    case 'bautizo': return 'Ceremonia / Recepción';
    case 'cumpleanos': return 'Festejo y Recepción';
    default: return 'Recepción';
  }
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
  const content = invitation.content?.toObject ? invitation.content.toObject({ flattenMaps: true }) : { ...(invitation.content || {}) };
  delete content.privateAlbum;
  content.storyTitle = content.storyTitle || content.subheadline || '';
  content.storyBody = content.storyBody || content.message || '';
  content.subheadline = content.subheadline || content.storyTitle || '';
  content.message = content.message || content.storyBody || '';
  if (content.sectionMusic && content.sectionMusic instanceof Map) {
    content.sectionMusic = Object.fromEntries(content.sectionMusic);
  } else {
    content.sectionMusic = content.sectionMusic || {};
  }
  if (content.sectionMusicCues && content.sectionMusicCues instanceof Map) {
    content.sectionMusicCues = Object.fromEntries(content.sectionMusicCues);
  } else {
    content.sectionMusicCues = content.sectionMusicCues || {};
  }
  content.musicSettings = {
    playbackMode: 'first_interaction', sectionChangeMode: 'automatic', loop: true,
    volume: 0.7, startSeconds: 0, ...(content.musicSettings || {})
  };
  const storedGalleryItems = Array.isArray(content.galleryItems) ? content.galleryItems : [];
  const galleryUrls = (Array.isArray(content.gallery) && content.gallery.length
    ? content.gallery
    : storedGalleryItems.map((item) => item?.url))
    .filter(Boolean);
  content.galleryItems = galleryUrls.map((url, index) => {
    const saved = storedGalleryItems.find((item) => item?.url === url) || {};
    return {
      id: saved.id || `gallery-${index + 1}`,
      url,
      featured: Boolean(saved.featured),
      title: saved.title || '',
      description: saved.description || '',
      dedication: saved.dedication || '',
      alt: saved.alt || saved.title || 'Fotografía del evento',
      fit: saved.fit || 'cover',
      focalX: Number.isFinite(saved.focalX) ? saved.focalX : 50,
      focalY: Number.isFinite(saved.focalY) ? saved.focalY : 50
    };
  });
  content.gallery = galleryUrls;
  content.gallerySettings = {
    displayMode: 'grid', showCaptions: true, autoplay: false, intervalSeconds: 5,
    ...(content.gallerySettings || {})
  };
  content.locations = (content.locations || []).sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
  content.lodging = (content.lodging || [])
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))
    .map((item) => ({ ...item, services: (item.services || []).filter(Boolean) }));
  content.giftRegistry = (content.giftRegistry || []).sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
  content.giftSettings = content.giftSettings || { enabled: true, showRegistry: true, showEnvelope: true };
  content.dedicationSettings = content.dedicationSettings || { enabled: true, requireApproval: true };
  const eventSongSettings = (invitation.event && typeof invitation.event === 'object') ? invitation.event.externalContent?.songRequestSettings : undefined;
  content.songRequestSettings = eventSongSettings || content.songRequestSettings || { enabled: true, maxRequestsPerGuest: 3, allowDedications: true, requireApproval: true };
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
    group: guest.group,
    roles: guest.roles || [],
    tags: guest.tags || [],
    relationshipLabel: guest.relationshipLabel,
    visibilityGroup: guest.visibilityGroup,
    allowedCompanions: guest.allowedCompanions,
    status: guest.status,
    checkInCode: guest.checkInCode,
    qrCode: guest.qrCode,
    tableName: guest.tableName,
    seatLabel: guest.seatLabel,
    companions: guest.companions || []
  };
}

function publicGuestActivity({ guest, rsvp, albumUploads, songRequests, dedications }) {
  return {
    guest: publicGuest(guest),
    rsvp: rsvp ? {
      id: rsvp._id, response: rsvp.response, companions: rsvp.companions,
      companionNames: rsvp.companionNames || [], attendingCount: rsvp.attendingCount,
      customAnswers: rsvp.customAnswers || [], message: rsvp.message,
      createdAt: rsvp.createdAt, updatedAt: rsvp.updatedAt
    } : null,
    albumUploads: albumUploads.map((asset) => ({
      id: asset._id, url: asset.url, uploaderName: asset.uploaderName,
      status: asset.status, reviewedAt: asset.reviewedAt,
      createdAt: asset.createdAt, updatedAt: asset.updatedAt
    })),
    songRequests: songRequests.map((song) => ({
      id: song._id, title: song.title, artist: song.artist, dedication: song.dedication,
      status: song.status, sourceProvider: song.sourceProvider, sourceUrl: song.sourceUrl,
      thumbnailUrl: song.thumbnailUrl, previewUrl: song.previewUrl,
      reviewedAt: song.reviewedAt, playedAt: song.playedAt,
      createdAt: song.createdAt, updatedAt: song.updatedAt
    })),
    dedications: dedications.map((item) => ({
      id: item._id, publicName: item.publicName, message: item.message,
      type: item.type, status: item.status, visibility: item.visibility,
      reviewedAt: item.reviewedAt, createdAt: item.createdAt
    }))
  };
}

function normalizePhoneDigits(value) {
  return value ? String(value).replace(/\D/g, '') : '';
}

async function findGuestByPublicIdentity(eventId, { email, phone }) {
  const emailNormalized = email ? email.toLowerCase().trim() : '';
  if (emailNormalized) {
    const guest = await Guest.findOne({ event: eventId, email: emailNormalized }).select('name email phone invitationToken lastAccessLinkSentAt group roles tags relationshipLabel visibilityGroup allowedCompanions status checkInCode qrCode tableName seatLabel companions');
    if (guest) return guest;
  }
  const phoneDigits = normalizePhoneDigits(phone);
  if (!phoneDigits) return null;
  if (phoneDigits.length < 10) return null;
  const candidates = await Guest.find({ event: eventId, phone: { $exists: true, $ne: '' } }).select('name email phone invitationToken lastAccessLinkSentAt group roles tags relationshipLabel visibilityGroup allowedCompanions status checkInCode qrCode tableName seatLabel companions');
  return candidates.find((guest) => {
    const stored = normalizePhoneDigits(guest.phone);
    return stored && stored.slice(-10) === phoneDigits.slice(-10);
  }) || null;
}

function guestMatchesSpecificRules(guest, rsvpSettings = {}) {
  if (!guest) return false;
  const allowedGuestIds = (rsvpSettings.allowedGuestIds || []).map(String);
  if (allowedGuestIds.includes(String(guest._id))) return true;
  const allowedRoles = (rsvpSettings.allowedRoles || []).map((value) => String(value || '').toLowerCase().trim()).filter(Boolean);
  const allowedGroups = (rsvpSettings.allowedGroups || []).map((value) => String(value || '').trim()).filter(Boolean);
  const allowedEmails = (rsvpSettings.allowedEmails || []).map((value) => String(value || '').toLowerCase().trim()).filter(Boolean);
  const allowedPhones = (rsvpSettings.allowedPhones || []).map(normalizePhoneDigits).filter(Boolean);
  const email = guest.email ? String(guest.email).toLowerCase().trim() : '';
  const phone = normalizePhoneDigits(guest.phone);
  const roles = (guest.roles || []).map((value) => String(value || '').toLowerCase().trim());
  const groups = [guest.group, guest.visibilityGroup].map((value) => String(value || '').trim()).filter(Boolean);
  return (
    (email && allowedEmails.includes(email)) ||
    (phone.length >= 10 && allowedPhones.some((allowed) => allowed.length >= 10 && phone.slice(-10) === allowed.slice(-10))) ||
    roles.some((role) => allowedRoles.includes(role)) ||
    groups.some((group) => allowedGroups.includes(group))
  );
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
  const secMusicRaw = payload.content?.sectionMusic;
  const secMusicValues = secMusicRaw
    ? (secMusicRaw instanceof Map
        ? Array.from(secMusicRaw.values())
        : typeof secMusicRaw === 'object'
          ? Object.values(secMusicRaw)
          : []
      ).filter(Boolean)
    : [];
  if (secMusicValues.length && !limits.music) {
    const error = new Error('La musica por seccion requiere Evento Individual o Pro');
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

  const content = { ...(payload.content || {}) };
  const sectionSettings = { ...(content.sectionSettings || {}) };

  // Extraer ubicación por defecto del evento si no se proveyó
  if (!Array.isArray(content.locations) || content.locations.length === 0) {
    if (event.venue && (event.venue.name || event.venue.address || event.venue.mapUrl)) {
      content.locations = [{
        type: 'recepción',
        name: event.venue.name || '',
        address: event.venue.address || '',
        mapUrl: event.venue.mapUrl || '',
        wazeUrl: '',
        notes: ''
      }];
      if (sectionSettings.locations === undefined) {
        sectionSettings.locations = true;
      }
    }
  }

  // Extraer itinerario por defecto del evento si no se proveyó
  if (!Array.isArray(content.itinerary) || content.itinerary.length === 0) {
    if (Array.isArray(event.agenda) && event.agenda.length > 0) {
      content.itinerary = event.agenda.map((a) => ({
        time: a.time || '',
        title: a.title || '',
        description: a.description || ''
      }));
      if (sectionSettings.itinerary === undefined) {
        sectionSettings.itinerary = true;
      }
    } else if (event.time) {
      content.itinerary = [{
        time: event.time,
        title: getDefaultItineraryTitle(event.type),
        description: event.venue?.name ? `En ${event.venue.name}` : ''
      }];
      if (sectionSettings.itinerary === undefined) {
        sectionSettings.itinerary = true;
      }
    }
  }

  content.sectionSettings = sectionSettings;

  const invitation = await Invitation.create({ ...payload, content, owner: req.user._id, slug });
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

exports.remove = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findById(req.params.id);
  if (!invitation) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }

  const isOwner = String(invitation.owner) === String(req.user._id) || req.user.role === 'admin';
  if (!isOwner) {
    await requireEventAccess({ eventId: invitation.event, user: req.user, permission: 'edit_event' });
  }

  await Promise.all([
    CustomTemplateSubmission.updateMany({ invitation: invitation._id }, { $unset: { invitation: '' } }),
    AlbumAsset.updateMany({ invitation: invitation._id }, { $unset: { invitation: '' } }),
    Dedication.updateMany({ invitation: invitation._id }, { $unset: { invitation: '' } }),
    Rsvp.updateMany({ invitation: invitation._id }, { $unset: { invitation: '' } }),
    VisualDesignRevision.deleteMany({ invitation: invitation._id })
  ]);

  await Invitation.deleteOne({ _id: invitation._id });

  try {
    logEventActivity({
      eventId: invitation.event,
      actor: req.user,
      actorType: 'user',
      category: 'invitation',
      action: 'invitation_deleted',
      description: `Invitación eliminada: ${invitation.content?.headline || invitation.slug}`,
      metadata: { invitationId: invitation._id, slug: invitation.slug }
    });
  } catch (logErr) {
    console.warn('Failed to log invitation deletion:', logErr.message);
  }

  res.json({ message: 'Invitación eliminada correctamente' });
});

exports.publicBySlug = asyncHandler(async (req, res) => {
  const rawSlug = String(req.params.slug || '').toLowerCase().trim();
  const invitation = await Invitation.findOne({ slug: rawSlug, status: 'published' }).populate('event template');

  if (!invitation) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }

  if (invitation.accessMode === 'guest_list' || invitation.accessMode === 'specific_users') {
    const { guest } = await verifyGuestSessionForEvent(req, invitation.event, invitation.slug);
    if (invitation.accessMode === 'specific_users' && !guestMatchesSpecificRules(guest, invitation.rsvpSettings)) {
      const error = new Error('Esta invitacion no esta disponible para tu acceso');
      error.statusCode = 403;
      throw error;
    }
  }
  res.json({ invitation: publicInvitation(invitation) });
});

exports.requirePublicAccess = asyncHandler(async (req, _res, next) => {
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).select('event slug accessMode rsvpSettings');
  if (!invitation) {
    const error = new Error('Invitacion no disponible');
    error.statusCode = 404;
    throw error;
  }
  if (invitation.accessMode === 'guest_list' || invitation.accessMode === 'specific_users' || req.get('authorization')) {
    const { guest } = await verifyGuestSessionForEvent(req, invitation.event, invitation.slug);
    if (invitation.accessMode === 'specific_users' && !guestMatchesSpecificRules(guest, invitation.rsvpSettings)) {
      const error = new Error('Esta invitacion no esta disponible para tu acceso');
      error.statusCode = 403;
      throw error;
    }
    req.publicGuest = guest;
  }
  next();
});

exports.guestAccess = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).select('event slug accessMode rsvpSettings');
  if (!invitation) {
    const error = new Error('Invitacion no disponible');
    error.statusCode = 404;
    throw error;
  }

  if ((req.validated.body.email && !emailService.isEmailConfigured()) ||
      (req.validated.body.phone && !req.validated.body.email && !whatsappService.isEnabled())) {
    const error = new Error('El envío automático no está disponible. Usa tu enlace original o contacta al anfitrión.');
    error.statusCode = 503;
    throw error;
  }

  const guest = await findGuestByPublicIdentity(invitation.event, req.validated.body);
  const message = 'Si el contacto esta invitado, recibira un enlace personal para entrar. Revisa tambien la invitacion original.';
  if (!guest || (invitation.accessMode === 'specific_users' && !guestMatchesSpecificRules(guest, invitation.rsvpSettings))) {
    return res.json({ message });
  }

  if (!guest.invitationToken) {
    const invitationToken = crypto.randomBytes(16).toString('hex');
    await Guest.updateOne({ _id: guest._id, invitationToken: { $exists: false } }, { $set: { invitationToken } });
    guest.invitationToken = (await Guest.findById(guest._id).select('invitationToken'))?.invitationToken;
  }

  const now = new Date();
  const eligibleBefore = new Date(now.getTime() - 5 * 60 * 1000);
  const claimed = await Guest.findOneAndUpdate({
    _id: guest._id,
    $or: [{ lastAccessLinkSentAt: { $exists: false } }, { lastAccessLinkSentAt: { $lt: eligibleBefore } }]
  }, { $set: { lastAccessLinkSentAt: now } });
  if (!claimed) return res.json({ message });

  const event = await Event.findById(invitation.event);
  const link = whatsappService.publicInvitationUrl(invitation, guest, event);
  try {
    if (req.validated.body.email && guest.email) {
      await emailService.sendMail({
        to: guest.email,
        subject: `Tu acceso a ${event?.title || 'la invitacion'}`,
        text: `Hola ${guest.name}, abre tu invitacion personal: ${link}\nNo compartas este enlace; da acceso a tus datos del evento.`
      });
    } else if (req.validated.body.phone && guest.phone) {
      await whatsappService.sendMessage({ owner: event.owner, guest, event, invitation, type: 'invitation' });
    }
  } catch (error) {
    await Guest.updateOne({ _id: guest._id, lastAccessLinkSentAt: now }, { $unset: { lastAccessLinkSentAt: '' } });
    console.warn('No se pudo enviar enlace de acceso a invitacion:', error.message);
  }
  res.json({ message });
});

exports.guestByToken = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).select('event slug accessMode rsvpSettings');
  if (!invitation) {
    const error = new Error('Invitacion no disponible');
    error.statusCode = 404;
    throw error;
  }

  const guest = await Guest.findOne({
    event: invitation.event,
    invitationToken: String(req.params.token || '').trim()
  }).select('name email group roles tags relationshipLabel visibilityGroup allowedCompanions status communicationStatus checkInCode qrCode tableName seatLabel companions invitationOpenedAt');

  if (!guest) {
    const error = new Error('Link personalizado invalido');
    error.statusCode = 404;
    throw error;
  }
  if (invitation.accessMode === 'specific_users' && !guestMatchesSpecificRules(guest, invitation.rsvpSettings)) {
    const error = new Error('Esta invitacion no esta disponible para tu acceso');
    error.statusCode = 403;
    throw error;
  }

  guest.invitationOpenedAt = guest.invitationOpenedAt || new Date();
  if (guest.communicationStatus === 'sent') guest.communicationStatus = 'opened';
  await guest.save();

  const event = await Event.findById(invitation.event).select('_id');
  res.json({ guest: publicGuest(guest), guestSessionToken: signGuestSession(event, guest, invitation.slug) });
});

exports.guestActivity = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).select('_id event slug');
  if (!invitation) {
    const error = new Error('Invitacion no disponible');
    error.statusCode = 404;
    throw error;
  }
  const event = await Event.findById(invitation.event).select('_id');
  if (!event) {
    const error = new Error('Evento no disponible');
    error.statusCode = 404;
    throw error;
  }
  const { guest } = await verifyGuestSessionForEvent(req, event, invitation.slug);
  const [rsvp, albumUploads, songRequests, dedications] = await Promise.all([
    Rsvp.findOne({ event: event._id, invitation: invitation._id, guest: guest._id }),
    AlbumAsset.find({ event: event._id, invitation: invitation._id, guest: guest._id }).sort('-createdAt').limit(100),
    SongRequest.find({ event: event._id, guest: guest._id, $or: [{ invitation: invitation._id }, { invitation: { $exists: false } }] }).sort('-createdAt').limit(100),
    Dedication.find({ event: event._id, invitation: invitation._id, guest: guest._id }).sort('-createdAt').limit(100)
  ]);
  res.json(publicGuestActivity({ guest, rsvp, albumUploads, songRequests, dedications }));
});
