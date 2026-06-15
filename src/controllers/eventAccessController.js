const AlbumAsset = require('../models/AlbumAsset');
const Event = require('../models/Event');
const EventAccessToken = require('../models/EventAccessToken');
const EventTable = require('../models/EventTable');
const Guest = require('../models/Guest');
const Rsvp = require('../models/Rsvp');
const asyncHandler = require('../utils/asyncHandler');

const ROLE_PERMISSIONS = {
  check_in: ['check_in'],
  album_review: ['album_review'],
  client_view: ['client_view'],
  guest_ops: ['check_in', 'album_review', 'client_view', 'guest_ops']
};

function hasPermission(access, permission) {
  return ROLE_PERMISSIONS[access.role]?.includes(permission);
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

exports.session = asyncHandler(async (req, res) => {
  const access = await getActiveAccess(req.params.token);
  const [event, guests, rsvps, tables, albumAssets] = await Promise.all([
    Event.findById(access.event).select('title type date venue mode externalSiteUrl externalSiteLabel externalPortalSlug'),
    hasPermission(access, 'check_in') || hasPermission(access, 'client_view') ? Guest.find({ event: access.event }).sort('name') : [],
    hasPermission(access, 'client_view') ? Rsvp.find({ event: access.event }).sort('-createdAt').limit(200) : [],
    hasPermission(access, 'client_view') ? EventTable.find({ event: access.event }).sort('order name') : [],
    hasPermission(access, 'album_review') ? AlbumAsset.find({ event: access.event }).sort('-createdAt').limit(100) : []
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
  access.lastUsedAt = new Date();
  await access.save();
  res.json({ asset });
});
