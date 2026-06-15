const jwt = require('jsonwebtoken');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const env = require('../config/env');

const GUEST_SESSION_AUDIENCE = 'external_guest';
const GUEST_SESSION_EXPIRES_IN = '7d';

function signGuestSession(event, guest, portalSlug) {
  return jwt.sign(
    {
      event: String(event._id || event),
      guest: String(guest._id || guest),
      portalSlug
    },
    env.jwtSecret,
    { expiresIn: GUEST_SESSION_EXPIRES_IN, audience: GUEST_SESSION_AUDIENCE }
  );
}

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function verifyGuestSession(req, portalSlug) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Sesion de invitado requerida');
    error.statusCode = 401;
    throw error;
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { audience: GUEST_SESSION_AUDIENCE });
  } catch (_error) {
    const error = new Error('Sesion de invitado invalida o expirada');
    error.statusCode = 401;
    throw error;
  }

  if (payload.portalSlug !== portalSlug) {
    const error = new Error('Sesion no pertenece a este portal');
    error.statusCode = 403;
    throw error;
  }

  const event = await Event.findOne({
    _id: payload.event,
    externalPortalSlug: portalSlug,
    mode: 'external_dashboard',
    externalPortalEnabled: { $ne: false }
  });
  if (!event) {
    const error = new Error('Portal externo no disponible');
    error.statusCode = 404;
    throw error;
  }

  const guest = await Guest.findOne({ _id: payload.guest, event: event._id });
  if (!guest) {
    const error = new Error('Invitado no pertenece a este evento');
    error.statusCode = 403;
    throw error;
  }

  return { event, guest };
}

module.exports = { signGuestSession, verifyGuestSession };
