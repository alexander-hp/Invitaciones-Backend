const Invitation = require('../models/Invitation');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Rsvp = require('../models/Rsvp');
const RsvpActivity = require('../models/RsvpActivity');
const emailService = require('../services/emailService');
const { assertPlanFeature } = require('../config/plans');
const asyncHandler = require('../utils/asyncHandler');

function normalizeEmail(email) {
  return email ? email.toLowerCase().trim() : '';
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

function normalizePhone({ phoneCountryCode, phoneNationalNumber }) {
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
  return {
    deadline: invitation.rsvpSettings?.deadline,
    allowMaybe: invitation.rsvpSettings?.allowMaybe !== false,
    allowChangesUntilDeadline: invitation.rsvpSettings?.allowChangesUntilDeadline !== false,
    declineRequiresConfirmation: invitation.rsvpSettings?.declineRequiresConfirmation !== false,
    reminderDaysBeforeDeadline: invitation.rsvpSettings?.reminderDaysBeforeDeadline ?? 3,
    customQuestions: invitation.rsvpSettings?.customQuestions || []
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
    invitation: invitation._id,
    event: invitation.event,
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

async function findExistingRsvp(invitation, guest, emailNormalized) {
  if (guest) {
    const byGuest = await Rsvp.findOne({ invitation: invitation._id, guest: guest._id });
    if (byGuest) return byGuest;
  }
  if (emailNormalized) {
    return Rsvp.findOne({ invitation: invitation._id, emailNormalized });
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
  const existingRsvp = await findExistingRsvp(invitation, guest, emailNormalized);
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
    const duplicate = await findExistingRsvp(invitation, guest, emailNormalized);
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

  if (settings.deadline && new Date(settings.deadline) < new Date()) {
    await createRsvpActivity({ invitation, action: 'blocked_deadline', metadata: { email: emailNormalized } });
    const error = new Error('La fecha limite para responder esta vencida');
    error.statusCode = 409;
    throw error;
  }
  assertResponseAllowed(payload, settings);
  assertCustomAnswers(payload, settings);

  if (accessMode === 'open' && !emailNormalized) {
    const error = new Error('El email es obligatorio para confirmar asistencia');
    error.statusCode = 400;
    throw error;
  }

  let guest = null;
  if (payload.guest) {
    guest = await Guest.findOne({ _id: payload.guest, event: invitation.event });
    if (!guest) {
      const error = new Error('Invitado no pertenece a esta invitacion');
      error.statusCode = 400;
      throw error;
    }
  } else if (emailNormalized) {
    guest = await Guest.findOne({ event: invitation.event, email: emailNormalized });
  }

  if (accessMode === 'guest_list' && !guest) {
    const error = new Error('Invitado no autorizado para esta invitacion');
    error.statusCode = 403;
    throw error;
  }

  const requestedCompanions = Number(payload.companions || (payload.companionNames || []).filter(Boolean).length || 0);
  if (payload.response === 'confirmed' && guest && requestedCompanions > guest.allowedCompanions) {
    await createRsvpActivity({
      invitation,
      guest,
      action: 'blocked_capacity',
      metadata: { companions: requestedCompanions, allowedCompanions: guest.allowedCompanions }
    });
    const error = new Error('El numero de acompanantes excede lo permitido');
    error.statusCode = 400;
    throw error;
  }

  const rsvpData = buildRsvpData({ invitation, guest, payload, emailNormalized });
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
  assertPlanFeature(req.user, 'exportData', 'La exportacion de RSVP requiere Evento Individual o Pro');
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

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
