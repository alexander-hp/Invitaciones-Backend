require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || (nodeEnv === 'production' ? '' : 'dev_secret');

if (nodeEnv === 'production' && (!jwtSecret || jwtSecret === 'dev_secret')) {
  throw new Error('JWT_SECRET must be configured with a non-default value in production');
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:4200',
  frontendUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:4200',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/invitaciones',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:4200',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  s3Bucket: process.env.AWS_S3_BUCKET || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'Invitaciones <hola@tudominio.com>',
  emailTo: process.env.EMAIL_TO || process.env.emailAddress || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  smtpService: process.env.SMTP_SERVICE || '',
  smtpUser: process.env.SMTP_USER || process.env.emailAddress || '',
  smtpPass: process.env.SMTP_PASS || process.env.emailPssw || ''
};
