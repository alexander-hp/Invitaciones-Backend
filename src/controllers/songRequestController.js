const Event = require('../models/Event');
const SongRequest = require('../models/SongRequest');
const asyncHandler = require('../utils/asyncHandler');

async function findOwnedEvent(eventId, ownerId) {
  const event = await Event.findOne({ _id: eventId, owner: ownerId });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  return event;
}

exports.list = asyncHandler(async (req, res) => {
  await findOwnedEvent(req.params.eventId, req.user.id);
  const songRequests = await SongRequest.find({ event: req.params.eventId })
    .populate('guest', 'name group roles relationshipLabel visibilityGroup tableName')
    .sort({ createdAt: -1 });
  res.json({ songRequests });
});

exports.update = asyncHandler(async (req, res) => {
  await findOwnedEvent(req.params.eventId, req.user.id);
  const songRequest = await SongRequest.findOneAndUpdate(
    { _id: req.params.songRequestId, event: req.params.eventId },
    { status: req.validated.body.status },
    { new: true }
  ).populate('guest', 'name group roles relationshipLabel visibilityGroup tableName');
  if (!songRequest) {
    const error = new Error('Solicitud no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ songRequest });
});
