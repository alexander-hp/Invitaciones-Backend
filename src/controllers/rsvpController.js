const Invitation = require('../models/Invitation');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Rsvp = require('../models/Rsvp');
const emailService = require('../services/emailService');
const asyncHandler = require('../utils/asyncHandler');

exports.submitPublic = asyncHandler(async (req, res) => {
  const payload = req.validated.body;
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).populate('owner', 'email name');
  if (!invitation) {
    const error = new Error('Invitacion no disponible');
    error.statusCode = 404;
    throw error;
  }

  let guest = null;
  if (payload.guest) {
    guest = await Guest.findOne({ _id: payload.guest, event: invitation.event });
    if (!guest) {
      const error = new Error('Invitado no pertenece a esta invitacion');
      error.statusCode = 400;
      throw error;
    }
    if ((payload.companions || 0) > guest.allowedCompanions) {
      const error = new Error('El numero de acompanantes excede lo permitido');
      error.statusCode = 400;
      throw error;
    }
  } else if (payload.email) {
    guest = await Guest.findOne({ event: invitation.event, email: payload.email.toLowerCase().trim() });
  }

  const rsvp = await Rsvp.create({
    invitation: invitation._id,
    event: invitation.event,
    guest: guest?._id,
    name: payload.name,
    email: payload.email,
    response: payload.response,
    companions: payload.companions || 0,
    mealPreference: payload.mealPreference,
    message: payload.message
  });

  if (guest) {
    await Guest.findByIdAndUpdate(guest._id, { status: payload.response });
  }

  if (invitation.owner?.email) {
    try {
      await emailService.sendRsvpNotification({ to: invitation.owner.email, invitation, rsvp });
    } catch (error) {
      console.warn('RSVP notification email failed:', error.message);
    }
  }

  res.status(201).json({ rsvp });
});

exports.listByEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const rsvps = await Rsvp.find({ event: req.params.eventId }).sort('-createdAt');
  res.json({ rsvps });
});
