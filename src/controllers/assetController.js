const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');
const { getPlanLimits, assertPlanFeature } = require('../config/plans');
const Event = require('../models/Event');
const WhatsAppMediaAsset = require('../models/WhatsAppMediaAsset');
const asyncHandler = require('../utils/asyncHandler');

const s3 = new S3Client({ region: env.awsRegion });
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const DOCUMENT_TYPES = new Set(['application/pdf']);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

function whatsappMediaTypeForContentType(contentType) {
  if (IMAGE_TYPES.has(contentType)) return 'image';
  if (VIDEO_TYPES.has(contentType)) return 'video';
  if (AUDIO_TYPES.has(contentType)) return 'audio';
  if (DOCUMENT_TYPES.has(contentType)) return 'document';
  return '';
}

function assertMediaAllowed({ folder, contentType, size }) {
  const isImageFolder = ['covers', 'gallery', 'assets'].includes(folder);
  const isMusicFolder = folder === 'music';
  const isWhatsAppFolder = folder === 'whatsapp-media';
  const whatsappMediaType = whatsappMediaTypeForContentType(contentType);
  const allowedTypes = isMusicFolder ? AUDIO_TYPES : isWhatsAppFolder ? null : IMAGE_TYPES;
  const maxSize = isMusicFolder
    ? MAX_AUDIO_SIZE
    : isWhatsAppFolder && whatsappMediaType === 'video'
      ? MAX_VIDEO_SIZE
      : isWhatsAppFolder && whatsappMediaType === 'audio'
        ? MAX_AUDIO_SIZE
        : isWhatsAppFolder && whatsappMediaType === 'document'
          ? MAX_DOCUMENT_SIZE
          : MAX_IMAGE_SIZE;

  if (!isImageFolder && !isMusicFolder && !isWhatsAppFolder) {
    const error = new Error('Carpeta de asset no soportada');
    error.statusCode = 400;
    throw error;
  }
  if (isWhatsAppFolder ? !whatsappMediaType : !allowedTypes.has(contentType)) {
    const error = new Error(isMusicFolder ? 'Tipo de audio no soportado' : isWhatsAppFolder ? 'Tipo de media WhatsApp no soportado' : 'Tipo de imagen no soportado');
    error.statusCode = 400;
    throw error;
  }
  if (size && size > maxSize) {
    const error = new Error(
      isMusicFolder
        ? 'El audio excede 10MB'
        : isWhatsAppFolder && whatsappMediaType === 'video'
          ? 'El video excede 25MB'
          : isWhatsAppFolder && whatsappMediaType === 'audio'
            ? 'El audio excede 10MB'
            : isWhatsAppFolder && whatsappMediaType === 'document'
              ? 'El documento excede 10MB'
              : 'La imagen excede 5MB'
    );
    error.statusCode = 400;
    throw error;
  }
}

function buildPublicUrl(key) {
  const baseUrl = env.mediaPublicBaseUrl;
  if (baseUrl) return `${baseUrl.replace(/\/$/, '')}/${key}`;
  return `https://${env.s3Bucket}.s3.${env.awsRegion}.amazonaws.com/${key}`;
}

exports.createUploadUrl = asyncHandler(async (req, res) => {
  if (!env.s3Bucket) {
    const error = new Error('AWS_S3_BUCKET no configurado');
    error.statusCode = 501;
    throw error;
  }

  const { fileName, contentType, folder = 'assets', size } = req.validated.body;
  assertMediaAllowed({ folder, contentType, size });
  const limits = getPlanLimits(req.user);
  if (folder === 'music' && !limits.music) {
    const error = new Error('La musica requiere Evento Individual o Pro');
    error.statusCode = 402;
    throw error;
  }
  if (folder === 'whatsapp-media') {
    assertPlanFeature(req.user, 'whatsappMedia', 'La media para WhatsApp requiere Evento Individual o Pro');
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `${folder}/${req.user._id}/${Date.now()}-${safeName}`;
  const command = new PutObjectCommand({ Bucket: env.s3Bucket, Key: key, ContentType: contentType });
  let uploadUrl;
  try {
    uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  } catch (error) {
    console.warn('S3 presigned URL failed:', {
      bucketConfigured: Boolean(env.s3Bucket),
      region: env.awsRegion,
      code: error.code,
      message: error.message
    });
    const signingError = new Error('No se pudo preparar la subida a S3. Revisa region, bucket y credenciales AWS.');
    signingError.statusCode = 502;
    throw signingError;
  }

  res.json({ key, uploadUrl, publicUrl: buildPublicUrl(key) });
});

exports.createWhatsAppMedia = asyncHandler(async (req, res) => {
  assertPlanFeature(req.user, 'whatsappMedia', 'La media para WhatsApp requiere Evento Individual o Pro');
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const payload = req.validated.body;
  const asset = await WhatsAppMediaAsset.create({
    owner: req.user._id,
    event: event._id,
    key: payload.key,
    url: payload.url,
    type: payload.type,
    fileName: payload.fileName,
    mimetype: payload.mimetype,
    size: payload.size,
    caption: payload.caption
  });

  res.status(201).json({ asset });
});

exports.listWhatsAppMedia = asyncHandler(async (req, res) => {
  assertPlanFeature(req.user, 'whatsappMedia', 'La media para WhatsApp requiere Evento Individual o Pro');
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const assets = await WhatsAppMediaAsset.find({ owner: req.user._id, event: event._id, active: true }).sort('-createdAt');
  res.json({ assets });
});

exports.deleteWhatsAppMedia = asyncHandler(async (req, res) => {
  assertPlanFeature(req.user, 'whatsappMedia', 'La media para WhatsApp requiere Evento Individual o Pro');
  const asset = await WhatsAppMediaAsset.findOneAndUpdate(
    { _id: req.params.assetId, event: req.params.eventId, owner: req.user._id },
    { active: false },
    { new: true }
  );
  if (!asset) {
    const error = new Error('Media WhatsApp no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ asset });
});
