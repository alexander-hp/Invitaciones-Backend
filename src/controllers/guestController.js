const readXlsxFile = require('read-excel-file/node');
const { parse } = require('csv-parse/sync');
const Guest = require('../models/Guest');
const Event = require('../models/Event');
const Invitation = require('../models/Invitation');
const Rsvp = require('../models/Rsvp');
const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');
const { getPlanLimits, assertPlanFeature } = require('../config/plans');
const asyncHandler = require('../utils/asyncHandler');
const whatsappService = require('../services/whatsappService');
const emailService = require('../services/emailService');
const env = require('../config/env');

function normalizeEmail(email) {
  return email ? String(email).toLowerCase().trim() : '';
}

function normalizePhone(phone) {
  return phone ? String(phone).trim().replace(/[\s().-]/g, '') : '';
}

function normalizeGuestPayload(payload) {
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const companions = Array.isArray(payload.companions)
    ? payload.companions
        .filter((companion) => companion?.name || companion?.seatLabel || companion?.tableName)
        .map((companion) => ({
          name: companion.name ? String(companion.name).trim() : undefined,
          tableName: companion.tableName ? String(companion.tableName).trim() : undefined,
          seatLabel: companion.seatLabel ? String(companion.seatLabel).trim() : undefined
        }))
    : undefined;
  return {
    ...payload,
    name: String(payload.name || '').trim(),
    email: email || undefined,
    phone: phone || undefined,
    group: payload.group ? String(payload.group).trim() : undefined,
    tableName: payload.tableName ? String(payload.tableName).trim() : undefined,
    seatLabel: payload.seatLabel ? String(payload.seatLabel).trim() : undefined,
    companions,
    allowedCompanions: Number(payload.allowedCompanions || 0)
  };
}

function companionRows(row) {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((index) => ({
    name: row[`acompanante${index}`] || row[`companion${index}`],
    tableName: row[`mesaAcompanante${index}`] || row[`companionTable${index}`],
    seatLabel: row[`asientoAcompanante${index}`] || row[`companionSeat${index}`]
  })).filter((companion) => companion.name || companion.tableName || companion.seatLabel);
}

function normalizeGuestRow(row, event, owner) {
  const name = row.name || row.nombre || row.Nombre;
  if (!name) return null;
  return normalizeGuestPayload({
    owner,
    event: event._id,
    name,
    email: row.email || row.correo || row.Correo || undefined,
    phone: row.phone || row.telefono || row.Telefono || undefined,
    group: row.group || row.grupo || row.Grupo || undefined,
    tableName: row.tableName || row.mesa || row.Mesa || undefined,
    seatLabel: row.seatLabel || row.asiento || row.Asiento || undefined,
    companions: companionRows(row),
    allowedCompanions: Number(row.allowedCompanions || row.acompanantes || row.Acompanantes || 0)
  });
}

function buildDuplicateError(duplicate, field) {
  const error = new Error('Este contacto ya esta registrado en la lista del evento. Puedes editar el invitado existente.');
  error.statusCode = 409;
  error.details = {
    field,
    guestId: duplicate?._id,
    guestName: duplicate?.name
  };
  return error;
}

function buildDuplicateKeyError(error) {
  if (error?.code !== 11000) return error;
  const key = error.keyPattern || error.keyValue || {};
  const field = key.phone ? 'phone' : 'email';
  return buildDuplicateError(null, field);
}

function buildDuplicateQuery({ owner, event, email, phone, excludeGuestId }) {
  const contactQueries = [];
  if (email) contactQueries.push({ email });
  if (phone) contactQueries.push({ phone });
  if (!contactQueries.length) return null;

  const query = { owner, event, $or: contactQueries };
  if (excludeGuestId) query._id = { $ne: excludeGuestId };
  return query;
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

function buildGuestFilters(query) {
  const filters = {};
  const search = String(query.search || '').trim();
  const status = String(query.status || '').trim();
  const communicationStatus = String(query.communicationStatus || '').trim();
  const group = String(query.group || '').trim();

  if (search) {
    const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filters.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }, { group: pattern }];
  }
  if (['pending', 'confirmed', 'declined'].includes(status)) filters.status = status;
  if (['pending', 'sent', 'delivered', 'read', 'opened', 'failed', 'confirmed'].includes(communicationStatus)) filters.communicationStatus = communicationStatus;
  if (group) filters.group = group;

  return filters;
}

function personalizedPublicUrl(invitation, guest) {
  const baseUrl = `${env.publicBaseUrl}/i/${invitation.slug}`;
  return guest.invitationToken ? `${baseUrl}?t=${encodeURIComponent(guest.invitationToken)}` : baseUrl;
}

async function findDuplicateGuest({ owner, event, email, phone, excludeGuestId }) {
  const query = buildDuplicateQuery({ owner, event, email, phone, excludeGuestId });
  if (!query) return null;

  const duplicate = await Guest.findOne(query).select('_id name email phone');
  if (!duplicate) return null;

  return {
    guest: duplicate,
    field: email && duplicate.email === email ? 'email' : 'phone'
  };
}

exports.list = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const guests = await Guest.find({ owner: req.user._id, event: event._id, ...buildGuestFilters(req.query) }).sort('name');
  res.json({ guests });
});

exports.create = asyncHandler(async (req, res) => {
  const payload = normalizeGuestPayload(req.validated.body);
  const event = await Event.findOne({ _id: payload.event, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const duplicate = await findDuplicateGuest({
    owner: req.user._id,
    event: event._id,
    email: payload.email,
    phone: payload.phone
  });
  if (duplicate) throw buildDuplicateError(duplicate.guest, duplicate.field);

  const limits = getPlanLimits(req.user);
  const currentGuests = await Guest.countDocuments({ owner: req.user._id, event: event._id });
  if (currentGuests >= limits.guests) {
    const error = new Error(`Tu plan permite hasta ${limits.guests} invitados por evento`);
    error.statusCode = 402;
    throw error;
  }

  let guest;
  try {
    guest = await Guest.create({ ...payload, owner: req.user._id, event: event._id });
  } catch (error) {
    throw buildDuplicateKeyError(error);
  }
  res.status(201).json({ guest });
});

exports.update = asyncHandler(async (req, res) => {
  const guest = await Guest.findOne({ _id: req.params.id, owner: req.user._id });
  if (!guest) {
    const error = new Error('Invitado no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const payload = normalizeGuestPayload({ ...guest.toObject(), ...req.validated.body });
  const duplicate = await findDuplicateGuest({
    owner: req.user._id,
    event: guest.event,
    email: payload.email,
    phone: payload.phone,
    excludeGuestId: guest._id
  });
  if (duplicate) throw buildDuplicateError(duplicate.guest, duplicate.field);

  guest.name = payload.name;
  guest.email = payload.email;
  guest.phone = payload.phone;
  guest.group = payload.group;
  guest.tableName = payload.tableName;
  guest.seatLabel = payload.seatLabel;
  guest.companions = payload.companions || [];
  guest.allowedCompanions = payload.allowedCompanions;
  try {
    await guest.save();
  } catch (error) {
    throw buildDuplicateKeyError(error);
  }

  res.json({ guest });
});

exports.remove = asyncHandler(async (req, res) => {
  const guest = await Guest.findOne({ _id: req.params.id, owner: req.user._id });
  if (!guest) {
    const error = new Error('Invitado no encontrado');
    error.statusCode = 404;
    throw error;
  }

  await Rsvp.updateMany({ guest: guest._id }, { $unset: { guest: '' } });
  await Guest.deleteOne({ _id: guest._id });
  res.json({ message: 'Invitado eliminado' });
});

exports.markCommunication = asyncHandler(async (req, res) => {
  const guest = await Guest.findOne({ _id: req.params.id, owner: req.user._id });
  if (!guest) {
    const error = new Error('Invitado no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const { communicationStatus, messageType, channel } = req.validated.body;
  guest.communicationStatus = communicationStatus;
  if (messageType) guest.lastMessageType = messageType;
  if (channel) guest.lastMessageChannel = channel;
  if (communicationStatus === 'sent') guest.lastMessageSentAt = new Date();
  await guest.save();

  res.json({ guest });
});

async function primaryInvitationForEvent(eventId, owner) {
  const published = await Invitation.findOne({ event: eventId, owner, status: 'published' }).sort('-publishedAt');
  if (published) return published;
  return Invitation.findOne({ event: eventId, owner }).sort('-createdAt');
}

function applyWhatsAppGuestStatus(guest, { status, type }) {
  guest.lastMessageType = type;
  guest.lastMessageChannel = 'whatsapp';
  if (status === 'sent') {
    guest.communicationStatus = 'sent';
    guest.lastMessageSentAt = new Date();
  } else if (status === 'delivered' || status === 'read' || status === 'failed') {
    guest.communicationStatus = status;
  }
}

function applyEmailGuestStatus(guest, { status, type, error }) {
  guest.lastMessageType = type;
  guest.lastMessageChannel = 'email';
  if (status === 'sent') {
    guest.communicationStatus = 'sent';
    guest.lastMessageSentAt = new Date();
    guest.lastMessageError = undefined;
  } else {
    guest.communicationStatus = 'failed';
    guest.lastMessageError = String(error || 'No se pudo enviar el correo').slice(0, 240);
  }
}

exports.whatsappStatus = asyncHandler(async (_req, res) => {
  res.json({
    provider: whatsappService.activeProvider(),
    fallbackProvider: whatsappService.fallbackProvider(),
    enabled: whatsappService.isEnabled(),
    fallbackEnabled: whatsappService.isFallbackEnabled(),
    openWaConfigured: whatsappService.isOpenWaConfigured(),
    metaConfigured: whatsappService.isMetaConfigured()
  });
});

exports.sendWhatsApp = asyncHandler(async (req, res) => {
  const guest = await Guest.findOne({ _id: req.params.id, owner: req.user._id });
  if (!guest) {
    const error = new Error('Invitado no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const event = await Event.findOne({ _id: guest.event, owner: req.user._id });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const invitation = await primaryInvitationForEvent(event._id, req.user._id);
  if (!invitation) {
    const error = new Error('Crea una invitacion antes de enviar WhatsApp');
    error.statusCode = 400;
    throw error;
  }

  const type = req.validated.body.messageType;
  const result = await whatsappService.sendMessage({
    owner: req.user._id,
    guest,
    event,
    invitation,
    type,
    text: req.validated.body.text,
    media: req.validated.body.media
  });
  applyWhatsAppGuestStatus(guest, { status: result.status, type });
  await guest.save();
  res.json({ guest, messageLog: result.log, provider: result.provider, status: result.status, manualText: result.manualText });
});

exports.sendEmail = asyncHandler(async (req, res) => {
  const guest = await Guest.findOne({ _id: req.params.id, owner: req.user._id });
  if (!guest) {
    const error = new Error('Invitado no encontrado');
    error.statusCode = 404;
    throw error;
  }
  if (!guest.email) {
    const error = new Error('El invitado no tiene email');
    error.statusCode = 400;
    throw error;
  }
  const event = await Event.findOne({ _id: guest.event, owner: req.user._id });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const invitation = await primaryInvitationForEvent(event._id, req.user._id);
  if (!invitation) {
    const error = new Error('Crea una invitacion antes de enviar email');
    error.statusCode = 400;
    throw error;
  }

  const type = req.validated.body.messageType || 'invitation';
  try {
    await emailService.sendGuestInvitationEmail({
      to: guest.email,
      guest,
      event,
      invitation,
      publicUrl: personalizedPublicUrl(invitation, guest),
      type
    });
    applyEmailGuestStatus(guest, { status: 'sent', type });
    await guest.save();
    res.json({ guest, status: 'sent' });
  } catch (error) {
    applyEmailGuestStatus(guest, { status: 'failed', type, error: error.message });
    await guest.save();
    throw error;
  }
});

exports.sendWhatsAppBulk = asyncHandler(async (req, res) => {
  if (!req.validated.body.confirm) {
    const error = new Error('Confirma el envio masivo antes de continuar');
    error.statusCode = 400;
    throw error;
  }
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const invitation = await primaryInvitationForEvent(event._id, req.user._id);
  if (!invitation) {
    const error = new Error('Crea una invitacion antes de enviar WhatsApp');
    error.statusCode = 400;
    throw error;
  }

  const filters = buildGuestFilters(req.validated.body.filters || {});
  const query = { owner: req.user._id, event: event._id, phone: { $exists: true, $ne: '' }, ...filters };
  if (req.validated.body.guestIds?.length) query._id = { $in: req.validated.body.guestIds };
  const guests = await Guest.find(query).sort('name').limit(200);
  const type = req.validated.body.messageType;
  const media = req.validated.body.media;
  const results = [];

  for (const guest of guests) {
    try {
      const result = await whatsappService.sendMessage({ owner: req.user._id, guest, event, invitation, type, media });
      applyWhatsAppGuestStatus(guest, { status: result.status, type });
      await guest.save();
      results.push({ guest: guest._id, status: result.status, provider: result.provider, log: result.log._id });
    } catch (error) {
      guest.communicationStatus = 'failed';
      guest.lastMessageType = type;
      guest.lastMessageChannel = 'whatsapp';
      await guest.save();
      results.push({ guest: guest._id, status: 'failed', error: error.message });
    }
  }

  res.json({
    provider: whatsappService.activeProvider(),
    requested: guests.length,
    sent: results.filter((item) => item.status === 'sent').length,
    skipped: results.filter((item) => item.status === 'skipped').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results
  });
});

exports.listWhatsAppLogs = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const logs = await WhatsAppMessageLog.find({ owner: req.user._id, event: event._id }).sort('-createdAt').limit(100);
  res.json({ logs });
});

exports.checkIn = asyncHandler(async (req, res) => {
  const code = String(req.validated.body.code || '').trim().toUpperCase();
  const guest = await Guest.findOne({ owner: req.user._id, checkInCode: code });
  if (!guest) {
    const error = new Error('Codigo de check-in no encontrado');
    error.statusCode = 404;
    throw error;
  }

  guest.checkedIn = true;
  guest.checkedInAt = guest.checkedInAt || new Date();
  await guest.save();
  res.json({ guest });
});

exports.importGuests = asyncHandler(async (req, res) => {
  if (!req.file) {
    const error = new Error('Archivo requerido');
    error.statusCode = 400;
    throw error;
  }
  const event = await Event.findOne({ _id: req.validated.body.event, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
  if (!['csv', 'xlsx'].includes(ext)) {
    const error = new Error('Formato de archivo no soportado');
    error.statusCode = 400;
    throw error;
  }

  let rows = [];
  if (ext === 'csv') {
    rows = parse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true });
  } else {
    const sheetRows = await readXlsxFile(req.file.buffer);
    const headers = (sheetRows[0] || []).map((header) => String(header || '').trim());
    rows = sheetRows.slice(1).map((values) => headers.reduce((item, header, index) => {
      item[header] = values[index];
      return item;
    }, {}));
  }

  const normalizedRows = rows.map((row, index) => ({ rowNumber: index + 2, guest: normalizeGuestRow(row, event, req.user._id) }));
  const payload = normalizedRows.filter((row) => row.guest).map((row) => row.guest);
  const invalidRows = rows.length - payload.length;

  const existingGuests = await Guest.find({ owner: req.user._id, event: event._id }).select('_id name email phone');
  const limits = getPlanLimits(req.user);
  if (existingGuests.length >= limits.guests) {
    const error = new Error(`Tu plan permite hasta ${limits.guests} invitados por evento`);
    error.statusCode = 402;
    throw error;
  }
  const existingByEmail = new Map(existingGuests.filter((guest) => guest.email).map((guest) => [guest.email, guest]));
  const existingByPhone = new Map(existingGuests.filter((guest) => guest.phone).map((guest) => [guest.phone, guest]));
  const seenByEmail = new Map();
  const seenByPhone = new Map();
  const duplicates = [];
  const guestsToCreate = [];

  for (const row of normalizedRows) {
    if (!row.guest) continue;
    const { guest } = row;
    const emailDuplicate = guest.email && (existingByEmail.get(guest.email) || seenByEmail.get(guest.email));
    const phoneDuplicate = guest.phone && (existingByPhone.get(guest.phone) || seenByPhone.get(guest.phone));
    const duplicate = emailDuplicate || phoneDuplicate;

    if (duplicate) {
      const field = emailDuplicate ? 'email' : 'phone';
      duplicates.push({
        row: row.rowNumber,
        field,
        value: field === 'email' ? guest.email : guest.phone,
        guestName: duplicate.name
      });
      continue;
    }

    if (existingGuests.length + guestsToCreate.length >= limits.guests) {
      duplicates.push({
        row: row.rowNumber,
        field: 'plan',
        value: String(limits.guests),
        guestName: 'Limite del plan'
      });
      continue;
    }

    guestsToCreate.push(guest);
    if (guest.email) seenByEmail.set(guest.email, guest);
    if (guest.phone) seenByPhone.set(guest.phone, guest);
  }

  let guests = [];
  try {
    guests = guestsToCreate.length ? await Guest.insertMany(guestsToCreate, { ordered: false }) : [];
  } catch (error) {
    throw buildDuplicateKeyError(error);
  }
  res.status(201).json({
    created: guests.length,
    updated: 0,
    skipped: invalidRows + duplicates.length,
    errors: invalidRows,
    imported: guests.length,
    invalidRows,
    duplicateRows: duplicates.length,
    duplicates,
    guests
  });
});

exports.exportGuests = asyncHandler(async (req, res) => {
  assertPlanFeature(req.user, 'exportData', 'La exportacion de datos requiere Evento Individual o Pro');
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id title');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const guests = await Guest.find({ owner: req.user._id, event: event._id, ...buildGuestFilters(req.query) }).sort('name').lean();
  const rsvps = await Rsvp.find({ event: event._id, guest: { $in: guests.map((guest) => guest._id) } }).lean();
  const rsvpByGuest = new Map(rsvps.map((rsvp) => [String(rsvp.guest), rsvp]));
  const rows = [
    ['Nombre', 'Email', 'Telefono', 'Grupo', 'Mesa', 'Asiento', 'Acompanantes nombrados', 'Check-in', 'Codigo QR', 'Token link', 'Link generado', 'Abierta en', 'Acompanantes permitidos', 'Estado invitado', 'Seguimiento', 'Ultimo mensaje', 'Canal', 'Enviado en', 'RSVP', 'Asistentes totales', 'Acompanantes RSVP', 'Nombres acompanantes', 'Comida', 'Menu', 'Restricciones', 'Respuestas personalizadas', 'Mensaje'],
    ...guests.map((guest) => {
      const rsvp = rsvpByGuest.get(String(guest._id));
      return [
        guest.name,
        guest.email,
        guest.phone,
        guest.group || 'General',
        guest.tableName || '',
        guest.seatLabel || '',
        (guest.companions || []).map((companion) => [companion.name, companion.tableName, companion.seatLabel].filter(Boolean).join(' / ')).join('; '),
        guest.checkedIn ? 'Si' : 'No',
        guest.checkInCode || '',
        guest.invitationToken || '',
        guest.personalizedLinkGeneratedAt ? new Date(guest.personalizedLinkGeneratedAt).toISOString() : '',
        guest.invitationOpenedAt ? new Date(guest.invitationOpenedAt).toISOString() : '',
        guest.allowedCompanions || 0,
        guest.status,
        guest.communicationStatus || 'pending',
        guest.lastMessageType || '',
        guest.lastMessageChannel || '',
        guest.lastMessageSentAt ? new Date(guest.lastMessageSentAt).toISOString() : '',
        rsvp?.response || '',
        rsvp?.attendingCount || '',
        rsvp?.companions || 0,
        (rsvp?.companionNames || []).join('; '),
        rsvp?.mealPreference || '',
        rsvp?.menuSelection || '',
        rsvp?.dietaryRestrictions || '',
        (rsvp?.customAnswers || []).map((answer) => `${answer.label || answer.key}: ${answer.value ?? ''}`).join('; '),
        rsvp?.message || ''
      ];
    })
  ];

  csvResponse(res, `invitados-${event._id}.csv`, rows);
});
