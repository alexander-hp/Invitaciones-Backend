const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Rsvp = require('../models/Rsvp');
const Invitation = require('../models/Invitation');
const WhatsAppMessageLog = require('../models/WhatsAppMessageLog');
const asyncHandler = require('../utils/asyncHandler');
const { requireEventAccess } = require('../utils/eventAccess');

exports.summary = asyncHandler(async (req, res) => {
  const owner = req.user._id;
  const ownerEvents = await Event.find({ owner }).select('_id');
  const eventIds = ownerEvents.map((event) => event._id);
  const [invitations, guests, confirmed, declined, pendingGuests, companions, emailSent, whatsappSent, opened, failed, checkedIn] = await Promise.all([
    Invitation.countDocuments({ owner }),
    Guest.countDocuments({ owner }),
    Rsvp.countDocuments({ event: { $in: eventIds }, response: 'confirmed' }),
    Rsvp.countDocuments({ event: { $in: eventIds }, response: 'declined' }),
    Guest.countDocuments({ owner, status: 'pending' }),
    Rsvp.aggregate([{ $match: { event: { $in: eventIds } } }, { $group: { _id: null, total: { $sum: '$companions' } } }]),
    Guest.countDocuments({ owner, lastMessageChannel: 'email', communicationStatus: { $in: ['sent', 'delivered', 'read', 'opened', 'confirmed'] } }),
    WhatsAppMessageLog.countDocuments({ owner, status: { $in: ['sent', 'delivered', 'read'] } }),
    Guest.countDocuments({ owner, communicationStatus: 'opened' }),
    Guest.countDocuments({ owner, communicationStatus: 'failed' }),
    Guest.countDocuments({ owner, checkedIn: true })
  ]);

  res.json({
    metrics: {
      events: ownerEvents.length,
      invitations,
      guests,
      confirmed,
      declined,
      pending: pendingGuests,
      companions: companions[0]?.total || 0,
      emailSent,
      whatsappSent,
      opened,
      failed,
      checkedIn
    }
  });
});

exports.eventSummary = asyncHandler(async (req, res) => {
  const { event } = await requireEventAccess({ eventId: req.params.eventId, user: req.user, permission: 'view_metrics', select: '_id' });
  const owner = event.owner;
  const [guests, confirmed, declined, pending, emailSent, whatsappSent, opened, failed, checkedIn] = await Promise.all([
    Guest.countDocuments({ owner, event: event._id }),
    Guest.countDocuments({ owner, event: event._id, status: 'confirmed' }),
    Guest.countDocuments({ owner, event: event._id, status: 'declined' }),
    Guest.countDocuments({ owner, event: event._id, status: 'pending' }),
    Guest.countDocuments({ owner, event: event._id, lastMessageChannel: 'email', communicationStatus: { $in: ['sent', 'delivered', 'read', 'opened', 'confirmed'] } }),
    WhatsAppMessageLog.countDocuments({ owner, event: event._id, status: { $in: ['sent', 'delivered', 'read'] } }),
    Guest.countDocuments({ owner, event: event._id, communicationStatus: 'opened' }),
    Guest.countDocuments({ owner, event: event._id, communicationStatus: 'failed' }),
    Guest.countDocuments({ owner, event: event._id, checkedIn: true })
  ]);
  res.json({ metrics: { guests, confirmed, declined, pending, emailSent, whatsappSent, opened, failed, checkedIn } });
});
