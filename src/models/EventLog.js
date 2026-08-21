const mongoose = require('mongoose');

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
