const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  group: String,
  allowedCompanions: { type: Number, default: 0 },
  qrCode: String,
  status: { type: String, enum: ['pending', 'confirmed', 'declined'], default: 'pending' }
}, { timestamps: true });

guestSchema.index({ owner: 1, event: 1, email: 1 });
guestSchema.index({ owner: 1, event: 1, phone: 1 });

module.exports = mongoose.model('Guest', guestSchema);
