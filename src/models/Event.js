const mongoose = require('mongoose');

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
    audioSections: [{
      title: { type: String, trim: true },
      url: { type: String, trim: true },
      description: { type: String, trim: true }
    }],
    locations: [{
      type: { type: String, trim: true },
      name: { type: String, trim: true },
      address: { type: String, trim: true },
      mapUrl: { type: String, trim: true },
      wazeUrl: { type: String, trim: true },
      notes: { type: String, trim: true },
      time: { type: String, trim: true }
    }],
    sections: [{
      key: { type: String, trim: true },
      type: { type: String, enum: ['text', 'image', 'video', 'cta', 'iframe', 'timeline'], default: 'text' },
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
      allowDedications: { type: Boolean, default: true }
    }
  },
  type: { type: String, enum: ['boda', 'xv', 'graduacion', 'cumpleanos', 'bautizo', 'otro'], required: true },
  title: { type: String, required: true, trim: true },
  hosts: [{ type: String, trim: true }],
  date: { type: Date, required: true },
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
