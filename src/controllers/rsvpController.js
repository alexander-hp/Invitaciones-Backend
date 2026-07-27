const Invitation = require('../models/Invitation');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Rsvp = require('../models/Rsvp');
const RsvpActivity = require('../models/RsvpActivity');
const emailService = require('../services/emailService');
const { assertEffectivePlanFeature } = require('../config/plans');
const asyncHandler = require('../utils/asyncHandler');

function normalizeEmail(email) {
  return email ? email.toLowerCase().trim() : '';
}

function normalizePhoneDigits(value) {
  return value ? String(value).replace(/\D/g, '') : '';
}

function payloadPhoneDigits(payload) {
  return normalizePhoneDigits(payload.phone || [payload.phoneCountryCode, payload.phoneNationalNumber].filter(Boolean).join(''));
}

function escapeCsv(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvResponse(res, filename, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}`);
}

function normalizePhone({ phone, phoneCountryCode, phoneNationalNumber }) {
  if (phone && !phoneCountryCode && !phoneNationalNumber) {
    const nationalNumber = normalizePhoneDigits(phone);
    return {
      phoneNationalNumber: nationalNumber,
      phoneE164: nationalNumber,
      phoneVerified: false,
      phoneVerificationStatus: 'not_started'
    };
  }
  if (!phoneCountryCode || !phoneNationalNumber) return {};
  const countryCode = phoneCountryCode.trim();
  const nationalNumber = phoneNationalNumber.replace(/\D/g, '');
  return {
    phoneCountryCode: countryCode,
    phoneNationalNumber: nationalNumber,
    phoneE164: `${countryCode}${nationalNumber}`,
    phoneVerified: false,
    phoneVerificationStatus: 'not_started'
  };
}

function getRsvpSettings(invitation) {
  const raw = invitation.rsvpSettings || {};
  return {
    deadline: raw.deadline,
    allowMaybe: raw.allowMaybe !== false,
    allowChangesUntilDeadline: raw.allowChangesUntilDeadline !== false,
    declineRequiresConfirmation: raw.declineRequiresConfirmation !== false,
    reminderDaysBeforeDeadline: raw.reminderDaysBeforeDeadline ?? 3,
    identityMethods: raw.identityMethods?.length ? raw.identityMethods : ['email', 'phone'],
    allowCompanionsDefault: raw.allowCompanionsDefault === true,
    defaultAllowedCompanions: Number(raw.defaultAllowedCompanions || 0),
    maxAttendees: raw.maxAttendees ? Number(raw.maxAttendees) : undefined,
    allowedGuestIds: (raw.allowedGuestIds || []).map(String),
    allowedRoles: (raw.allowedRoles || []).map((value) => String(value || '').toLowerCase().trim()).filter(Boolean),
    allowedGroups: (raw.allowedGroups || []).map((value) => String(value || '').trim()).filter(Boolean),
    allowedEmails: (raw.allowedEmails || []).map(normalizeEmail).filter(Boolean),
    allowedPhones: (raw.allowedPhones || []).map(normalizePhoneDigits).filter(Boolean),
    customQuestions: raw.customQuestions || []
  };
}

function snapshotRsvp(rsvp) {
  if (!rsvp) return undefined;
  return {
    response: rsvp.response,
    companions: rsvp.companions,
    mealPreference: rsvp.mealPreference,
    companionNames: rsvp.companionNames,
    attendingCount: rsvp.attendingCount,
    dietaryRestrictions: rsvp.dietaryRestrictions,
    menuSelection: rsvp.menuSelection,
    customAnswers: rsvp.customAnswers,
    message: rsvp.message,
    email: rsvp.email,
    phoneCountryCode: rsvp.phoneCountryCode,
    phoneNationalNumber: rsvp.phoneNationalNumber,
    phoneE164: rsvp.phoneE164,
    phoneVerificationStatus: rsvp.phoneVerificationStatus
  };
}

async function createRsvpActivity({ invitation, guest, rsvp, action, previous, next, metadata }) {
  await RsvpActivity.create({
    invitation: invitation?._id,
    event: invitation?.event || rsvp?.event || guest?.event,
    guest: guest?._id,
    rsvp: rsvp?._id,
    actorType: 'guest',
    action,
    previous,
    next,
    metadata
  });
}

function assertResponseAllowed(payload, settings) {
  if (payload.response === 'maybe' && !settings.allowMaybe) {
    const error = new Error('La opcion No estoy seguro no esta habilitada para esta invitacion');
    error.statusCode = 400;
    throw error;
  }
  if (payload.response === 'declined' && settings.declineRequiresConfirmation && !payload.declineConfirmed) {
    const error = new Error('Confirma que no asistiras antes de enviar tu respuesta');
    error.statusCode = 400;
    throw error;
  }
}

function assertCustomAnswers(payload, settings) {
  const questions = settings.customQuestions || [];
  if (!questions.length) return;
  const answersByKey = new Map((payload.customAnswers || []).map((answer) => [answer.key, answer]));

  for (const question of questions) {
    const key = question.key || question.label;
    const answer = answersByKey.get(key);
    if (question.required && (answer?.value === undefined || answer?.value === null || answer?.value === '')) {
      const error = new Error(`La pregunta "${question.label}" es obligatoria`);
      error.statusCode = 400;
      throw error;
    }
    if (question.type === 'select' && answer?.value && question.options?.length && !question.options.includes(String(answer.value))) {
      const error = new Error(`Respuesta invalida para "${question.label}"`);
      error.statusCode = 400;
      throw error;
    }
  }
}

function buildRsvpData({ invitation, guest, payload, emailNormalized }) {
  const isFinalAttendance = payload.response === 'confirmed';
  const companionNames = isFinalAttendance
    ? (payload.companionNames || []).map((name) => String(name || '').trim()).filter(Boolean)
    : [];
  const companions = isFinalAttendance ? Number(payload.companions || companionNames.length || 0) : 0;
  return {
    invitation: invitation._id,
    event: invitation.event,
    guest: guest?._id,
    name: guest?.name || payload.name,
    email: guest?.email || payload.email,
    emailNormalized: guest?.email ? normalizeEmail(guest.email) : emailNormalized,
    response: payload.response,
    companions,
    companionNames,
    attendingCount: isFinalAttendance ? 1 + companions : 0,
    mealPreference: isFinalAttendance ? payload.mealPreference : undefined,
    dietaryRestrictions: isFinalAttendance ? payload.dietaryRestrictions : undefined,
    menuSelection: isFinalAttendance ? payload.menuSelection : undefined,
    customAnswers: Array.isArray(payload.customAnswers) ? payload.customAnswers : [],
    message: payload.message,
    ...normalizePhone(payload)
  };
}

async function findExistingRsvp(invitation, guest, emailNormalized, phoneE164) {
  if (guest) {
    const byGuest = await Rsvp.findOne({ invitation: invitation._id, guest: guest._id });
    if (byGuest) return byGuest;
  }
  if (emailNormalized) {
    const byEmail = await Rsvp.findOne({ invitation: invitation._id, emailNormalized });
    if (byEmail) return byEmail;
  }
  if (phoneE164) {
    return Rsvp.findOne({ invitation: invitation._id, phoneE164 });
  }
  return null;
}

async function findExistingEventRsvp(event, guest, emailNormalized) {
  if (guest) {
    const byGuest = await Rsvp.findOne({ event: event._id, invitation: { $exists: false }, guest: guest._id });
    if (byGuest) return byGuest;
  }
  if (emailNormalized) {
    return Rsvp.findOne({ event: event._id, invitation: { $exists: false }, emailNormalized });
  }
  return null;
}

async function updateGuestStatus(guest, response) {
  if (!guest) return;
  const status = response === 'maybe' ? 'pending' : response;
  const update = { status };
  if (response === 'confirmed') update.communicationStatus = 'confirmed';
  await Guest.findByIdAndUpdate(guest._id, update);
}

async function saveRsvp({ invitation, guest, emailNormalized, rsvpData, settings }) {
  const existingRsvp = await findExistingRsvp(invitation, guest, emailNormalized, rsvpData.phoneE164);
  let rsvp;
  let statusCode = 201;
  let previousSnapshot;

  if (existingRsvp) {
    if (!settings.allowChangesUntilDeadline) {
      await createRsvpActivity({
        invitation,
        guest,
        rsvp: existingRsvp,
        action: 'blocked_duplicate',
        previous: snapshotRsvp(existingRsvp),
        metadata: { email: emailNormalized }
      });
      const error = new Error('Ya existe una respuesta para esta invitacion');
      error.statusCode = 409;
      throw error;
    }
    previousSnapshot = snapshotRsvp(existingRsvp);
    Object.assign(existingRsvp, rsvpData);
    rsvp = await existingRsvp.save();
    statusCode = 200;
    return { rsvp, statusCode, previousSnapshot };
  }

  try {
    rsvp = await Rsvp.create(rsvpData);
    return { rsvp, statusCode, previousSnapshot };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const duplicate = await findExistingRsvp(invitation, guest, emailNormalized, rsvpData.phoneE164);
    if (!duplicate || !settings.allowChangesUntilDeadline) {
      const conflict = new Error('Ya existe una respuesta para esta invitacion');
      conflict.statusCode = 409;
      throw conflict;
    }
    previousSnapshot = snapshotRsvp(duplicate);
    Object.assign(duplicate, rsvpData);
    rsvp = await duplicate.save();
    statusCode = 200;
    return { rsvp, statusCode, previousSnapshot };
  }
}

async function saveEventRsvp({ event, guest, emailNormalized, rsvpData }) {
  const existingRsvp = await findExistingEventRsvp(event, guest, emailNormalized);
  let rsvp;
  let statusCode = 201;
  let previousSnapshot;

  if (existingRsvp) {
    previousSnapshot = snapshotRsvp(existingRsvp);
    Object.assign(existingRsvp, rsvpData);
    rsvp = await existingRsvp.save();
    return { rsvp, statusCode: 200, previousSnapshot };
  }

  try {
    rsvp = await Rsvp.create(rsvpData);
    return { rsvp, statusCode, previousSnapshot };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const duplicate = await findExistingEventRsvp(event, guest, emailNormalized);
    if (!duplicate) throw error;
    previousSnapshot = snapshotRsvp(duplicate);
    Object.assign(duplicate, rsvpData);
    rsvp = await duplicate.save();
    statusCode = 200;
    return { rsvp, statusCode, previousSnapshot };
  }
}

async function findGuestByIdentity(eventId, payload, emailNormalized, phoneDigits) {
  if (payload.guest) {
    const guest = await Guest.findOne({ _id: payload.guest, event: eventId });
    if (!guest) {
      const error = new Error('Invitado no pertenece a esta invitacion');
      error.statusCode = 400;
      throw error;
    }
    return guest;
  }
  if (emailNormalized) {
    const guest = await Guest.findOne({ event: eventId, email: emailNormalized });
    if (guest) return guest;
  }
  if (!phoneDigits) return null;
  const candidates = await Guest.find({ event: eventId, phone: { $exists: true, $ne: '' } });
  return candidates.find((guest) => {
    const stored = normalizePhoneDigits(guest.phone);
    return stored && (stored.endsWith(phoneDigits) || phoneDigits.endsWith(stored));
  }) || null;
}

function assertIdentityAllowed(emailNormalized, phoneDigits, settings) {
  const acceptsEmail = settings.identityMethods.includes('email');
  const acceptsPhone = settings.identityMethods.includes('phone');
  if ((emailNormalized && acceptsEmail) || (phoneDigits && acceptsPhone)) return;
  const required = [acceptsEmail ? 'correo' : '', acceptsPhone ? 'telefono' : ''].filter(Boolean).join(' o ');
  const error = new Error(`Para confirmar esta invitacion necesitas ${required}`);
  error.statusCode = 400;
  throw error;
}

function guestMatchesSpecificRules(guest, settings) {
  if (!guest) return false;
  if (settings.allowedGuestIds.includes(String(guest._id))) return true;
  const email = normalizeEmail(guest.email);
  const phone = normalizePhoneDigits(guest.phone);
  const roles = (guest.roles || []).map((value) => String(value || '').toLowerCase().trim());
  const groups = [guest.group, guest.visibilityGroup].map((value) => String(value || '').trim()).filter(Boolean);
  return (
    (email && settings.allowedEmails.includes(email)) ||
    (phone && settings.allowedPhones.some((allowed) => phone.endsWith(allowed) || allowed.endsWith(phone))) ||
    roles.some((role) => settings.allowedRoles.includes(role)) ||
    groups.some((group) => settings.allowedGroups.includes(group))
  );
}

function allowedCompanionsFor(guest, settings) {
  if (guest && Number(guest.allowedCompanions || 0) > 0) return Number(guest.allowedCompanions || 0);
  return settings.allowCompanionsDefault ? Number(settings.defaultAllowedCompanions || 0) : 0;
}

async function assertInvitationCapacity(invitation, existingRsvp, nextAttendingCount, settings) {
  if (!settings.maxAttendees || nextAttendingCount <= 0) return;
  const confirmed = await Rsvp.find({
    invitation: invitation._id,
    response: 'confirmed',
    ...(existingRsvp?._id ? { _id: { $ne: existingRsvp._id } } : {})
  }).select('attendingCount companions');
  const currentTotal = confirmed.reduce((sum, rsvp) => sum + Number(rsvp.attendingCount || (1 + Number(rsvp.companions || 0))), 0);
  if (currentTotal + nextAttendingCount <= settings.maxAttendees) return;
  const error = new Error(`El cupo maximo de ${settings.maxAttendees} asistentes ya fue alcanzado`);
  error.statusCode = 409;
  throw error;
}

exports.submitPublic = asyncHandler(async (req, res) => {
  const payload = req.validated.body;
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).populate('owner', 'email name');
  if (!invitation) {
    const error = new Error('Invitacion no disponible');
    error.statusCode = 404;
    throw error;
  }

  const accessMode = invitation.accessMode || 'open';
  const settings = getRsvpSettings(invitation);
  const emailNormalized = normalizeEmail(payload.email);
  const phoneDigits = payloadPhoneDigits(payload);

  if (settings.deadline && new Date(settings.deadline) < new Date()) {
    await createRsvpActivity({ invitation, action: 'blocked_deadline', metadata: { email: emailNormalized } });
    const error = new Error('La fecha limite para responder esta vencida');
    error.statusCode = 409;
    throw error;
  }
  assertResponseAllowed(payload, settings);
  assertCustomAnswers(payload, settings);

  assertIdentityAllowed(emailNormalized, phoneDigits, settings);

  const guest = await findGuestByIdentity(invitation.event, payload, emailNormalized, phoneDigits);
  const privateAccess = accessMode === 'guest_list' || accessMode === 'specific_users';
  if (privateAccess && !guest) {
    const error = new Error('Invitado no autorizado para esta invitacion');
    error.statusCode = 403;
    throw error;
  }
  if (accessMode === 'specific_users' && !guestMatchesSpecificRules(guest, settings)) {
    const error = new Error('Esta invitacion esta disponible solo para usuarios especificos');
    error.statusCode = 403;
    throw error;
  }

  const requestedCompanions = Number(payload.companions || (payload.companionNames || []).filter(Boolean).length || 0);
  const allowedCompanions = allowedCompanionsFor(guest, settings);
  if (payload.response === 'confirmed' && requestedCompanions > allowedCompanions) {
    await createRsvpActivity({
      invitation,
      guest,
      action: 'blocked_capacity',
      metadata: { companions: requestedCompanions, allowedCompanions }
    });
    const error = new Error('El numero de acompanantes excede lo permitido');
    error.statusCode = 400;
    throw error;
  }

  const rsvpData = buildRsvpData({ invitation, guest, payload, emailNormalized });
  const existingRsvp = await findExistingRsvp(invitation, guest, emailNormalized, rsvpData.phoneE164);
  await assertInvitationCapacity(invitation, existingRsvp, rsvpData.attendingCount, settings);
  const { rsvp, statusCode, previousSnapshot } = await saveRsvp({ invitation, guest, emailNormalized, rsvpData, settings });

  await createRsvpActivity({
    invitation,
    guest,
    rsvp,
    action: statusCode === 200 ? 'updated' : payload.response,
    previous: previousSnapshot,
    next: snapshotRsvp(rsvp),
    metadata: { updated: statusCode === 200 }
  });

  await updateGuestStatus(guest, payload.response);

  if (invitation.owner?.email) {
    try {
      await emailService.sendRsvpNotification({ to: invitation.owner.email, invitation, rsvp });
    } catch (error) {
      console.warn('RSVP notification email failed:', error.message);
    }
  }

  res.status(statusCode).json({ rsvp, updated: statusCode === 200 });
});

exports.submitPublicEvent = asyncHandler(async (req, res) => {
  const payload = req.validated.body;
  const event = await Event.findOne({
    externalPortalSlug: req.params.portalSlug,
    mode: 'external_dashboard',
    externalPortalEnabled: { $ne: false },
    'externalPortalSettings.rsvpEnabled': { $ne: false }
  });
  if (!event) {
    const error = new Error('Portal RSVP no disponible');
    error.statusCode = 404;
    throw error;
  }

  const emailNormalized = normalizeEmail(payload.email);
  let guest = null;
  if (payload.guest) {
    guest = await Guest.findOne({ _id: payload.guest, event: event._id });
    if (!guest) {
      const error = new Error('Invitado no pertenece a este evento');
      error.statusCode = 400;
      throw error;
    }
  } else if (emailNormalized) {
    guest = await Guest.findOne({ event: event._id, email: emailNormalized });
  }

  if (!guest) {
    const error = new Error('Invitado no autorizado para este evento');
    error.statusCode = 403;
    throw error;
  }

  const requestedCompanions = Number(payload.companions || (payload.companionNames || []).filter(Boolean).length || 0);
  if (payload.response === 'confirmed' && requestedCompanions > guest.allowedCompanions) {
    const error = new Error('El numero de acompanantes excede lo permitido');
    error.statusCode = 400;
    throw error;
  }

  const isFinalAttendance = payload.response === 'confirmed';
  const companionNames = isFinalAttendance
    ? (payload.companionNames || []).map((name) => String(name || '').trim()).filter(Boolean)
    : [];
  const rsvpData = {
    event: event._id,
    guest: guest._id,
    name: guest.name || payload.name,
    email: guest.email || payload.email,
    emailNormalized: guest.email ? normalizeEmail(guest.email) : emailNormalized,
    response: payload.response,
    companions: isFinalAttendance ? Number(payload.companions || companionNames.length || 0) : 0,
    companionNames,
    attendingCount: isFinalAttendance ? 1 + Number(payload.companions || companionNames.length || 0) : 0,
    mealPreference: isFinalAttendance ? payload.mealPreference : undefined,
    dietaryRestrictions: isFinalAttendance ? payload.dietaryRestrictions : undefined,
    menuSelection: isFinalAttendance ? payload.menuSelection : undefined,
    customAnswers: Array.isArray(payload.customAnswers) ? payload.customAnswers : [],
    message: payload.message,
    ...normalizePhone(payload)
  };

  const { rsvp, statusCode, previousSnapshot } = await saveEventRsvp({ event, guest, emailNormalized, rsvpData });
  await createRsvpActivity({
    guest,
    rsvp,
    action: statusCode === 200 ? 'updated' : payload.response,
    previous: previousSnapshot,
    next: snapshotRsvp(rsvp),
    metadata: { portalSlug: event.externalPortalSlug, updated: statusCode === 200 }
  });
  await updateGuestStatus(guest, payload.response);
  res.status(statusCode).json({ rsvp, updated: statusCode === 200 });
});

exports.listByEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const rsvps = await Rsvp.find({ event: req.params.eventId }).sort('-createdAt');
  res.json({ rsvps });
});

exports.exportByEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id plan');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  assertEffectivePlanFeature(req.user, event, 'exportData', 'La exportacion de RSVP requiere Evento Individual o Pro');

  const rsvps = await Rsvp.find({ event: event._id }).sort('-createdAt').lean();
  const rows = [
    ['Nombre', 'Email', 'Telefono', 'Respuesta', 'Asistentes totales', 'Acompanantes', 'Nombres acompanantes', 'Comida', 'Menu', 'Restricciones', 'Respuestas personalizadas', 'Mensaje', 'Fecha'],
    ...rsvps.map((rsvp) => [
      rsvp.name,
      rsvp.email,
      rsvp.phoneE164,
      rsvp.response,
      rsvp.attendingCount || (rsvp.response === 'confirmed' ? 1 + Number(rsvp.companions || 0) : 0),
      rsvp.companions || 0,
      (rsvp.companionNames || []).join('; '),
      rsvp.mealPreference || '',
      rsvp.menuSelection || '',
      rsvp.dietaryRestrictions || '',
      (rsvp.customAnswers || []).map((answer) => `${answer.label || answer.key}: ${answer.value ?? ''}`).join('; '),
      rsvp.message || '',
      rsvp.createdAt ? new Date(rsvp.createdAt).toISOString() : ''
    ])
  ];

  csvResponse(res, `rsvps-${event._id}.csv`, rows);
});
