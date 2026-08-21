const fs = require('fs');
const path = require('path');

const backendDir = path.resolve(__dirname, '../../Invitaciones-Backend');
console.log('Targeting backend directory:', backendDir);

if (!fs.existsSync(backendDir)) {
  console.error('Backend directory not found at:', backendDir);
  process.exit(1);
}

// 1. Create EventLog Model
const eventLogModelPath = path.join(backendDir, 'src/models/EventLog.js');
const eventLogModelCode = `const mongoose = require('mongoose');

const eventLogSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  actorType: {
    type: String,
    enum: ['user', 'guest', 'staff', 'system'],
    default: 'user'
  },
  actor: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, trim: true },
    email: { type: String, trim: true },
    role: { type: String, trim: true }
  },
  category: {
    type: String,
    enum: [
      'guest',
      'table',
      'rsvp',
      'album',
      'music',
      'dedication',
      'event',
      'access',
      'communication'
    ],
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

eventLogSchema.index({ event: 1, createdAt: -1 });
eventLogSchema.index({ event: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model('EventLog', eventLogSchema);
`;
fs.writeFileSync(eventLogModelPath, eventLogModelCode, 'utf8');
console.log('✓ Created src/models/EventLog.js');

// 2. Create eventLogService
const eventLogServicePath = path.join(backendDir, 'src/services/eventLogService.js');
const eventLogServiceCode = `const EventLog = require('../models/EventLog');

/**
 * Registra una entrada en el historial/auditoría del evento.
 * La ejecución es asíncrona y atrapa errores para nunca interrumpir el flujo principal.
 */
async function logEventActivity({
  eventId,
  actor,
  actorType = 'user',
  category,
  action,
  description,
  metadata
}) {
  if (!eventId || !category || !action || !description) {
    return;
  }

  try {
    let actorData = undefined;
    if (actor) {
      actorData = {
        id: actor._id || actor.id || undefined,
        name: actor.name || undefined,
        email: actor.email || undefined,
        role: actor.role || undefined
      };
    }

    await EventLog.create({
      event: eventId,
      actorType,
      actor: actorData,
      category,
      action,
      description,
      metadata: metadata || undefined
    });
  } catch (err) {
    console.error('[EventLogService] Error al guardar log de actividad:', err.message);
  }
}

module.exports = {
  logEventActivity
};
`;
fs.writeFileSync(eventLogServicePath, eventLogServiceCode, 'utf8');
console.log('✓ Created src/services/eventLogService.js');

// 3. Create eventLogController
const eventLogControllerPath = path.join(backendDir, 'src/controllers/eventLogController.js');
const eventLogControllerCode = `const EventLog = require('../models/EventLog');
const asyncHandler = require('../utils/asyncHandler');
const { requireEventAccess } = require('../utils/eventAccess');

/**
 * Obtiene la lista paginada y filtrada de logs para un evento.
 */
exports.list = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  await requireEventAccess({
    eventId,
    user: req.user,
    permission: 'view_event',
    select: '_id title owner'
  });

  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '25', 10)));
  const category = req.query.category ? String(req.query.category).trim() : null;
  const search = req.query.search ? String(req.query.search).trim() : null;

  const query = { event: eventId };

  if (category && category !== 'all') {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
      { action: { $regex: search, $options: 'i' } },
      { 'actor.name': { $regex: search, $options: 'i' } },
      { 'actor.email': { $regex: search, $options: 'i' } }
    ];
  }

  const [logs, total] = await Promise.all([
    EventLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    EventLog.countDocuments(query)
  ]);

  // Obtener resumen de conteos por categoría y del día de hoy
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [categoryCounts, todayCount] = await Promise.all([
    EventLog.aggregate([
      { $match: { event: query.event } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]),
    EventLog.countDocuments({
      event: eventId,
      createdAt: { $gte: startOfToday }
    })
  ]);

  const summary = {
    total,
    today: todayCount,
    byCategory: categoryCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {})
  };

  res.json({
    logs,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1
    },
    summary
  });
});
`;
fs.writeFileSync(eventLogControllerPath, eventLogControllerCode, 'utf8');
console.log('✓ Created src/controllers/eventLogController.js');

// 4. Update eventRoutes.js
const eventRoutesPath = path.join(backendDir, 'src/routes/eventRoutes.js');
let eventRoutesCode = fs.readFileSync(eventRoutesPath, 'utf8');

if (!eventRoutesCode.includes('eventLogController')) {
  eventRoutesCode = eventRoutesCode.replace(
    "const dedicationController = require('../controllers/dedicationController');",
    `const dedicationController = require('../controllers/dedicationController');
const eventLogController = require('../controllers/eventLogController');`
  );

  eventRoutesCode = eventRoutesCode.replace(
    "router.get('/:id', controller.get);",
    `router.get('/:eventId/logs', eventLogController.list);
router.get('/:id', controller.get);`
  );

  fs.writeFileSync(eventRoutesPath, eventRoutesCode, 'utf8');
  console.log('✓ Updated src/routes/eventRoutes.js');
}

// 5. Update guestController.js to log actions
const guestControllerPath = path.join(backendDir, 'src/controllers/guestController.js');
let guestControllerCode = fs.readFileSync(guestControllerPath, 'utf8');

if (!guestControllerCode.includes('eventLogService')) {
  guestControllerCode = guestControllerCode.replace(
    "const env = require('../config/env');",
    `const env = require('../config/env');
const { logEventActivity } = require('../services/eventLogService');`
  );

  // Hook in create
  guestControllerCode = guestControllerCode.replace(
    "res.status(201).json({ guest });",
    `logEventActivity({
    eventId: event._id,
    actor: req.user,
    actorType: 'user',
    category: 'guest',
    action: 'guest_created',
    description: \`Invitado creado: \${guest.name}\${guest.tableName ? ' (Mesa: ' + guest.tableName + ')' : ''}\`,
    metadata: { guestId: guest._id, name: guest.name, group: guest.group, companions: guest.allowedCompanions }
  });
  res.status(201).json({ guest });`
  );

  // Hook in update
  guestControllerCode = guestControllerCode.replace(
    "res.json({ guest });",
    `logEventActivity({
    eventId: guest.event,
    actor: req.user,
    actorType: 'user',
    category: 'guest',
    action: 'guest_updated',
    description: \`Invitado actualizado: \${guest.name}\`,
    metadata: { guestId: guest._id, name: guest.name, status: guest.status, tableName: guest.tableName }
  });
  res.json({ guest });`
  );

  // Hook in remove
  guestControllerCode = guestControllerCode.replace(
    "await Guest.findByIdAndDelete(req.params.id);",
    `await Guest.findByIdAndDelete(req.params.id);
  logEventActivity({
    eventId: guest.event,
    actor: req.user,
    actorType: 'user',
    category: 'guest',
    action: 'guest_deleted',
    description: \`Invitado eliminado: \${guest.name}\`,
    metadata: { guestId: guest._id, name: guest.name }
  });`
  );

  // Hook in checkIn
  guestControllerCode = guestControllerCode.replace(
    "await guest.save();\n  res.json({ guest });",
    `await guest.save();
  logEventActivity({
    eventId: guest.event,
    actor: req.user,
    actorType: 'user',
    category: 'guest',
    action: 'check_in',
    description: \`Check-in completado para: \${guest.name}\`,
    metadata: { guestId: guest._id, name: guest.name, checkedInAt: guest.checkedInAt }
  });
  res.json({ guest });`
  );

  fs.writeFileSync(guestControllerPath, guestControllerCode, 'utf8');
  console.log('✓ Updated src/controllers/guestController.js');
}

// 6. Update rsvpController.js to log RSVP activity into EventLog
const rsvpControllerPath = path.join(backendDir, 'src/controllers/rsvpController.js');
let rsvpControllerCode = fs.readFileSync(rsvpControllerPath, 'utf8');

if (!rsvpControllerCode.includes('eventLogService')) {
  rsvpControllerCode = rsvpControllerCode.replace(
    "const RsvpActivity = require('../models/RsvpActivity');",
    `const RsvpActivity = require('../models/RsvpActivity');
const { logEventActivity } = require('../services/eventLogService');`
  );

  rsvpControllerCode = rsvpControllerCode.replace(
    "async function createRsvpActivity({ invitation, guest, rsvp, action, previous, next, metadata }) {",
    `async function createRsvpActivity({ invitation, guest, rsvp, action, previous, next, metadata }) {
  const targetEventId = invitation?.event || rsvp?.event || guest?.event;
  const guestName = guest?.name || rsvp?.name || 'Invitado';
  let friendlyDesc = \`RSVP (\${action}): \${guestName}\`;
  if (action === 'confirmed') friendlyDesc = \`Asistencia confirmada por \${guestName}\${rsvp?.attendingCount ? ' (' + rsvp.attendingCount + ' personas)' : ''}\`;
  else if (action === 'declined') friendlyDesc = \`Asistencia declinada por \${guestName}\`;
  else if (action === 'maybe') friendlyDesc = \`Respuesta tentativa (tal vez) de \${guestName}\`;
  else if (action === 'updated') friendlyDesc = \`Respuesta RSVP modificada por \${guestName}\`;

  if (targetEventId) {
    logEventActivity({
      eventId: targetEventId,
      actorType: 'guest',
      category: 'rsvp',
      action: \`rsvp_\${action}\`,
      description: friendlyDesc,
      metadata: { guestId: guest?._id, rsvpId: rsvp?._id, guestName, action, metadata }
    });
  }`
  );

  fs.writeFileSync(rsvpControllerPath, rsvpControllerCode, 'utf8');
  console.log('✓ Updated src/controllers/rsvpController.js');
}

// 7. Update checkInController.js to log staff check-ins
const checkInControllerPath = path.join(backendDir, 'src/controllers/checkInController.js');
let checkInControllerCode = fs.readFileSync(checkInControllerPath, 'utf8');

if (!checkInControllerCode.includes('eventLogService')) {
  checkInControllerCode = checkInControllerCode.replace(
    "const asyncHandler = require('../utils/asyncHandler');",
    `const asyncHandler = require('../utils/asyncHandler');
const { logEventActivity } = require('../services/eventLogService');`
  );

  checkInControllerCode = checkInControllerCode.replace(
    "access.lastUsedAt = new Date();\n  await access.save();\n  res.json({ guest: staffGuest(guest) });",
    `access.lastUsedAt = new Date();
  await access.save();
  logEventActivity({
    eventId: access.event,
    actorType: 'staff',
    category: 'access',
    action: 'staff_check_in',
    description: \`Check-in de entrada escaneado para \${guest.name} (\${access.label || 'Staff'})\`,
    metadata: { guestId: guest._id, name: guest.name, staffLabel: access.label }
  });
  res.json({ guest: staffGuest(guest) });`
  );

  fs.writeFileSync(checkInControllerPath, checkInControllerCode, 'utf8');
  console.log('✓ Updated src/controllers/checkInController.js');
}

// 8. Update tableController.js to log table operations
const tableControllerPath = path.join(backendDir, 'src/controllers/tableController.js');
if (fs.existsSync(tableControllerPath)) {
  let tableControllerCode = fs.readFileSync(tableControllerPath, 'utf8');
  if (!tableControllerCode.includes('eventLogService')) {
    tableControllerCode = tableControllerCode.replace(
      "const asyncHandler = require('../utils/asyncHandler');",
      `const asyncHandler = require('../utils/asyncHandler');
const { logEventActivity } = require('../services/eventLogService');`
    );

    tableControllerCode = tableControllerCode.replace(
      "res.status(201).json({ table });",
      `logEventActivity({
    eventId: event._id,
    actor: req.user,
    actorType: 'user',
    category: 'table',
    action: 'table_created',
    description: \`Mesa creada: "\${table.name}" (Capacidad: \${table.capacity})\`,
    metadata: { tableId: table._id, name: table.name, capacity: table.capacity }
  });
  res.status(201).json({ table });`
    );

    tableControllerCode = tableControllerCode.replace(
      "res.json({ table });",
      `logEventActivity({
    eventId: table.event,
    actor: req.user,
    actorType: 'user',
    category: 'table',
    action: 'table_updated',
    description: \`Mesa modificada: "\${table.name}"\`,
    metadata: { tableId: table._id, name: table.name, capacity: table.capacity }
  });
  res.json({ table });`
    );

    fs.writeFileSync(tableControllerPath, tableControllerCode, 'utf8');
    console.log('✓ Updated src/controllers/tableController.js');
  }
}

// 9. Update eventController.js to log event modifications
const eventControllerPath = path.join(backendDir, 'src/controllers/eventController.js');
if (fs.existsSync(eventControllerPath)) {
  let eventControllerCode = fs.readFileSync(eventControllerPath, 'utf8');
  if (!eventControllerCode.includes('eventLogService')) {
    eventControllerCode = eventControllerCode.replace(
      "const asyncHandler = require('../utils/asyncHandler');",
      `const asyncHandler = require('../utils/asyncHandler');
const { logEventActivity } = require('../services/eventLogService');`
    );

    eventControllerCode = eventControllerCode.replace(
      "res.json({ event: updatedEvent });",
      `logEventActivity({
    eventId: updatedEvent._id,
    actor: req.user,
    actorType: 'user',
    category: 'event',
    action: 'event_updated',
    description: \`Configuración general del evento actualizada\`,
    metadata: { title: updatedEvent.title, date: updatedEvent.date }
  });
  res.json({ event: updatedEvent });`
    );

    fs.writeFileSync(eventControllerPath, eventControllerCode, 'utf8');
    console.log('✓ Updated src/controllers/eventController.js');
  }
}

console.log('--- Setup Event Logs Backend Completed Successfully ---');
