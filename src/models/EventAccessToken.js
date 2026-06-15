const mongoose = require('mongoose');

const eventAccessTokenSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  token: { type: String, required: true, unique: true, index: true },
  role: { type: String, enum: ['check_in', 'album_review', 'client_view', 'guest_ops'], required: true, index: true },
  label: { type: String, trim: true },
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: Date,
  lastUsedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('EventAccessToken', eventAccessTokenSchema);
