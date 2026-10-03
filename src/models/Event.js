const mongoose = require('mongoose');

const musicCueSchema = new mongoose.Schema({
  startSeconds: { type: Number, min: 0, default: 0 },
  endSeconds: { type: Number, min: 0 },
  volume: { type: Number, min: 0, max: 1 },
  loop: Boolean
}, { _id: false });

const eventSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mode: { type: String, enum: ['invitation', 'external_dashboard'], default: 'invitation', index: true },
  externalSiteUrl: { type: String, trim: true },
  externalSiteLabel: { type: String, trim: true },
  externalPortalSlug: { type: String, lowercase: true, trim: true, unique: true, sparse: true, index: true },
  externalPortalEnabled: { type: Boolean, default: true },
  externalPortalSettings: {
    rsvpEnabled: { type: Boolean, default: true },
    albumEnabled: { type: Boolean, default: true },
    passEnabled: { type: Boolean, default: true },
    calendarEnabled: { type: Boolean, default: true },
    showLocation: { type: Boolean, default: true },
    brandLabel: { type: String, trim: true },
    welcomeMessage: { type: String, trim: true }
  },
  externalContent: {
    coverImageUrl: { type: String, trim: true },
    heroImageUrl: { type: String, trim: true },
    gallery: [{ type: String, trim: true }],
    carousel: [{ type: String, trim: true }],
    spectacularImages: [{ type: String, trim: true }],
    musicUrl: { type: String, trim: true },
    musicSettings: {
      playbackMode: { type: String, enum: ['manual', 'first_interaction', 'after_access'], default: 'first_interaction' },
      sectionChangeMode: { type: String, enum: ['automatic', 'manual'], default: 'automatic' },
      loop: { type: Boolean, default: true },
      volume: { type: Number, min: 0, max: 1, default: 0.7 },
      startSeconds: { type: Number, min: 0, default: 0 },
      endSeconds: { type: Number, min: 0 }
    },
    audioSections: [{
      title: { type: String, trim: true },
      url: { type: String, trim: true },
      description: { type: String, trim: true }
    }],
    sectionMusic: {
      type: Map,
      of: String,
      default: {}
    },
    sectionMusicCues: {
      type: Map,
      of: musicCueSchema,
      default: {}
    },
    locations: [{
      type: { type: String, trim: true },
      name: { type: String, trim: true },
      address: { type: String, trim: true },
      mapUrl: { type: String, trim: true },
      wazeUrl: { type: String, trim: true },
      notes: { type: String, trim: true },
      time: { type: String, trim: true },
      lat: { type: Number, min: -90, max: 90 },
      lon: { type: Number, min: -180, max: 180 },
      phone: { type: String, trim: true },
      websiteUrl: { type: String, trim: true },
      schedule: [{ type: String, trim: true }],
      parking: String,
      transport: String,
      accessibility: String,
      priority: { type: Number, default: 0 }
    }],
    sections: [{
      key: { type: String, trim: true },
      type: { type: String, enum: ['text', 'image', 'video', 'cta', 'iframe', 'timeline', 'story', 'dress_code', 'gift_registry', 'dedications', 'lodging', 'faq', 'people'], default: 'text' },
      title: { type: String, trim: true },
      body: { type: String, trim: true },
      url: { type: String, trim: true },
      imageUrl: { type: String, trim: true },
      roles: [{ type: String, trim: true }],
      order: { type: Number, default: 0 }
    }],
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
    songRequestSettings: {
      enabled: { type: Boolean, default: true },
      maxRequestsPerGuest: { type: Number, default: 3, min: 1, max: 20 },
      allowDedications: { type: Boolean, default: true },
      requireApproval: { type: Boolean, default: true }
    },
    moderationSettings: {
      notifyOnReview: { type: Boolean, default: true },
      autoApproveRoles: [{ type: String, trim: true, lowercase: true }],
      autoApproveGroups: [{ type: String, trim: true }],
      autoApproveEmails: [{ type: String, lowercase: true, trim: true }],
      autoApprovePhones: [{ type: String, trim: true }],
      autoApproveAlbum: { type: Boolean, default: false },
      autoApproveSongs: { type: Boolean, default: false },
      autoApproveDedications: { type: Boolean, default: false }
    },
    giftRegistry: [{
      store: { type: String, trim: true },
      title: { type: String, trim: true },
      label: { type: String, trim: true },
      url: { type: String, trim: true },
      imageUrl: { type: String, trim: true },
      note: { type: String, trim: true },
      priority: { type: Number, default: 0 }
    }],
    digitalEnvelope: {
      bank: String,
      account: { type: String, trim: true, maxlength: 20, match: /^\d*$/ },
      clabe: { type: String, trim: true, maxlength: 18, match: /^(?:\d{18})?$/ },
      holder: String,
      note: String,
      qrImageUrl: String
    },
    giftSettings: {
      enabled: { type: Boolean, default: true },
      introText: { type: String, trim: true },
      showRegistry: { type: Boolean, default: true },
      showEnvelope: { type: Boolean, default: true }
    },
    dedicationSettings: {
      enabled: { type: Boolean, default: true },
      requireApproval: { type: Boolean, default: true },
      introText: { type: String, trim: true }
    }
  },
  type: { type: String, enum: ['boda', 'xv', 'graduacion', 'cumpleanos', 'bautizo', 'otro'], required: true },
  title: { type: String, required: true, trim: true },
  hosts: [{ type: String, trim: true }],
  date: { type: Date, required: true },
  time: { type: String, trim: true },
  venue: {
    name: String,
    address: String,
    mapUrl: String
  },
  agenda: [{ time: String, title: String, description: String }],
  plan: { type: String, enum: ['free', 'event', 'event_12m', 'external_dashboard_12m'], default: 'free', index: true },
  planActivatedAt: Date,
  planExpiresAt: Date,
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
