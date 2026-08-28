const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  status: { type: String, enum: ['draft', 'published', 'unpublished'], default: 'draft' },
  accessMode: { type: String, enum: ['open', 'public', 'guest_list', 'specific_users'], default: 'open' },
  rsvpSettings: {
    deadline: Date,
    allowMaybe: { type: Boolean, default: true },
    allowChangesUntilDeadline: { type: Boolean, default: true },
    declineRequiresConfirmation: { type: Boolean, default: true },
    reminderDaysBeforeDeadline: { type: Number, default: 3, min: 0 },
    identityMethods: { type: [{ type: String, enum: ['email', 'phone'] }], default: ['email', 'phone'] },
    allowCompanionsDefault: { type: Boolean, default: false },
    defaultAllowedCompanions: { type: Number, default: 0, min: 0 },
    maxAttendees: { type: Number, min: 1 },
    allowedGuestIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Guest' }],
    allowedRoles: [{ type: String, trim: true, lowercase: true }],
    allowedGroups: [{ type: String, trim: true }],
    allowedEmails: [{ type: String, lowercase: true, trim: true }],
    allowedPhones: [{ type: String, trim: true }],
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
    sectionMusic: {
      type: Map,
      of: String,
      default: {}
    },
    coverImageUrl: String,
    gallery: [String],
    itinerary: [{
      time: String,
      title: String,
      description: String
    }],
    locations: [{
      type: { type: String, trim: true },
      name: { type: String, trim: true },
      address: { type: String, trim: true },
      mapUrl: { type: String, trim: true },
      wazeUrl: { type: String, trim: true },
      notes: { type: String, trim: true }
    }],
    dressCode: String,
    giftRegistry: [{
      store: String,
      title: String,
      label: String,
      url: String,
      imageUrl: String,
      note: String,
      priority: { type: Number, default: 0 }
    }],
    digitalEnvelope: {
      bank: String,
      account: String,
      clabe: String,
      holder: String,
      note: String,
      qrImageUrl: String
    },
    giftSettings: {
      enabled: { type: Boolean, default: true },
      introText: String,
      showRegistry: { type: Boolean, default: true },
      showEnvelope: { type: Boolean, default: true }
    },
    dedicationSettings: {
      enabled: { type: Boolean, default: true },
      requireApproval: { type: Boolean, default: true },
      introText: String
    },
    moderationSettings: {
      notifyOnReview: { type: Boolean, default: true },
      autoApproveRoles: [{ type: String, trim: true, lowercase: true }],
      autoApproveGroups: [{ type: String, trim: true }],
      autoApproveEmails: [{ type: String, lowercase: true, trim: true }],
      autoApprovePhones: [{ type: String, trim: true }],
      autoApproveAlbum: { type: Boolean, default: false },
      autoApproveDedications: { type: Boolean, default: false }
    },
    brandLogoUrl: String,
    hideBranding: { type: Boolean, default: false },
    sectionSettings: {
      story: { type: Boolean, default: true },
      locations: { type: Boolean, default: true },
      itinerary: { type: Boolean, default: true },
      dressCode: { type: Boolean, default: true },
      rsvp: { type: Boolean, default: true },
      giftRegistry: { type: Boolean, default: true },
      digitalEnvelope: { type: Boolean, default: true },
      lodging: { type: Boolean, default: true },
      gallery: { type: Boolean, default: true },
      guestAlbum: { type: Boolean, default: true },
      dedications: { type: Boolean, default: true },
      backgroundMusic: { type: Boolean, default: true },
      songRequests: { type: Boolean, default: true }
    },
    lodging: [{
      name: String,
      description: String,
      url: String
    }],
    privateAlbum: [String],
    privateAlbumEnabled: { type: Boolean, default: false },
    template: String,
    customHtml: String,
    customCss: String,
    customPageApproved: { type: Boolean, default: false }
  },
  premiumLocked: { type: Boolean, default: false },
  publishedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Invitation', invitationSchema);
