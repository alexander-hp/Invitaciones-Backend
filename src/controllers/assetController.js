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

  const { fileName, contentType, folder = 'assets' } = req.body;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `${folder}/${req.user._id}/${Date.now()}-${safeName}`;
  const command = new PutObjectCommand({ Bucket: env.s3Bucket, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const publicUrl = `https://${env.s3Bucket}.s3.${env.awsRegion}.amazonaws.com/${key}`;

  res.json({ key, uploadUrl, publicUrl });
});
