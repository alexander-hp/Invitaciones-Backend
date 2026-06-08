const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  status: { type: String, enum: ['draft', 'published', 'unpublished'], default: 'draft' },
  accessMode: { type: String, enum: ['open', 'guest_list'], default: 'open' },
  rsvpSettings: {
    deadline: Date,
    allowMaybe: { type: Boolean, default: true },
    allowChangesUntilDeadline: { type: Boolean, default: true },
    declineRequiresConfirmation: { type: Boolean, default: true },
    reminderDaysBeforeDeadline: { type: Number, default: 3, min: 0 }
  },
  content: {
    headline: String,
    subheadline: String,
    message: String,
    palette: { primary: String, secondary: String, accent: String },
    musicUrl: String,
    coverImageUrl: String,
    gallery: [String],
    privateAlbum: [String],
    privateAlbumEnabled: { type: Boolean, default: false }
  },
  premiumLocked: { type: Boolean, default: false },
  publishedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Invitation', invitationSchema);
