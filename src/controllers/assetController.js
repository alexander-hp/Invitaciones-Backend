const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

const s3 = new S3Client({ region: env.awsRegion });
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav']);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;

function assertMediaAllowed({ folder, contentType, size }) {
  const isImageFolder = ['covers', 'gallery', 'assets'].includes(folder);
  const isMusicFolder = folder === 'music';
  const allowedTypes = isMusicFolder ? AUDIO_TYPES : IMAGE_TYPES;
  const maxSize = isMusicFolder ? MAX_AUDIO_SIZE : MAX_IMAGE_SIZE;

  if (!isImageFolder && !isMusicFolder) {
    const error = new Error('Carpeta de asset no soportada');
    error.statusCode = 400;
    throw error;
  }
  if (!allowedTypes.has(contentType)) {
    const error = new Error(isMusicFolder ? 'Tipo de audio no soportado' : 'Tipo de imagen no soportado');
    error.statusCode = 400;
    throw error;
  }
  if (size && size > maxSize) {
    const error = new Error(isMusicFolder ? 'El audio excede 10MB' : 'La imagen excede 5MB');
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
