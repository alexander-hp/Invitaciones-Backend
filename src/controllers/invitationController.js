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
const { recordPublishedTemplateUsage } = require('./visualDesignTemplateController');
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

function plainInvitationContent(value) {
  if (!value) return {};
  const plain = value?.toObject ? value.toObject({ flattenMaps: true }) : value;
  return JSON.parse(JSON.stringify(plain));
}

function publicInvitation(invitation, { allowWhiteLabel = false, useDraft = false } = {}) {
  const sourceContent = !useDraft && invitation.status === 'published' && invitation.publishedContent
    ? invitation.publishedContent
    : invitation.content;
  const content = plainInvitationContent(sourceContent);
  if (useDraft && content.visualDesignDraft?.sections?.length && (!content.template || content.template === 'visual-builder')) {
    content.visualDesign = content.visualDesignDraft;
    content.template = 'visual-builder';
  }
  delete content.visualDesignDraft;
  delete content.privateAlbum;
  content.hideBranding = allowWhiteLabel && Boolean(content.hideBranding);
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

function buildAccessGateData(invitation) {
  const publishedContent = plainInvitationContent(invitation.publishedContent || {});
  const baseContent = plainInvitationContent(invitation.content || {});
  const isPublished = invitation.status === 'published' && Object.keys(publishedContent).length > 0;
  const content = isPublished ? publishedContent : (Object.keys(publishedContent).length ? publishedContent : baseContent);
  const visualDesign = (isPublished ? publishedContent.visualDesign : null) || baseContent.visualDesign || baseContent.visualDesignDraft || publishedContent.visualDesign || {};
  const rawAccessScreen = isPublished && (publishedContent.accessScreen || publishedContent.visualDesign?.accessScreen)
    ? {
      ...(baseContent.visualDesign?.accessScreen || {}),
      ...(baseContent.accessScreen || {}),
      ...(publishedContent.visualDesign?.accessScreen || {}),
      ...(publishedContent.accessScreen || {})
    }
    : {
      ...(publishedContent.visualDesign?.accessScreen || {}),
      ...(publishedContent.accessScreen || {}),
      ...(baseContent.visualDesign?.accessScreen || {}),
      ...(baseContent.visualDesignDraft?.accessScreen || {}),
      ...(baseContent.accessScreen || {})
    };
  let safeAccessScreen = null;
  if (Object.keys(rawAccessScreen).length > 0) {
    const { eventPin, ...rest } = rawAccessScreen;
    safeAccessScreen = {
      ...rest,
      responsiveMode: visualDesign.responsiveMode || 'shared',
      requirePin: Boolean(rawAccessScreen.requirePin),
      pinMode: rawAccessScreen.pinMode || 'event',
      pinInputLabel: rawAccessScreen.pinInputLabel || 'NIP de acceso',
      pinInputPlaceholder: rawAccessScreen.pinInputPlaceholder || 'Ingresa tu NIP',
      allowSelfRegistration: Boolean(rawAccessScreen.allowSelfRegistration),
      selfRegTitle: rawAccessScreen.selfRegTitle || 'Solicitar Invitación',
      selfRegSubtitle: rawAccessScreen.selfRegSubtitle || 'Ingresa tus datos para solicitar acceso a la lista oficial.',
      selfRegButtonText: rawAccessScreen.selfRegButtonText || 'ENVIAR SOLICITUD',
      selfRegSuccessMessage: rawAccessScreen.selfRegSuccessMessage || '¡Solicitud recibida! Los organizadores revisarán tu petición y te enviarán tu NIP y pase por correo.',
      selfRegGroup: rawAccessScreen.selfRegGroup || 'Solicitudes de Acceso',
      selfRegRequireApproval: rawAccessScreen.selfRegRequireApproval !== false,
      selfRegMaxGuests: Number(rawAccessScreen.selfRegMaxGuests || 0)
    };
  }
  return {
    slug: invitation.slug,
    eventTitle: invitation.event?.title || content.headline || 'Acceso al Evento',
    accessMode: invitation.accessMode,
    accessScreen: safeAccessScreen,
    responsiveMode: visualDesign.responsiveMode || 'shared',
    theme: visualDesign.theme || null,
    palette: content.palette || null,
    coverImageUrl: content.coverImageUrl || null,
    template: content.template || invitation.template || 'envelope-cards'
  };
}

function publicGuest(guest) {
  return {
    id: guest._id,
    name: guest.name,
    email: guest.email,
    phone: guest.phone,
    phoneCountryCode: guest.phoneCountryCode,
    phoneNationalNumber: guest.phoneNationalNumber,
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
    const guest = await Guest.findOne({ event: eventId, email: emailNormalized }).select('name email phone invitationToken accessPin lastAccessLinkSentAt group roles tags relationshipLabel visibilityGroup allowedCompanions status checkInCode qrCode tableName seatLabel companions');
    if (guest) return guest;
  }
  const phoneDigits = normalizePhoneDigits(phone);
  if (!phoneDigits) return null;
  if (phoneDigits.length < 10) return null;
  const candidates = await Guest.find({ event: eventId, phone: { $exists: true, $ne: '' } }).select('name email phone invitationToken accessPin lastAccessLinkSentAt group roles tags relationshipLabel visibilityGroup allowedCompanions status checkInCode qrCode tableName seatLabel companions');
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

function eventStartsAt(event) {
  if (!event?.date) return null;
  const rawDate = event.date instanceof Date ? event.date.toISOString().slice(0, 10) : String(event.date).slice(0, 10);
  const time = /^\d{2}:\d{2}/.test(String(event.time || '')) ? String(event.time).slice(0, 5) : '23:59';
  const parsed = new Date(`${rawDate}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function assertInvitationRsvpDeadline(event, rawDeadline) {
  if (!rawDeadline) return;
  const deadline = rawDeadline instanceof Date ? rawDeadline : new Date(rawDeadline);
  if (Number.isNaN(deadline.getTime())) {
    const error = new Error('Selecciona una fecha limite de respuesta valida');
    error.statusCode = 400;
    throw error;
  }

  // Nota: Se permite que la fecha límite esté en el pasado para facilitar pruebas y eventos de testing/históricos.

  const eventDate = eventStartsAt(event);
  if (eventDate && deadline.getTime() > eventDate.getTime()) {
    const error = new Error('La fecha limite de respuesta no puede ser posterior al inicio del evento');
    error.statusCode = 400;
    throw error;
  }
}

async function assertInvitationPlanLimits(user, event, payload) {
  assertInvitationRsvpDeadline(event, payload.rsvpSettings?.deadline);
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

exports.previewBySlug = asyncHandler(async (req, res) => {
  const rawSlug = String(req.params.slug || '').toLowerCase().trim();
  const invitation = await Invitation.findOne({ slug: rawSlug })
    .populate('event template')
    .populate('owner', 'plan subscriptionPlan subscriptionStatus subscriptionCurrentPeriodEnd');

  if (!invitation) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }

  const isOwner = String(invitation.owner?._id || invitation.owner) === String(req.user._id);
  if (!isOwner) {
    await requireEventAccess({ eventId: invitation.event?._id || invitation.event, user: req.user, permission: 'edit_event' });
  }

  const limits = getEffectivePlanLimits(invitation.owner, invitation.event);
  res.json({ invitation: publicInvitation(invitation, { allowWhiteLabel: Boolean(limits.whiteLabel), useDraft: true }) });
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
  const currentInvitation = await Invitation.findOne({ _id: req.params.id, owner: req.user._id })
    .select('_id event status content publishedContent');
  if (!currentInvitation) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }
  const event = await Event.findOne({ _id: currentInvitation.event, owner: req.user._id }).select('_id plan date time createdAt');
  await assertInvitationPlanLimits(req.user, event, req.validated.body);
  const updatePayload = { ...req.validated.body };
  if (currentInvitation.status === 'published' && req.validated.body.content) {
    if (!currentInvitation.publishedContent) {
      updatePayload.publishedContent = plainInvitationContent(currentInvitation.content);
    } else if (req.validated.body.content.accessScreen) {
      const nextPublished = plainInvitationContent(currentInvitation.publishedContent);
      const nextAccess = plainInvitationContent(req.validated.body.content.accessScreen);
      nextPublished.accessScreen = nextAccess;
      if (nextPublished.visualDesign) {
        nextPublished.visualDesign = {
          ...nextPublished.visualDesign,
          accessScreen: {
            ...(nextPublished.visualDesign.accessScreen || {}),
            ...nextAccess
          }
        };
      }
      updatePayload.publishedContent = nextPublished;
    }
  }
  const invitation = await Invitation.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, updatePayload, { new: true });
  if (!invitation) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ invitation });
});

exports.publish = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({ _id: req.params.id, owner: req.user._id });
  if (!invitation) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }
  const event = await Event.findOne({ _id: invitation.event, owner: req.user._id }).select('_id owner title type date time plan status createdAt');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  assertInvitationRsvpDeadline(event, invitation.rsvpSettings?.deadline);
  if (req.validated?.body?.source === 'visual') {
    const draft = invitation.content?.visualDesignDraft;
    if (!draft?.sections?.length) {
      const error = new Error('Guarda un diseño visual antes de publicarlo');
      error.statusCode = 400;
      throw error;
    }
    invitation.content.visualDesign = plainInvitationContent(draft);
    if (draft.accessScreen) {
      invitation.content.accessScreen = plainInvitationContent(draft.accessScreen);
      invitation.content.visualDesign.accessScreen = plainInvitationContent(draft.accessScreen);
    }
    invitation.content.template = 'visual-builder';
    invitation.markModified('content');
  }
  const publishedContent = plainInvitationContent(invitation.content);
  if (invitation.content?.accessScreen) {
    const cleanAccess = plainInvitationContent(invitation.content.accessScreen);
    publishedContent.accessScreen = cleanAccess;
    if (publishedContent.visualDesign) {
      publishedContent.visualDesign = {
        ...publishedContent.visualDesign,
        accessScreen: {
          ...(publishedContent.visualDesign.accessScreen || {}),
          ...cleanAccess
        }
      };
    }
  }
  delete publishedContent.visualDesignDraft;
  if (publishedContent.template && publishedContent.template !== 'visual-builder' && publishedContent.visualDesign) {
    publishedContent.visualDesign.active = false;
  }
  invitation.publishedContent = publishedContent;
  invitation.markModified('publishedContent');
  invitation.status = 'published';
  invitation.publishedAt = new Date();
  await invitation.save();
  if (invitation.sourceVisualTemplate) {
    try {
      await recordPublishedTemplateUsage({ invitation, event });
    } catch (error) {
      console.warn('Template usage tracking failed:', error.message);
    }
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
  const invitation = await Invitation.findOne({ slug: rawSlug, status: 'published' })
    .populate('event template')
    .populate('owner', 'plan subscriptionPlan subscriptionStatus subscriptionCurrentPeriodEnd');

  if (!invitation) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }

  if (invitation.accessMode === 'guest_list' || invitation.accessMode === 'specific_users') {
    try {
      const { guest } = await verifyGuestSessionForEvent(req, invitation.event, invitation.slug);
      if (invitation.accessMode === 'specific_users' && !guestMatchesSpecificRules(guest, invitation.rsvpSettings)) {
        const error = new Error('Esta invitacion no esta disponible para tu acceso');
        error.statusCode = 403;
        error.accessGate = buildAccessGateData(invitation);
        throw error;
      }
    } catch (authError) {
      authError.statusCode = authError.statusCode || 401;
      authError.accessGate = buildAccessGateData(invitation);
      throw authError;
    }
  }
  const limits = getEffectivePlanLimits(invitation.owner, invitation.event);
  res.json({ invitation: publicInvitation(invitation, { allowWhiteLabel: limits.whiteLabel }) });
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
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).select('event slug accessMode rsvpSettings content publishedContent');
  if (!invitation) {
    const error = new Error('Invitacion no disponible');
    error.statusCode = 404;
    throw error;
  }

  const guest = await findGuestByPublicIdentity(invitation.event, req.validated.body);
  const defaultMessage = 'Si el contacto esta invitado, recibira su pase digital. Revisa tambien la invitacion original.';
  if (!guest || (invitation.accessMode === 'specific_users' && !guestMatchesSpecificRules(guest, invitation.rsvpSettings))) {
    return res.json({ message: defaultMessage });
  }

  const publishedContent = plainInvitationContent(invitation.publishedContent || {});
  const baseContent = plainInvitationContent(invitation.content || {});
  const content = Object.keys(publishedContent).length ? publishedContent : baseContent;
  const isPublished = invitation.status === 'published' && Object.keys(publishedContent).length > 0;
  const accessScreen = isPublished && (publishedContent.accessScreen || publishedContent.visualDesign?.accessScreen)
    ? {
      ...(baseContent.visualDesign?.accessScreen || {}),
      ...(baseContent.accessScreen || {}),
      ...(publishedContent.visualDesign?.accessScreen || {}),
      ...(publishedContent.accessScreen || {})
    }
    : {
      ...(publishedContent.visualDesign?.accessScreen || {}),
      ...(publishedContent.accessScreen || {}),
      ...(baseContent.visualDesign?.accessScreen || {}),
      ...(baseContent.visualDesignDraft?.accessScreen || {}),
      ...(baseContent.accessScreen || {})
    };

  if (accessScreen.requirePin) {
    const providedPin = String(req.validated.body.pin || '').trim();
    if (!providedPin) {
      const error = new Error('Se requiere el NIP de acceso para ingresar.');
      error.statusCode = 401;
      throw error;
    }

    if (accessScreen.pinMode === 'individual') {
      const expectedPin = String(guest.accessPin || '').trim();
      if (!expectedPin || providedPin.toLowerCase() !== expectedPin.toLowerCase()) {
        const error = new Error('El NIP ingresado no es válido para este invitado. Revisa tu mensaje o invitación.');
        error.statusCode = 401;
        throw error;
      }
    } else {
      const expectedPin = String(accessScreen.eventPin || '').trim();
      if (expectedPin && providedPin.toLowerCase() !== expectedPin.toLowerCase()) {
        const error = new Error('El NIP de acceso del evento es incorrecto.');
        error.statusCode = 401;
        throw error;
      }
    }
  }

  if (!guest.checkInCode) {
    guest.checkInCode = crypto.randomBytes(5).toString('hex').toUpperCase();
  }
  if (!guest.qrCode) {
    guest.qrCode = guest.checkInCode;
  }
  if (!guest.invitationToken) {
    guest.invitationToken = crypto.randomBytes(16).toString('hex');
  }
  await Guest.updateOne({ _id: guest._id }, {
    $set: {
      checkInCode: guest.checkInCode,
      qrCode: guest.qrCode,
      invitationToken: guest.invitationToken
    }
  });

  const now = new Date();
  const eligibleBefore = new Date(now.getTime() - 2 * 60 * 1000);
  const claimed = await Guest.findOneAndUpdate({
    _id: guest._id,
    $or: [{ lastAccessLinkSentAt: { $exists: false } }, { lastAccessLinkSentAt: { $lt: eligibleBefore } }]
  }, { $set: { lastAccessLinkSentAt: now } });

  const event = await Event.findById(invitation.event);
  const link = whatsappService.publicInvitationUrl(invitation, guest, event);
  const guestSessionToken = signGuestSession(event, guest, invitation.slug);

  if (claimed) {
    try {
      if (req.validated.body.email && guest.email && emailService.isEmailConfigured()) {
        await emailService.sendGuestInvitationEmail({
          to: guest.email,
          guest,
          event,
          invitation,
          publicUrl: link,
          type: 'pass'
        });
      } else if (req.validated.body.phone && guest.phone && whatsappService.isEnabled()) {
        await whatsappService.sendMessage({ owner: event.owner, guest, event, invitation, type: 'invitation' });
      }
    } catch (error) {
      console.warn('No se pudo enviar el pase por correo/WhatsApp:', error.message);
    }
  }

  res.json({
    message: `¡Pase encontrado para ${guest.name}!`,
    guest: publicGuest(guest),
    guestSessionToken
  });
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
  }).select('name email group roles tags relationshipLabel visibilityGroup allowedCompanions status communicationStatus checkInCode qrCode tableName seatLabel companions invitationOpenedAt invitationToken accessPin personalizedLinkGeneratedAt');

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

  const openedAt = guest.invitationOpenedAt || new Date();
  const newCommStatus = guest.communicationStatus === 'sent' ? 'opened' : guest.communicationStatus;
  await Guest.updateOne({ _id: guest._id }, {
    $set: {
      invitationOpenedAt: openedAt,
      communicationStatus: newCommStatus
    }
  });
  guest.invitationOpenedAt = openedAt;
  guest.communicationStatus = newCommStatus;

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

exports.selfRegisterGuest = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' })
    .populate('owner', 'email name plan planExpiresAt subscriptionStatus subscriptionPlan subscriptionCurrentPeriodEnd');
  if (!invitation) {
    const error = new Error('Invitación no disponible');
    error.statusCode = 404;
    throw error;
  }
  const event = await Event.findById(invitation.event);
  if (!event) {
    const error = new Error('Evento no disponible');
    error.statusCode = 404;
    throw error;
  }

  const { name, phone, email, companions, companionNames, notes, group, status } = req.validated.body;

  // Plan limits verification
  const ownerPlanUser = invitation.owner;
  const limits = getEffectivePlanLimits(ownerPlanUser, event);
  const currentGuestCount = await Guest.countDocuments({ owner: event.owner, event: event._id });
  if (currentGuestCount >= limits.guests) {
    const error = new Error(`Se ha alcanzado el límite máximo de ${limits.guests} invitados permitidos para tu plan.`);
    error.statusCode = 402;
    throw error;
  }

  // Section-specific max guests limit verification (if configured by the host)
  const selfRegSection = invitation.content?.visualDesign?.sections?.find((s) => s.type === 'selfRegister' && s.enabled !== false);
  const sectionMaxGuests = Number(selfRegSection?.pluginSettings?.maxGuests || 0);
  if (sectionMaxGuests > 0) {
    const assignedGroup = (group && group.trim()) || selfRegSection?.pluginSettings?.defaultGroup || 'Auto-registro';
    const formGuestCount = await Guest.countDocuments({ owner: event.owner, event: event._id, group: assignedGroup });
    if (formGuestCount >= sectionMaxGuests) {
      const error = new Error(`Se ha alcanzado el cupo máximo de ${sectionMaxGuests} personas registradas por este formulario.`);
      error.statusCode = 409;
      throw error;
    }
  }

  const emailNormalized = email && email.trim() ? email.toLowerCase().trim() : undefined;
  const rawDigits = phone ? String(phone).replace(/\D/g, '') : '';
  let phoneNormalized = undefined;
  if (rawDigits) {
    if (rawDigits.length === 10) phoneNormalized = `+52${rawDigits}`;
    else if (rawDigits.startsWith('521') && rawDigits.length === 13) phoneNormalized = `+52${rawDigits.slice(3)}`;
    else phoneNormalized = `+${rawDigits}`;
  }

  // Check if a guest with this contact already exists in this event
  let guest = null;
  if (emailNormalized || phoneNormalized) {
    const contactOr = [];
    if (emailNormalized) contactOr.push({ email: emailNormalized });
    if (phoneNormalized) contactOr.push({ phone: phoneNormalized });
    guest = await Guest.findOne({ owner: event.owner, event: event._id, $or: contactOr });
  }

  const companionsCount = Number(companions || 0);
  const guestStatus = ['confirmed', 'pending', 'declined'].includes(status) ? status : 'confirmed';
  const assignedGroup = (group && group.trim()) || 'Auto-registro';

  let isNew = false;
  if (guest) {
    guest.name = name.trim();
    if (emailNormalized) guest.email = emailNormalized;
    if (phoneNormalized) guest.phone = phoneNormalized;
    guest.status = guestStatus;
    guest.allowedCompanions = Math.max(guest.allowedCompanions || 0, companionsCount);
    if (!guest.group) guest.group = assignedGroup;
    if (Array.isArray(companionNames) && companionNames.length > 0) {
      const companionList = companionNames.map((cn) => ({ name: String(cn || '').trim() })).filter((c) => c.name);
      if (companionList.length > 0) guest.companions = companionList;
    }
    await guest.save();
  } else {
    isNew = true;
    const companionList = Array.isArray(companionNames)
      ? companionNames.map((cn) => ({ name: String(cn || '').trim() })).filter((c) => c.name)
      : [];

    guest = await Guest.create({
      owner: event.owner,
      event: event._id,
      name: name.trim(),
      email: emailNormalized,
      phone: phoneNormalized,
      group: assignedGroup,
      allowedCompanions: companionsCount,
      companions: companionList,
      status: guestStatus,
      communicationStatus: 'confirmed'
    });
  }

  // Sync RSVP record
  try {
    const existingRsvp = await Rsvp.findOne({ invitation: invitation._id, guest: guest._id });
    const rsvpData = {
      invitation: invitation._id,
      event: event._id,
      guest: guest._id,
      name: guest.name,
      email: guest.email,
      emailNormalized: guest.email ? guest.email.toLowerCase().trim() : undefined,
      response: guestStatus === 'declined' ? 'declined' : 'confirmed',
      companions: companionsCount,
      companionNames: Array.isArray(companionNames) ? companionNames.filter(Boolean) : [],
      attendingCount: guestStatus === 'confirmed' ? (1 + companionsCount) : 0,
      message: notes ? String(notes).trim() : undefined
    };

    if (existingRsvp) {
      Object.assign(existingRsvp, rsvpData);
      await existingRsvp.save();
    } else {
      await Rsvp.create(rsvpData);
    }
  } catch (rsvpErr) {
    console.warn('Error sincronizando RSVP en auto-registro:', rsvpErr.message);
  }

  // Log activity
  try {
    logEventActivity({
      eventId: event._id,
      actorType: 'guest',
      category: 'guest',
      action: isNew ? 'guest_self_registered' : 'guest_self_updated',
      description: isNew
        ? `Auto-registro de invitado: ${guest.name}${companionsCount > 0 ? ` (+${companionsCount} pases)` : ''}`
        : `Actualización de auto-registro: ${guest.name}`,
      metadata: { guestId: guest._id, group: guest.group, companions: companionsCount, status: guest.status }
    });
  } catch (logErr) {
    console.warn('Error registrando log de auto-registro:', logErr.message);
  }

  const guestSessionToken = signGuestSession(event, guest, invitation.slug);

  res.status(isNew ? 201 : 200).json({
    ok: true,
    isNew,
    guest: publicGuest(guest),
    guestSessionToken,
    message: isNew
      ? '¡Registro exitoso! Ya estás en la lista oficial de invitados.'
      : '¡Tus datos han sido actualizados en la lista de invitados!'
  });
});

exports.buildAccessGateData = buildAccessGateData;
exports.plainInvitationContent = plainInvitationContent;

