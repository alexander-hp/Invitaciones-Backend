const Event = require('../models/Event');
const EventTable = require('../models/EventTable');
const Guest = require('../models/Guest');
const { assertEffectivePlanFeature } = require('../config/plans');
const asyncHandler = require('../utils/asyncHandler');

function seatCount(guest) {
  return 1 + Math.max(Number(guest.allowedCompanions || 0), Array.isArray(guest.companions) ? guest.companions.length : 0);
}

async function assertEventOwner(eventId, owner) {
  const event = await Event.findOne({ _id: eventId, owner }).select('_id title plan');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  return event;
}

async function tableSummary(owner, eventId) {
  const [tables, guests] = await Promise.all([
    EventTable.find({ owner, event: eventId }).sort('order name').lean(),
    Guest.find({ owner, event: eventId }).select('name group tableName seatLabel allowedCompanions companions checkedIn').sort('name').lean()
  ]);

  return tables.map((table) => {
    const assignedGuests = guests.filter((guest) => (guest.tableName || '').trim().toLowerCase() === table.name.trim().toLowerCase());
    const occupied = assignedGuests.reduce((total, guest) => total + seatCount(guest), 0);
    return {
      ...table,
      occupied,
      available: table.capacity - occupied,
      overCapacity: occupied > table.capacity,
      guests: assignedGuests.map((guest) => ({
        id: guest._id,
        name: guest.name,
        group: guest.group,
        seatLabel: guest.seatLabel,
        seats: seatCount(guest),
        checkedIn: guest.checkedIn
      }))
    };
  });
}

exports.list = asyncHandler(async (req, res) => {
  const event = await assertEventOwner(req.params.eventId, req.user._id);
  assertEffectivePlanFeature(req.user, event, 'seating', 'La gestion de mesas requiere Evento Individual o Pro');
  const tables = await tableSummary(req.user._id, event._id);
  res.json({ tables });
});

exports.create = asyncHandler(async (req, res) => {
  const event = await assertEventOwner(req.params.eventId, req.user._id);
  assertEffectivePlanFeature(req.user, event, 'seating', 'La gestion de mesas requiere Evento Individual o Pro');
  const table = await EventTable.create({ ...req.validated.body, owner: req.user._id, event: event._id });
  res.status(201).json({ table });
});

exports.update = asyncHandler(async (req, res) => {
  const event = await assertEventOwner(req.params.eventId, req.user._id);
  assertEffectivePlanFeature(req.user, event, 'seating', 'La gestion de mesas requiere Evento Individual o Pro');
  const table = await EventTable.findOneAndUpdate(
    { _id: req.params.tableId, owner: req.user._id, event: req.params.eventId },
    req.validated.body,
    { new: true }
  );
  if (!table) {
    const error = new Error('Mesa no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ table });
});

exports.remove = asyncHandler(async (req, res) => {
  const event = await assertEventOwner(req.params.eventId, req.user._id);
  assertEffectivePlanFeature(req.user, event, 'seating', 'La gestion de mesas requiere Evento Individual o Pro');
  const table = await EventTable.findOneAndDelete({ _id: req.params.tableId, owner: req.user._id, event: req.params.eventId });
  if (!table) {
    const error = new Error('Mesa no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ message: 'Mesa eliminada' });
});
