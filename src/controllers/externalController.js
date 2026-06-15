const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Rsvp = require('../models/Rsvp');
const SongRequest = require('../models/SongRequest');
const AlbumAsset = require('../models/AlbumAsset');
const asyncHandler = require('../utils/asyncHandler');
const albumController = require('./albumController');
const env = require('../config/env');
const { signGuestSession, verifyGuestSession } = require('../utils/guestSession');

function normalizeEmail(email) {
  return email ? String(email).toLowerCase().trim() : '';
}

function normalizePhone(phone) {
  return phone ? String(phone).replace(/\D/g, '') : '';
}

function publicGuest(guest) {
  return {
    id: guest._id,
    name: guest.name,
    group: guest.group,
    roles: guest.roles || [],
    tags: guest.tags || [],
    relationshipLabel: guest.relationshipLabel,
    visibilityGroup: guest.visibilityGroup,
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

function publicRsvp(rsvp) {
  if (!rsvp) return null;
  return {
    id: rsvp._id,
    response: rsvp.response,
    companions: rsvp.companions,
    companionNames: rsvp.companionNames || [],
    attendingCount: rsvp.attendingCount,
    mealPreference: rsvp.mealPreference,
    dietaryRestrictions: rsvp.dietaryRestrictions,
    menuSelection: rsvp.menuSelection,
    customAnswers: rsvp.customAnswers || [],
    message: rsvp.message,
    createdAt: rsvp.createdAt,
    updatedAt: rsvp.updatedAt
  };
}

function publicAlbumAsset(asset) {
  return {
    id: asset._id,
    url: asset.url,
    uploaderName: asset.uploaderName,
    status: asset.status,
    reviewedAt: asset.reviewedAt,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt
  };
}

function publicSongRequest(songRequest) {
  return {
    id: songRequest._id,
    title: songRequest.title,
    artist: songRequest.artist,
    dedication: songRequest.dedication,
    status: songRequest.status,
    sourceProvider: songRequest.sourceProvider,
    sourceUrl: songRequest.sourceUrl,
    externalId: songRequest.externalId,
    thumbnailUrl: songRequest.thumbnailUrl,
    previewUrl: songRequest.previewUrl,
    durationMs: songRequest.durationMs,
    reviewedAt: songRequest.reviewedAt,
    playedAt: songRequest.playedAt,
    createdAt: songRequest.createdAt,
    updatedAt: songRequest.updatedAt
  };
}

function getYouTubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (parsed.hostname.includes('youtube.com')) return parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop() || '';
  } catch (_error) {
    return '';
  }
  return '';
}

function getSpotifyTrackId(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('spotify.com')) return '';
    const parts = parsed.pathname.split('/').filter(Boolean);
    const trackIndex = parts.indexOf('track');
    return trackIndex >= 0 ? parts[trackIndex + 1] || '' : '';
  } catch (_error) {
    return '';
  }
}

function normalizeSongLookup({ query, url, title, artist }) {
  const raw = String(url || query || '').trim();
  const cleanTitle = String(title || '').trim();
  const cleanArtist = String(artist || '').trim();
  if (!raw && (cleanTitle || cleanArtist)) {
    return { title: cleanTitle || 'Cancion solicitada', artist: cleanArtist };
  }

  const youtubeId = /^https?:\/\//i.test(raw) ? getYouTubeId(raw) : '';
  if (youtubeId) {
    return {
      title: cleanTitle || 'Cancion de YouTube',
      artist: cleanArtist,
      sourceProvider: 'youtube',
      sourceUrl: raw,
      externalId: youtubeId,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
    };
  }

  const spotifyId = /^https?:\/\//i.test(raw) ? getSpotifyTrackId(raw) : '';
  if (spotifyId) {
    return {
      title: cleanTitle || 'Cancion de Spotify',
      artist: cleanArtist,
      sourceProvider: 'spotify',
      sourceUrl: raw,
      externalId: spotifyId
    };
  }

  const parts = raw.split(/\s+-\s+|\s+by\s+/i).map((part) => part.trim()).filter(Boolean);
  return {
    title: cleanTitle || parts[0] || raw || 'Cancion solicitada',
    artist: cleanArtist || parts[1] || '',
    sourceProvider: /^https?:\/\//i.test(raw) ? 'url' : 'manual',
    sourceUrl: /^https?:\/\//i.test(raw) ? raw : undefined
  };
}

function safeContent(event) {
  const content = event.externalContent || {};
  return {
    coverImageUrl: content.coverImageUrl,
    heroImageUrl: content.heroImageUrl,
    gallery: content.gallery || [],
    carousel: content.carousel || [],
    spectacularImages: content.spectacularImages || [],
    musicUrl: content.musicUrl,
    audioSections: content.audioSections || [],
    locations: content.locations?.length ? content.locations : [{
      type: 'principal',
      name: event.venue?.name,
      address: event.venue?.address,
      mapUrl: event.venue?.mapUrl
    }].filter((item) => item.name || item.address || item.mapUrl),
    sections: (content.sections || []).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    rsvpSettings: content.rsvpSettings || {},
    songRequestSettings: content.songRequestSettings || { enabled: true, maxRequestsPerGuest: 3, allowDedications: true }
  };
}

function publicEvent(event) {
  const content = safeContent(event);
  return {
    id: event._id,
    portalSlug: event.externalPortalSlug,
    mode: event.mode,
    type: event.type,
    title: event.title,
    hosts: event.hosts,
    date: event.date,
    venue: event.venue,
    agenda: event.agenda,
    externalSiteUrl: event.externalSiteUrl,
    externalSiteLabel: event.externalSiteLabel,
    settings: event.externalPortalSettings || {},
    content,
    externalContent: content,
    features: {
      rsvp: event.externalPortalSettings?.rsvpEnabled !== false,
      album: event.externalPortalSettings?.albumEnabled !== false,
      pass: event.externalPortalSettings?.passEnabled !== false,
      calendar: event.externalPortalSettings?.calendarEnabled !== false,
      songRequests: event.externalContent?.songRequestSettings?.enabled !== false
    }
  };
}

async function getPublicEvent(portalSlug) {
  const event = await Event.findOne({
    externalPortalSlug: portalSlug,
    mode: 'external_dashboard',
    externalPortalEnabled: { $ne: false }
  });
  if (!event) {
    const error = new Error('Portal externo no disponible');
    error.statusCode = 404;
    throw error;
  }
  return event;
}

function assetPayload(event, type) {
  const content = safeContent(event);
  if (type === 'cover') return { coverImageUrl: content.coverImageUrl, heroImageUrl: content.heroImageUrl };
  if (type === 'carousel') return { carousel: content.carousel };
  if (type === 'gallery') return { gallery: content.gallery, spectacularImages: content.spectacularImages };
  if (type === 'audio') return { musicUrl: content.musicUrl, audioSections: content.audioSections };
  if (type === 'map') return { locations: content.locations };
  return content;
}

exports.config = asyncHandler(async (req, res) => {
  const event = await getPublicEvent(req.params.portalSlug);
  res.json({ event: publicEvent(event) });
});

exports.assets = asyncHandler(async (req, res) => {
  const event = await getPublicEvent(req.params.portalSlug);
  const type = String(req.query.type || 'all');
  if (!['cover', 'carousel', 'gallery', 'audio', 'map', 'all'].includes(type)) {
    const error = new Error('Tipo de asset no soportado');
    error.statusCode = 400;
    throw error;
  }
  res.json({ type, assets: assetPayload(event, type) });
});

exports.identifyGuest = asyncHandler(async (req, res) => {
  const event = await getPublicEvent(req.params.portalSlug);
  const email = normalizeEmail(req.validated.body.email);
  const phone = normalizePhone(req.validated.body.phone);
  const token = String(req.validated.body.token || '').trim();
  const query = { event: event._id };
  if (token) query.invitationToken = token;
  else if (email) query.email = email;
  else if (phone) query.phone = { $regex: `${phone}$` };
  else {
    const error = new Error('Identificacion requiere email, telefono o token');
    error.statusCode = 400;
    throw error;
  }
  const guest = await Guest.findOne(query);
  if (!guest) {
    const error = new Error('Invitado no encontrado');
    error.statusCode = 404;
    throw error;
  }
  guest.invitationOpenedAt = guest.invitationOpenedAt || new Date();
  if (guest.communicationStatus === 'sent') guest.communicationStatus = 'opened';
  await guest.save();
  res.json({
    guest: publicGuest(guest),
    guestSessionToken: signGuestSession(event, guest, event.externalPortalSlug)
  });
});

exports.myStatus = asyncHandler(async (req, res) => {
  const { event, guest } = await verifyGuestSession(req, req.params.portalSlug);
  const [rsvp, albumUploads, songRequests] = await Promise.all([
    Rsvp.findOne({ event: event._id, invitation: { $exists: false }, guest: guest._id }),
    AlbumAsset.find({ event: event._id, guest: guest._id }).sort('-createdAt').limit(100),
    SongRequest.find({ event: event._id, guest: guest._id }).sort('-createdAt').limit(100)
  ]);
  res.json({
    guest: publicGuest(guest),
    rsvp: publicRsvp(rsvp),
    albumUploads: albumUploads.map(publicAlbumAsset),
    songRequests: songRequests.map(publicSongRequest)
  });
});

exports.rsvp = asyncHandler(async (req, res) => {
  const event = await getPublicEvent(req.params.portalSlug);
  const guest = await Guest.findOne({ _id: req.validated.body.guest, event: event._id });
  if (!guest) {
    const error = new Error('Invitado no pertenece a este evento');
    error.statusCode = 403;
    throw error;
  }
  const companionNames = (req.validated.body.companionNames || []).map((name) => String(name || '').trim()).filter(Boolean);
  const companions = req.validated.body.response === 'confirmed' ? Number(req.validated.body.companions || companionNames.length || 0) : 0;
  if (companions > guest.allowedCompanions) {
    const error = new Error('El numero de acompanantes excede lo permitido');
    error.statusCode = 400;
    throw error;
  }
  const data = {
    event: event._id,
    guest: guest._id,
    name: guest.name,
    email: guest.email,
    emailNormalized: normalizeEmail(guest.email),
    response: req.validated.body.response,
    companions,
    companionNames,
    attendingCount: req.validated.body.response === 'confirmed' ? 1 + companions : 0,
    mealPreference: req.validated.body.mealPreference,
    dietaryRestrictions: req.validated.body.dietaryRestrictions,
    menuSelection: req.validated.body.menuSelection,
    customAnswers: req.validated.body.customAnswers || [],
    message: req.validated.body.message
  };
  const rsvp = await Rsvp.findOneAndUpdate(
    { event: event._id, invitation: { $exists: false }, guest: guest._id },
    data,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  guest.status = req.validated.body.response === 'maybe' ? 'pending' : req.validated.body.response;
  if (req.validated.body.response === 'confirmed') guest.communicationStatus = 'confirmed';
  await guest.save();
  res.json({ rsvp, updated: true });
});

exports.songRequest = asyncHandler(async (req, res) => {
  const event = await getPublicEvent(req.params.portalSlug);
  if (event.externalContent?.songRequestSettings?.enabled === false) {
    const error = new Error('Solicitudes de canciones no disponibles');
    error.statusCode = 404;
    throw error;
  }
  let guest = null;
  if (req.validated.body.guest) guest = await Guest.findOne({ _id: req.validated.body.guest, event: event._id });
  const max = event.externalContent?.songRequestSettings?.maxRequestsPerGuest || 3;
  if (guest) {
    const existing = await SongRequest.countDocuments({ event: event._id, guest: guest._id });
    if (existing >= max) {
      const error = new Error(`Puedes solicitar hasta ${max} canciones`);
      error.statusCode = 400;
      throw error;
    }
  }
  const lookup = normalizeSongLookup({
    query: req.validated.body.query,
    url: req.validated.body.sourceUrl || req.validated.body.url,
    title: req.validated.body.title,
    artist: req.validated.body.artist
  });
  const songRequest = await SongRequest.create({
    owner: event.owner,
    event: event._id,
    guest: guest?._id,
    requesterName: guest?.name || req.validated.body.requesterName,
    requesterEmail: guest?.email || normalizeEmail(req.validated.body.requesterEmail),
    title: lookup.title,
    artist: lookup.artist,
    dedication: req.validated.body.dedication,
    sourceProvider: lookup.sourceProvider,
    sourceUrl: lookup.sourceUrl,
    externalId: lookup.externalId,
    thumbnailUrl: lookup.thumbnailUrl,
    previewUrl: lookup.previewUrl,
    durationMs: lookup.durationMs
  });
  res.status(201).json({ songRequest: publicSongRequest(songRequest) });
});

exports.songLookup = asyncHandler(async (req, res) => {
  await getPublicEvent(req.params.portalSlug);
  const song = normalizeSongLookup(req.validated.body);
  res.json({ song });
});

exports.embedManifest = asyncHandler(async (req, res) => {
  const event = await getPublicEvent(req.params.portalSlug);
  const base = env.clientUrl.replace(/\/$/, '');
  const slug = event.externalPortalSlug;
  const widget = (name) => `${base}/embed/${slug}/${name}`;
  res.json({
    portalSlug: slug,
    widgets: {
      rsvp: widget('rsvp'),
      guestPass: widget('guest-pass'),
      album: widget('album'),
      gallery: widget('gallery'),
      map: widget('map'),
      songRequests: widget('song-requests'),
      fullPortal: widget('full-portal')
    },
    snippets: {
      rsvp: `<iframe src="${widget('rsvp')}" width="100%" height="720" style="border:0"></iframe>`,
      album: `<iframe src="${widget('album')}" width="100%" height="720" style="border:0"></iframe>`,
      map: `<iframe src="${widget('map')}" width="100%" height="480" style="border:0"></iframe>`,
      songRequests: `<iframe src="${widget('song-requests')}" width="100%" height="520" style="border:0"></iframe>`,
      script: `<div data-kyndra-widget="rsvp" data-portal="${slug}"></div><script src="${base}/assets/kyndra-embed.js"></script>`
    }
  });
});

exports.album = albumController.publicEventApproved;
exports.albumUpload = albumController.uploadPublicEvent;
