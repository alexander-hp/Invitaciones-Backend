const crypto = require('crypto');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const StaffAccessToken = require('../models/StaffAccessToken');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

function staffGuest(guest) {
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
    status: guest.status
  };
}

async function getActiveToken(token) {
  const access = await StaffAccessToken.findOne({ token, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
  if (!access) {
    const error = new Error('Link de check-in invalido o expirado');
    error.statusCode = 404;
    throw error;
  }
  return access;
}

exports.createLink = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id title');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const token = crypto.randomBytes(24).toString('hex');
  const days = Number(req.validated.body.days || 7);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const access = await StaffAccessToken.create({
    owner: req.user._id,
    event: event._id,
    token,
    label: req.validated.body.label,
    expiresAt
  });
  res.status(201).json({ token: access.token, expiresAt: access.expiresAt, url: `${env.clientUrl}/check-in/${access.token}` });
});

exports.session = asyncHandler(async (req, res) => {
  const access = await getActiveToken(req.params.token);
  const event = await Event.findById(access.event).select('title date venue');
  const guests = await Guest.find({ event: access.event }).select('name group tableName seatLabel allowedCompanions companions checkInCode checkedIn checkedInAt status').sort('name');
  access.lastUsedAt = new Date();
  await access.save();
  res.json({ event, guests: guests.map(staffGuest), expiresAt: access.expiresAt });
});

exports.checkIn = asyncHandler(async (req, res) => {
  const access = await getActiveToken(req.params.token);
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
  res.json({ guest: staffGuest(guest) });
});
