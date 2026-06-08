const mongoose = require('mongoose');

const rsvpActivitySchema = new mongoose.Schema({
  invitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest' },
  rsvp: { type: mongoose.Schema.Types.ObjectId, ref: 'Rsvp', index: true },
  actorType: { type: String, enum: ['guest', 'owner', 'system'], default: 'guest' },
  action: {
    type: String,
    enum: ['created', 'updated', 'declined', 'confirmed', 'maybe', 'phone_added', 'blocked_duplicate', 'blocked_deadline', 'blocked_capacity'],
    required: true
  },
  previous: mongoose.Schema.Types.Mixed,
  next: mongoose.Schema.Types.Mixed,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.model('RsvpActivity', rsvpActivitySchema);
