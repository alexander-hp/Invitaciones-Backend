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
    reminderDaysBeforeDeadline: { type: Number, default: 3, min: 0 },
    customQuestions: [{
      key: { type: String, trim: true },
      label: { type: String, trim: true },
      type: { type: String, enum: ['text', 'textarea', 'select', 'boolean'], default: 'text' },
      required: { type: Boolean, default: false },
      options: [{ type: String, trim: true }]
    }]
  },
  content: {
    headline: String,
    subheadline: String,
    message: String,
    palette: { primary: String, secondary: String, accent: String },
    musicUrl: String,
    coverImageUrl: String,
    gallery: [String],
    itinerary: [{
      time: String,
      title: String,
      description: String
    }],
    dressCode: String,
    giftRegistry: [{
      label: String,
      url: String
    }],
    lodging: [{
      name: String,
      description: String,
      url: String
    }],
    privateAlbum: [String],
    privateAlbumEnabled: { type: Boolean, default: false }
  },
  premiumLocked: { type: Boolean, default: false },
  publishedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Invitation', invitationSchema);
