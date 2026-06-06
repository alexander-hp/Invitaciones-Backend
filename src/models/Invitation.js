const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  status: { type: String, enum: ['draft', 'published', 'unpublished'], default: 'draft' },
  content: {
    headline: String,
    subheadline: String,
    message: String,
    palette: { primary: String, secondary: String, accent: String },
    musicUrl: String,
    coverImageUrl: String,
    gallery: [String]
  },
  premiumLocked: { type: Boolean, default: false },
  publishedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Invitation', invitationSchema);
