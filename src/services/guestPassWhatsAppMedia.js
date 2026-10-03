const jwt = require('jsonwebtoken');
const env = require('../config/env');

function passApiBaseUrl() {
  const configuredBase = env.openWaMediaBaseUrl || env.apiPublicBaseUrl;
  if (!configuredBase && env.nodeEnv === 'production') {
    const error = new Error('Configura OPENWA_MEDIA_BASE_URL con la URL del backend accesible desde OpenWA.');
    error.statusCode = 503;
    throw error;
  }
  let base = (configuredBase || `http://host.docker.internal:${env.port}/api`).replace(/\/+$/, '');
  if (env.nodeEnv !== 'production') {
    base = base.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/i, '$1host.docker.internal');
  }
  if (!/^https?:\/\//.test(base)) {
    const error = new Error('OPENWA_MEDIA_BASE_URL debe ser una URL HTTP o HTTPS válida.');
    error.statusCode = 503;
    throw error;
  }
  return base.endsWith('/api') ? base : `${base}/api`;
}

function buildGuestPassWhatsAppMedia({ guest, event, invitation }) {
  const token = jwt.sign({
    purpose: 'whatsapp-pass-image',
    guestId: String(guest._id),
    eventId: String(event._id),
    invitationId: invitation?._id ? String(invitation._id) : undefined
  }, env.jwtSecret, { audience: 'whatsapp-pass-image', expiresIn: '10m' });
  return {
    type: 'image',
    url: `${passApiBaseUrl()}/guests/whatsapp-pass/${encodeURIComponent(token)}/pase.png`,
    mimetype: 'image/png',
    filename: `pase-${guest._id}.png`
  };
}

function verifyGuestPassToken(token) {
  const payload = jwt.verify(token, env.jwtSecret, { audience: 'whatsapp-pass-image' });
  if (payload.purpose !== 'whatsapp-pass-image' || !payload.guestId || !payload.eventId) {
    throw new Error('Token de pase inválido');
  }
  return payload;
}

module.exports = { buildGuestPassWhatsAppMedia, verifyGuestPassToken };
