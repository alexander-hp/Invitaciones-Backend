const mongoose = require('mongoose');

const songRequestSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', index: true },
  requesterName: { type: String, trim: true },
  requesterEmail: { type: String, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  artist: { type: String, trim: true },
  dedication: { type: String, trim: true },
  sourceProvider: { type: String, enum: ['manual', 'spotify', 'youtube', 'url'], default: 'manual', index: true },
  sourceUrl: { type: String, trim: true },
  externalId: { type: String, trim: true },
  thumbnailUrl: { type: String, trim: true },
  previewUrl: { type: String, trim: true },
  durationMs: Number,
  sortOrder: { type: Number, default: 0, index: true },
  priority: { type: String, enum: ['high', 'normal'], index: true },
  prioritySource: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  priorityReason: { type: String, trim: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'played'], default: 'pending', index: true },
  reviewedAt: Date,
  playedAt: Date,
  promotedAt: Date,
  promotedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  promotedInvitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation' },
  promotedTarget: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('SongRequest', songRequestSchema);
