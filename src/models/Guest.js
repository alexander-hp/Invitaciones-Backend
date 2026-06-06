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

module.exports = mongoose.model('Guest', guestSchema);
