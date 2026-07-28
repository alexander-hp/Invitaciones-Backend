const Event = require('../models/Event');
const EventTable = require('../models/EventTable');
const Guest = require('../models/Guest');
const { assertEffectivePlanFeature } = require('../config/plans');
const asyncHandler = require('../utils/asyncHandler');

function seatCount(guest) {
  return 1 + Math.max(Number(guest.allowedCompanions || 0), Array.isArray(guest.companions) ? guest.companions.length : 0);
}

function normalizeTableName(value) {
  return String(value || '').trim().toLowerCase();
}

function sortGuestsForStrategy(guests, strategy) {
  const sorted = [...guests];
  if (strategy === 'by_group') {
    sorted.sort((a, b) => {
      const groupCompare = String(a.group || '').localeCompare(String(b.group || ''));
      if (groupCompare !== 0) return groupCompare;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return sorted;
  }
  sorted.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return sorted;
}

function buildOccupancy(tables, guests) {
  const occupancy = new Map();
  tables.forEach((table) => {
    occupancy.set(normalizeTableName(table.name), {
      table,
      occupied: 0,
      nextSeat: 1
    });
  });

  guests.forEach((guest) => {
    const key = normalizeTableName(guest.tableName);
    const current = occupancy.get(key);
    if (!current) return;
    const seats = seatCount(guest);
    current.occupied += seats;
    const numericSeat = Number(guest.seatLabel);
    if (Number.isFinite(numericSeat) && numericSeat >= current.nextSeat) {
      current.nextSeat = numericSeat + seats;
    } else {
      current.nextSeat += seats;
    }
  });

  return occupancy;
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

exports.autoAssign = asyncHandler(async (req, res) => {
  const event = await assertEventOwner(req.params.eventId, req.user._id);
  assertEffectivePlanFeature(req.user, event, 'seating', 'La gestion de mesas requiere Evento Individual o Pro');

  const {
    strategy = 'fill_order',
    includeStatuses = ['confirmed'],
    overwrite = false
  } = req.validated.body || {};

  const [tables, allGuests] = await Promise.all([
    EventTable.find({ owner: req.user._id, event: event._id }).sort('order name createdAt'),
    Guest.find({ owner: req.user._id, event: event._id }).sort('group name')
  ]);

  if (!tables.length) {
    return res.status(400).json({ message: 'Crea al menos una mesa antes de autoasignar invitados.' });
  }

  const occupancy = buildOccupancy(tables, overwrite ? [] : allGuests);
  const guests = sortGuestsForStrategy(
    allGuests.filter((guest) => {
      if (!includeStatuses.includes(guest.status)) return false;
      if (!overwrite && guest.tableName) return false;
      return true;
    }),
    strategy
  );

  const groupPreferredTable = new Map();
  allGuests.forEach((guest) => {
    if (guest.group && guest.tableName) groupPreferredTable.set(String(guest.group).trim().toLowerCase(), normalizeTableName(guest.tableName));
  });

  const assigned = [];
  const skipped = [];
  const updates = [];

  guests.forEach((guest) => {
    const seats = seatCount(guest);
    const groupKey = String(guest.group || '').trim().toLowerCase();
    const preferredKey = strategy === 'by_group' && groupKey ? groupPreferredTable.get(groupKey) : null;
    const preferred = preferredKey ? occupancy.get(preferredKey) : null;
    const candidates = preferred ? [preferred, ...Array.from(occupancy.values()).filter((item) => item !== preferred)] : Array.from(occupancy.values());
    const target = candidates.find((item) => item.occupied + seats <= item.table.capacity);

    if (!target) {
      skipped.push({
        guest: { id: guest._id, name: guest.name, group: guest.group, seats },
        reason: 'Sin mesa con capacidad suficiente'
      });
      return;
    }

    const firstSeat = target.nextSeat;
    target.occupied += seats;
    target.nextSeat += seats;
    if (groupKey) groupPreferredTable.set(groupKey, normalizeTableName(target.table.name));

    guest.tableName = target.table.name;
    guest.seatLabel = String(firstSeat);
    guest.companions = (guest.companions || []).map((companion, index) => {
      const companionData = typeof companion.toObject === 'function' ? companion.toObject() : companion;
      return {
        ...companionData,
        tableName: target.table.name,
        seatLabel: String(firstSeat + index + 1)
      };
    });
    updates.push(guest.save());
    assigned.push({
      guest: { id: guest._id, name: guest.name, group: guest.group, seats },
      table: target.table.name,
      seatLabel: guest.seatLabel
    });
  });

  await Promise.all(updates);
  const tablesSummary = await tableSummary(req.user._id, event._id);
  res.json({ assigned, skipped, tables: tablesSummary });
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
