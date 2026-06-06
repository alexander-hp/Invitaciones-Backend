const mongoose = require('mongoose');

const rsvpSchema = new mongoose.Schema({
  invitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest' },
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  response: { type: String, enum: ['confirmed', 'declined'], required: true },
  companions: { type: Number, default: 0 },
  mealPreference: String,
  message: String
}, { timestamps: true });

module.exports = mongoose.model('Rsvp', rsvpSchema);
