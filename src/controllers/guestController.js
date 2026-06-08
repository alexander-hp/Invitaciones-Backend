const readXlsxFile = require('read-excel-file/node');
const { parse } = require('csv-parse/sync');
const Guest = require('../models/Guest');
const Event = require('../models/Event');
const asyncHandler = require('../utils/asyncHandler');

function normalizeEmail(email) {
  return email ? String(email).toLowerCase().trim() : '';
}

function normalizePhone(phone) {
  return phone ? String(phone).trim().replace(/[\s().-]/g, '') : '';
}

function normalizeGuestPayload(payload) {
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  return {
    ...payload,
    name: String(payload.name || '').trim(),
    email: email || undefined,
    phone: phone || undefined,
    group: payload.group ? String(payload.group).trim() : undefined,
    allowedCompanions: Number(payload.allowedCompanions || 0)
  };
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
  const guests = await Guest.find({ owner: req.user._id, event: event._id }).sort('name');
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
  guest.allowedCompanions = payload.allowedCompanions;
  try {
    await guest.save();
  } catch (error) {
    throw buildDuplicateKeyError(error);
  }

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
  res.status(201).json({ imported: guests.length, invalidRows, duplicateRows: duplicates.length, duplicates, guests });
});
