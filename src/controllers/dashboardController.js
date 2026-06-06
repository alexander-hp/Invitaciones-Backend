const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Rsvp = require('../models/Rsvp');
const Invitation = require('../models/Invitation');
const asyncHandler = require('../utils/asyncHandler');

exports.summary = asyncHandler(async (req, res) => {
  const owner = req.user._id;
  const ownerEvents = await Event.find({ owner }).select('_id');
  const eventIds = ownerEvents.map((event) => event._id);
  const [invitations, guests, confirmed, declined, pendingGuests, companions] = await Promise.all([
    Invitation.countDocuments({ owner }),
    Guest.countDocuments({ owner }),
    Rsvp.countDocuments({ event: { $in: eventIds }, response: 'confirmed' }),
    Rsvp.countDocuments({ event: { $in: eventIds }, response: 'declined' }),
    Guest.countDocuments({ owner, status: 'pending' }),
    Rsvp.aggregate([{ $match: { event: { $in: eventIds } } }, { $group: { _id: null, total: { $sum: '$companions' } } }])
  ]);

  res.json({
    metrics: {
      events: ownerEvents.length,
      invitations,
      guests,
      confirmed,
      declined,
      pending: pendingGuests,
      companions: companions[0]?.total || 0
    }
  });
});
