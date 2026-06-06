const readXlsxFile = require('read-excel-file/node');
const { parse } = require('csv-parse/sync');
const Guest = require('../models/Guest');
const Event = require('../models/Event');
const asyncHandler = require('../utils/asyncHandler');

function normalizeGuestRow(row, event, owner) {
  const name = row.name || row.nombre || row.Nombre;
  if (!name) return null;
  return {
    owner,
    event: event._id,
    name,
    email: row.email || row.correo || row.Correo || undefined,
    phone: row.phone || row.telefono || row.Telefono || undefined,
    group: row.group || row.grupo || row.Grupo || undefined,
    allowedCompanions: Number(row.allowedCompanions || row.acompanantes || row.Acompanantes || 0)
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
  const payload = req.validated.body;
  const event = await Event.findOne({ _id: payload.event, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const guest = await Guest.create({ ...payload, owner: req.user._id, event: event._id });
  res.status(201).json({ guest });
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

  const payload = rows.map((row) => normalizeGuestRow(row, event, req.user._id)).filter(Boolean);
  const invalidRows = rows.length - payload.length;
  const guests = payload.length ? await Guest.insertMany(payload, { ordered: false }) : [];
  res.status(201).json({ imported: guests.length, invalidRows, guests });
});