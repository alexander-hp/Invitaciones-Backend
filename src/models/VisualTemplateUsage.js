const mongoose = require('mongoose');

const visualTemplateUsageSchema = new mongoose.Schema({
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'VisualDesignTemplate', required: true, index: true },
  templateName: { type: String, trim: true, required: true },
  templateAuthor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  templateAuthorName: { type: String, trim: true, default: 'Creador de la Comunidad' },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  invitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation', required: true, unique: true, index: true },
  eventOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  invitationSlug: { type: String, trim: true },
  eventTitle: { type: String, trim: true },
  eventType: { type: String, trim: true },
  eventDate: { type: Date },
  eventPlan: { type: String, trim: true, default: 'free' },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  eventPaidAmount: { type: Number, default: 0 }, // centavos (e.g., 49900 = $499.00 MXN)
  currency: { type: String, default: 'mxn', lowercase: true, trim: true },
  rewardPercent: { type: Number, default: 5, min: 0, max: 100 },
  rewardAmount: { type: Number, default: 0 }, // centavos
  isSelfUse: { type: Boolean, default: false },
  payoutStatus: {
    type: String,
    enum: ['pending', 'paid', 'not_applicable'],
    default: 'pending',
    index: true
  },
  payoutNote: { type: String, trim: true, maxlength: 500 },
  paidAt: { type: Date },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

visualTemplateUsageSchema.index({ payoutStatus: 1, publishedAt: -1 });

module.exports = mongoose.model('VisualTemplateUsage', visualTemplateUsageSchema);
