const mongoose = require('mongoose');

const whatsappMessageLogSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', index: true },
  invitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation', index: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', index: true },
  provider: { type: String, enum: ['disabled', 'meta', 'openwa'], required: true, index: true },
  type: { type: String, enum: ['invitation', 'reminder', 'event_reminder', 'location_change', 'thanks', 'freeform'], required: true },
  phone: { type: String, trim: true },
  textPreview: String,
  templateName: String,
  messageId: { type: String, index: true },
  status: { type: String, enum: ['pending', 'skipped', 'sent', 'delivered', 'read', 'failed'], default: 'pending', index: true },
  error: String,
  payload: mongoose.Schema.Types.Mixed,
  providerResponse: mongoose.Schema.Types.Mixed,
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  failedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('WhatsAppMessageLog', whatsappMessageLogSchema);
