const Event = require('../models/Event');
const SongRequest = require('../models/SongRequest');
const asyncHandler = require('../utils/asyncHandler');
const { notifyReviewStatus } = require('../utils/moderation');

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
    .sort({ sortOrder: 1, createdAt: -1 });
  res.json({ songRequests });
});

exports.update = asyncHandler(async (req, res) => {
  const event = await findOwnedEvent(req.params.eventId, req.user.id);
  const update = {};
  if (req.validated.body.status) {
    update.status = req.validated.body.status;
    update.reviewedAt = new Date();
    if (req.validated.body.status === 'played') update.playedAt = new Date();
  }
  if (req.validated.body.sortOrder !== undefined) update.sortOrder = req.validated.body.sortOrder;
  const songRequest = await SongRequest.findOneAndUpdate(
    { _id: req.params.songRequestId, event: req.params.eventId },
    update,
    { new: true }
  ).populate('guest', 'name group roles relationshipLabel visibilityGroup tableName');
  if (!songRequest) {
    const error = new Error('Solicitud no encontrada');
    error.statusCode = 404;
    throw error;
  }
  if (req.validated.body.status) {
    await notifyReviewStatus({
      guest: songRequest.guest,
      email: songRequest.requesterEmail,
      name: songRequest.requesterName,
      event,
      itemType: 'song',
      status: songRequest.status,
      itemTitle: [songRequest.title, songRequest.artist].filter(Boolean).join(' - '),
      settings: event.externalContent?.moderationSettings || {}
    });
  }
  res.json({ songRequest });
});
