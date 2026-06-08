const mongoose = require('mongoose');

const rsvpSchema = new mongoose.Schema({
  invitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest' },
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  emailNormalized: { type: String, lowercase: true, trim: true, index: true },
  response: { type: String, enum: ['confirmed', 'declined', 'maybe'], required: true },
  companions: { type: Number, default: 0 },
  mealPreference: String,
  message: String,
  phoneCountryCode: { type: String, trim: true },
  phoneNationalNumber: { type: String, trim: true },
  phoneE164: { type: String, trim: true, index: true },
  phoneVerified: { type: Boolean, default: false },
  phoneVerificationStatus: { type: String, enum: ['not_started', 'pending', 'verified', 'failed'], default: 'not_started' }
}, { timestamps: true });

rsvpSchema.index({ invitation: 1, guest: 1 });
rsvpSchema.index({ invitation: 1, emailNormalized: 1 });

module.exports = mongoose.model('Rsvp', rsvpSchema);
