const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

const s3 = new S3Client({ region: env.awsRegion });

exports.createUploadUrl = asyncHandler(async (req, res) => {
  if (!env.s3Bucket) {
    const error = new Error('AWS_S3_BUCKET no configurado');
    error.statusCode = 501;
    throw error;
  }

  const { fileName, contentType, folder = 'assets' } = req.validated.body;
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
  const publicUrl = `https://${env.s3Bucket}.s3.${env.awsRegion}.amazonaws.com/${key}`;

  res.json({ key, uploadUrl, publicUrl });
});
