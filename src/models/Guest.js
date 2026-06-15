const mongoose = require('mongoose');
const crypto = require('crypto');

const guestSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  group: String,
  roles: [{ type: String, trim: true, lowercase: true }],
  tags: [{ type: String, trim: true, lowercase: true }],
  relationshipLabel: { type: String, trim: true },
  visibilityGroup: { type: String, trim: true },
  tableName: { type: String, trim: true },
  seatLabel: { type: String, trim: true },
  companions: [{
    name: { type: String, trim: true },
    tableName: { type: String, trim: true },
    seatLabel: { type: String, trim: true },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: Date
  }],
  allowedCompanions: { type: Number, default: 0 },
  invitationToken: { type: String, unique: true, sparse: true, index: true },
  personalizedLinkGeneratedAt: Date,
  invitationOpenedAt: Date,
  lastLinkCopiedAt: Date,
  qrCode: String,
  checkInCode: { type: String, unique: true, sparse: true, index: true },
  checkedIn: { type: Boolean, default: false },
  checkedInAt: Date,
  status: { type: String, enum: ['pending', 'confirmed', 'declined'], default: 'pending' },
  communicationStatus: { type: String, enum: ['pending', 'sent', 'delivered', 'read', 'opened', 'failed', 'confirmed'], default: 'pending' },
  lastMessageType: { type: String, enum: ['invitation', 'reminder', 'event_reminder', 'location_change', 'thanks'] },
  lastMessageChannel: { type: String, enum: ['whatsapp', 'email'] },
  lastMessageSentAt: Date,
  lastMessageError: { type: String, trim: true }
}, { timestamps: true });

guestSchema.pre('validate', function ensureCheckInCode(next) {
  if (!this.checkInCode) this.checkInCode = crypto.randomBytes(5).toString('hex').toUpperCase();
  if (!this.qrCode) this.qrCode = this.checkInCode;
  if (!this.invitationToken) this.invitationToken = crypto.randomBytes(16).toString('hex');
  if (!this.personalizedLinkGeneratedAt) this.personalizedLinkGeneratedAt = new Date();
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
