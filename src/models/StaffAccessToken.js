const mongoose = require('mongoose');

const staffAccessTokenSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  token: { type: String, required: true, unique: true, index: true },
  label: { type: String, trim: true },
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: Date,
  lastUsedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('StaffAccessToken', staffAccessTokenSchema);
