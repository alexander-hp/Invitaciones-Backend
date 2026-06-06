const Event = require('../models/Event');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const events = await Event.find({ owner: req.user._id }).sort('-createdAt');
  res.json({ events });
});

exports.create = asyncHandler(async (req, res) => {
  const event = await Event.create({ ...req.validated.body, owner: req.user._id });
  res.status(201).json({ event });
});

exports.get = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, owner: req.user._id });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  res.json({ event });
});

exports.update = asyncHandler(async (req, res) => {
  const event = await Event.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, req.validated.body, { new: true });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  res.json({ event });
});
