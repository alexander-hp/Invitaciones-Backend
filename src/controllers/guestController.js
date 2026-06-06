const readXlsxFile = require('read-excel-file/node');
const { parse } = require('csv-parse/sync');
const Guest = require('../models/Guest');
const Event = require('../models/Event');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const guests = await Guest.find({ owner: req.user._id, event: req.params.eventId }).sort('name');
  res.json({ guests });
});

exports.create = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.body.event, owner: req.user._id });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const guest = await Guest.create({ ...req.body, owner: req.user._id });
  res.status(201).json({ guest });
});

exports.importGuests = asyncHandler(async (req, res) => {
  if (!req.file) {
    const error = new Error('Archivo requerido');
    error.statusCode = 400;
    throw error;
  }
  const event = await Event.findOne({ _id: req.body.event, owner: req.user._id });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
  let rows = [];
  if (ext === 'csv') {
    rows = parse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true });
  } else {
    const sheetRows = await readXlsxFile(req.file.buffer);
    const headers = (sheetRows[0] || []).map((header) => String(header || '').trim());
    rows = sheetRows.slice(1).map((values) => headers.reduce((item, header, index) => {
      item[header] = values[index];
      return item;
    }, {}));
  }

  const payload = rows.map((row) => ({
    owner: req.user._id,
    event: event._id,
    name: row.name || row.nombre || row.Nombre,
    email: row.email || row.correo || row.Correo,
    phone: row.phone || row.telefono || row.Telefono,
    group: row.group || row.grupo,
    allowedCompanions: Number(row.allowedCompanions || row.acompanantes || 0)
  })).filter((guest) => guest.name);

  const guests = payload.length ? await Guest.insertMany(payload) : [];
  res.status(201).json({ imported: guests.length, guests });
});
