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
    storyTitle: String,
    storyBody: String,
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
    dressCodeDescription: String,
    dressCodeImageUrl: String,
    dressCodeOptions: [{
      title: { type: String, trim: true },
      description: { type: String, trim: true }
    }],
    dressCodeWomen: String,
    dressCodeMen: String,
    dressCodeOption1: String,
    dressCodeOption2: String,
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
    songRequestSettings: {
      enabled: { type: Boolean, default: true },
      maxRequestsPerGuest: { type: Number, default: 3, min: 1, max: 20 },
      allowDedications: { type: Boolean, default: true },
      requireApproval: { type: Boolean, default: true }
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
    visualDesign: {
      version: { type: Number, default: 1 },
      active: { type: Boolean, default: false },
      mode: { type: String, enum: ['easy', 'advanced'], default: 'easy' },
      responsiveMode: { type: String, enum: ['shared', 'independent'], default: 'shared' },
      assets: [{
        _id: false,
        id: { type: String, required: true, trim: true },
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'video', 'audio'], required: true },
        name: { type: String, required: true, trim: true, maxlength: 200 },
        attribution: { type: String, maxlength: 200 },
        attributionUrl: String,
        sourceUrl: String,
        createdAt: String
      }],
      sections: [{
        id: { type: String, required: true, trim: true },
        type: { type: String, required: true, trim: true },
        title: { type: String, trim: true },
        enabled: { type: Boolean, default: true },
        layout: { type: String, enum: ['flow', 'canvas'], default: 'canvas' },
        height: { type: Number, min: 240, max: 1600, default: 640 },
        background: {
          _id: false,
          color: String,
          imageUrl: String,
          overlay: { type: Number, min: 0, max: 1 }
        },
        layers: [{
          _id: false,
          id: { type: String, required: true, trim: true },
          groupId: { type: String, trim: true },
          type: { type: String, enum: ['text', 'image', 'video', 'audio', 'button', 'shape'], required: true },
          name: { type: String, trim: true, maxlength: 120 },
          text: String,
          url: String,
          binding: String,
          x: { type: Number, min: 0, max: 100 },
          y: { type: Number, min: 0, max: 100 },
          width: { type: Number, min: 1, max: 100 },
          height: { type: Number, min: 1, max: 100 },
          rotation: { type: Number, min: -360, max: 360 },
          zIndex: { type: Number, min: 0, max: 1000 },
          locked: { type: Boolean, default: false },
          hidden: { type: Boolean, default: false },
          animation: {
            _id: false,
            type: { type: String, enum: ['none', 'fade', 'slide-up', 'slide-left', 'zoom', 'float'], default: 'none' },
            duration: { type: Number, min: 0.2, max: 10 },
            delay: { type: Number, min: 0, max: 10 },
            repeat: Boolean
          },
          layouts: {
            _id: false,
            mobile: { type: mongoose.Schema.Types.Mixed },
            tablet: { type: mongoose.Schema.Types.Mixed },
            desktop: { type: mongoose.Schema.Types.Mixed }
          },
          style: { type: mongoose.Schema.Types.Mixed, default: {} }
        }],
        _id: false
      }]
    },
    template: String,
    customHtml: String,
    customCss: String,
    customPageApproved: { type: Boolean, default: false }
  },
  premiumLocked: { type: Boolean, default: false },
  publishedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Invitation', invitationSchema);
