const mongoose = require('mongoose');
const crypto = require('crypto');

const guestSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  group: String,
  tableName: { type: String, trim: true },
  seatLabel: { type: String, trim: true },
  allowedCompanions: { type: Number, default: 0 },
  qrCode: String,
  checkInCode: { type: String, unique: true, sparse: true, index: true },
  checkedIn: { type: Boolean, default: false },
  checkedInAt: Date,
  status: { type: String, enum: ['pending', 'confirmed', 'declined'], default: 'pending' },
  communicationStatus: { type: String, enum: ['pending', 'sent', 'confirmed'], default: 'pending' },
  lastMessageType: { type: String, enum: ['invitation', 'reminder', 'location_change', 'thanks'] },
  lastMessageChannel: { type: String, enum: ['whatsapp', 'email'] },
  lastMessageSentAt: Date
}, { timestamps: true });

guestSchema.pre('validate', function ensureCheckInCode(next) {
  if (!this.checkInCode) this.checkInCode = crypto.randomBytes(5).toString('hex').toUpperCase();
  if (!this.qrCode) this.qrCode = this.checkInCode;
  next();
});

guestSchema.index(
  { owner: 1, event: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
guestSchema.index(
  { owner: 1, event: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }
);

module.exports = mongoose.model('Guest', guestSchema);
