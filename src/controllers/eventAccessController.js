const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const AlbumAsset = require('../models/AlbumAsset');
const Event = require('../models/Event');
const EventAccessToken = require('../models/EventAccessToken');
const EventTable = require('../models/EventTable');
const Guest = require('../models/Guest');
const Rsvp = require('../models/Rsvp');
const SongRequest = require('../models/SongRequest');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { notifyReviewStatus } = require('../utils/moderation');

const s3 = new S3Client({ region: env.awsRegion });
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

const ROLE_PERMISSIONS = {
  check_in: ['check_in'],
  album_review: ['album_review'],
  photographer: ['album_upload'],
  album_view: ['album_view'],
  client_view: ['client_view'],
  guest_ops: ['check_in', 'album_review', 'client_view', 'guest_ops', 'song_review'],
  dj: ['song_review'],
  integration_api: ['external_api']
};

function hasPermission(access, permission) {
  return ROLE_PERMISSIONS[access.role]?.includes(permission);
}

function buildPublicUrl(key) {
  const baseUrl = env.mediaPublicBaseUrl;
  if (baseUrl) return `${baseUrl.replace(/\/$/, '')}/${key}`;
  return `https://${env.s3Bucket}.s3.${env.awsRegion}.amazonaws.com/${key}`;
}

async function uploadAlbumFile(file, ownerId, eventId) {
  if (!env.s3Bucket) {
    const error = new Error('AWS_S3_BUCKET no configurado');
    error.statusCode = 501;
    throw error;
  }
  if (!file) {
    const error = new Error('Archivo requerido');
    error.statusCode = 400;
    throw error;
  }
  if (!IMAGE_TYPES.has(file.mimetype)) {
    const error = new Error('Tipo de imagen no soportado');
    error.statusCode = 400;
    throw error;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    const error = new Error('La imagen excede 8MB');
    error.statusCode = 400;
    throw error;
  }

  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `album/${ownerId}/${eventId}/photographer-${Date.now()}-${safeName}`;
  await s3.send(new PutObjectCommand({ Bucket: env.s3Bucket, Key: key, ContentType: file.mimetype, Body: file.buffer }));
  return { key, url: buildPublicUrl(key) };
}

async function getActiveAccess(token) {
  const access = await EventAccessToken.findOne({ token, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
  if (!access) {
    const error = new Error('Link externo invalido o expirado');
    error.statusCode = 404;
    throw error;
  }
  return access;
}

function publicGuest(guest) {
  return {
    id: guest._id,
    name: guest.name,
    group: guest.group,
    tableName: guest.tableName,
    seatLabel: guest.seatLabel,
    allowedCompanions: guest.allowedCompanions,
    companions: guest.companions || [],
    checkInCode: guest.checkInCode,
    checkedIn: guest.checkedIn,
    checkedInAt: guest.checkedInAt,
    status: guest.status,
    communicationStatus: guest.communicationStatus
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

exports.session = asyncHandler(async (req, res) => {
  const access = await getActiveAccess(req.params.token);
  const [event, guests, rsvps, tables, albumAssets, songRequests] = await Promise.all([
    Event.findById(access.event).select('title type date venue mode externalSiteUrl externalSiteLabel externalPortalSlug'),
    hasPermission(access, 'check_in') || hasPermission(access, 'client_view') ? Guest.find({ event: access.event }).sort('name') : [],
    hasPermission(access, 'client_view') ? Rsvp.find({ event: access.event }).sort('-createdAt').limit(200) : [],
    hasPermission(access, 'client_view') ? EventTable.find({ event: access.event }).sort('order name') : [],
    hasPermission(access, 'album_review') || hasPermission(access, 'album_view') || hasPermission(access, 'album_upload') ? AlbumAsset.find({ event: access.event }).sort('-createdAt').limit(200) : [],
    hasPermission(access, 'song_review') ? SongRequest.find({ event: access.event }).populate('guest', 'name group roles relationshipLabel visibilityGroup tableName').sort({ sortOrder: 1, createdAt: -1 }).limit(200) : []
  ]);
  access.lastUsedAt = new Date();
  await access.save();
  res.json({
    role: access.role,
    permissions: ROLE_PERMISSIONS[access.role] || [],
    event,
    guests: guests.map(publicGuest),
    rsvps,
    tables,
    albumAssets,
    songRequests,
    expiresAt: access.expiresAt
  });
});

exports.checkIn = asyncHandler(async (req, res) => {
  const access = await getActiveAccess(req.params.token);
  if (!hasPermission(access, 'check_in')) {
    const error = new Error('Este link no permite check-in');
    error.statusCode = 403;
    throw error;
  }
  const code = String(req.validated.body.code || '').trim().toUpperCase();
  const guest = await Guest.findOne({ event: access.event, checkInCode: code });
  if (!guest) {
    const error = new Error('Codigo de check-in no encontrado para este evento');
    error.statusCode = 404;
    throw error;
  }
  guest.checkedIn = true;
  guest.checkedInAt = guest.checkedInAt || new Date();
  await guest.save();
  access.lastUsedAt = new Date();
  await access.save();
  res.json({ guest: publicGuest(guest) });
});

exports.updateAlbum = asyncHandler(async (req, res) => {
  const access = await getActiveAccess(req.params.token);
  if (!hasPermission(access, 'album_review')) {
    const error = new Error('Este link no permite revisar album');
    error.statusCode = 403;
    throw error;
  }
  const asset = await AlbumAsset.findOneAndUpdate(
    { _id: req.params.assetId, event: access.event },
    { status: req.validated.body.status, reviewedAt: new Date() },
    { new: true }
  );
  if (!asset) {
    const error = new Error('Foto no encontrada');
    error.statusCode = 404;
    throw error;
  }
  const event = await Event.findById(access.event).select('title externalContent');
  await asset.populate('guest', 'name email');
  await notifyReviewStatus({
    guest: asset.guest,
    email: asset.uploaderEmail,
    name: asset.uploaderName,
    event,
    itemType: 'album',
    status: asset.status,
    itemTitle: asset.url,
    settings: event?.externalContent?.moderationSettings || {}
  });
  access.lastUsedAt = new Date();
  await access.save();
  res.json({ asset });
});

exports.uploadAlbum = asyncHandler(async (req, res) => {
  const access = await getActiveAccess(req.params.token);
  if (!hasPermission(access, 'album_upload')) {
    const error = new Error('Este link no permite subir fotos');
    error.statusCode = 403;
    throw error;
  }
  const event = await Event.findById(access.event).select('_id owner title externalContent');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const upload = await uploadAlbumFile(req.file, event.owner, event._id);
  const requestedStatus = req.validated.body.status;
  const status = requestedStatus === 'approved' && hasPermission(access, 'album_review') ? 'approved' : 'pending';
  const asset = await AlbumAsset.create({
    owner: event.owner,
    event: event._id,
    uploaderName: req.validated.body.uploaderName || access.label || 'Fotografo',
    uploaderEmail: req.validated.body.uploaderEmail,
    key: upload.key,
    url: upload.url,
    status,
    reviewedAt: status === 'approved' ? new Date() : undefined
  });

  access.lastUsedAt = new Date();
  await access.save();
  res.status(201).json({ asset });
});

exports.updateSong = asyncHandler(async (req, res) => {
  const access = await getActiveAccess(req.params.token);
  if (!hasPermission(access, 'song_review')) {
    const error = new Error('Este link no permite operar DJ');
    error.statusCode = 403;
    throw error;
  }
  const update = {};
  if (req.validated.body.status) {
    update.status = req.validated.body.status;
    update.reviewedAt = new Date();
    if (req.validated.body.status === 'played') update.playedAt = new Date();
  }
  if (req.validated.body.sortOrder !== undefined) update.sortOrder = req.validated.body.sortOrder;
  const songRequest = await SongRequest.findOneAndUpdate(
    { _id: req.params.songRequestId, event: access.event },
    update,
    { new: true }
  ).populate('guest', 'name email group roles relationshipLabel visibilityGroup tableName');
  if (!songRequest) {
    const error = new Error('Solicitud no encontrada');
    error.statusCode = 404;
    throw error;
  }
  const event = await Event.findById(access.event).select('title externalContent');
  if (req.validated.body.status) {
    await notifyReviewStatus({
      guest: songRequest.guest,
      email: songRequest.requesterEmail,
      name: songRequest.requesterName,
      event,
      itemType: 'song',
      status: songRequest.status,
      itemTitle: [songRequest.title, songRequest.artist].filter(Boolean).join(' - '),
      settings: event?.externalContent?.moderationSettings || {}
    });
  }
  access.lastUsedAt = new Date();
  await access.save();
  res.json({ songRequest });
});

exports.addSong = asyncHandler(async (req, res) => {
  const access = await getActiveAccess(req.params.token);
  if (!hasPermission(access, 'song_review')) {
    const error = new Error('Este link no permite operar DJ');
    error.statusCode = 403;
    throw error;
  }
  const event = await Event.findById(access.event);
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const rawUrl = req.validated.body.sourceUrl || req.validated.body.url || req.validated.body.query || '';
  const cleanTitle = (req.validated.body.title || '').trim();
  const cleanArtist = (req.validated.body.artist || '').trim();
  const ytId = getYouTubeId(rawUrl);

  let sourceProvider = 'custom';
  let sourceUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
  let externalId = '';
  let thumbnailUrl = '';

  if (ytId) {
    sourceProvider = 'youtube';
    sourceUrl = `https://www.youtube.com/watch?v=${ytId}`;
    externalId = ytId;
    thumbnailUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }

  const songRequest = await SongRequest.create({
    owner: event.owner,
    event: event._id,
    requesterName: req.validated.body.requesterName || 'DJ (Cabina)',
    title: cleanTitle || (ytId ? 'Canción de YouTube' : (rawUrl || 'Canción agregada')),
    artist: cleanArtist || (ytId ? 'YouTube' : ''),
    dedication: req.validated.body.dedication || '',
    sourceProvider,
    sourceUrl,
    externalId,
    thumbnailUrl,
    status: 'approved',
    reviewedAt: new Date()
  });

  access.lastUsedAt = new Date();
  await access.save();
  res.status(201).json({ songRequest });
});
title: cleanTitle || (ytId ? 'Canción de YouTube' : (rawUrl || 'Canción agregada')),
  artist: cleanArtist || (ytId ? 'YouTube' : ''),
    dedication: req.validated.body.dedication || '',
      sourceProvider,
      sourceUrl,
      externalId,
      thumbnailUrl,
      status: 'approved',
        reviewedAt: new Date()
  });

access.lastUsedAt = new Date();
await access.save();
res.status(201).json({ songRequest });
});
