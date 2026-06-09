const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const AlbumAsset = require('../models/AlbumAsset');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Invitation = require('../models/Invitation');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

const s3 = new S3Client({ region: env.awsRegion });
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

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
  const key = `album/${ownerId}/${eventId}/${Date.now()}-${safeName}`;
  await s3.send(new PutObjectCommand({ Bucket: env.s3Bucket, Key: key, ContentType: file.mimetype, Body: file.buffer }));
  return { key, url: buildPublicUrl(key) };
}

exports.uploadPublic = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).select('owner event content');
  if (!invitation || !invitation.content?.privateAlbumEnabled) {
    const error = new Error('Album no disponible');
    error.statusCode = 404;
    throw error;
  }

  let guest = null;
  const email = req.body.email ? String(req.body.email).toLowerCase().trim() : '';
  if (req.body.guest) {
    guest = await Guest.findOne({ _id: req.body.guest, event: invitation.event }).select('_id name email');
  } else if (email) {
    guest = await Guest.findOne({ email, event: invitation.event }).select('_id name email');
  }

  const upload = await uploadAlbumFile(req.file, invitation.owner, invitation.event);
  const asset = await AlbumAsset.create({
    owner: invitation.owner,
    event: invitation.event,
    invitation: invitation._id,
    guest: guest?._id,
    uploaderName: req.body.name || guest?.name,
    uploaderEmail: email || guest?.email,
    key: upload.key,
    url: upload.url
  });

  res.status(201).json({ asset: { id: asset._id, status: asset.status } });
});

exports.list = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const assets = await AlbumAsset.find({ owner: req.user._id, event: event._id }).sort('-createdAt');
  res.json({ assets });
});

exports.publicApproved = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).select('_id content');
  if (!invitation || !invitation.content?.privateAlbumEnabled) {
    const error = new Error('Album no disponible');
    error.statusCode = 404;
    throw error;
  }
  const assets = await AlbumAsset.find({ invitation: invitation._id, status: 'approved' })
    .select('url uploaderName createdAt')
    .sort('-createdAt')
    .limit(100);
  res.json({ assets });
});

exports.update = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const asset = await AlbumAsset.findOneAndUpdate(
    { _id: req.params.assetId, owner: req.user._id, event: event._id },
    { status: req.validated.body.status, reviewedAt: new Date() },
    { new: true }
  );
  if (!asset) {
    const error = new Error('Foto no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ asset });
});
