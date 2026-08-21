const fs = require('fs');
const path = require('path');

const backendDir = path.resolve(__dirname, '../../Invitaciones-Backend');

// 1. Clean eventRoutes.js
const eventRoutesPath = path.join(backendDir, 'src/routes/eventRoutes.js');
let eventRoutesCode = fs.readFileSync(eventRoutesPath, 'utf8');

if (eventRoutesCode.includes('/logs/activity/all')) {
  eventRoutesCode = eventRoutesCode.replace("router.get('/logs/activity/all', eventLogController.listAllForUser);\n", "");
  fs.writeFileSync(eventRoutesPath, eventRoutesCode, 'utf8');
  console.log('✓ Cleaned /logs/activity/all from eventRoutes.js');
}

// 2. Clean eventLogController.js
const eventLogControllerPath = path.join(backendDir, 'src/controllers/eventLogController.js');
const eventLogControllerCode = `const EventLog = require('../models/EventLog');
const asyncHandler = require('../utils/asyncHandler');
const { requireEventAccess } = require('../utils/eventAccess');

/**
 * Obtiene la lista paginada y filtrada de logs estrictamente para un evento específico.
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
console.log('✓ Cleaned eventLogController.js to be strictly per-event');
