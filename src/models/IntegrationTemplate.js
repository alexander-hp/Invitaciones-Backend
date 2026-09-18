const mongoose = require('mongoose');

const INTEGRATION_MODES = ['widgets', 'api', 'mixed'];
const INTEGRATION_STACKS = ['html', 'react', 'next', 'angular', 'vue', 'wordpress', 'webflow', 'other'];
const INTEGRATION_MODULES = ['event', 'rsvp', 'guestPass', 'gallery', 'album', 'map', 'songRequests', 'gifts', 'dedications'];

const integrationTemplateSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500 },
  mode: { type: String, enum: INTEGRATION_MODES, default: 'mixed' },
  stack: { type: String, enum: INTEGRATION_STACKS, default: 'html' },
  modules: [{ type: String, enum: INTEGRATION_MODULES }],
  instructions: { type: String, trim: true, maxlength: 4000 },
  version: { type: Number, default: 1 }
}, { timestamps: true });

integrationTemplateSchema.index({ owner: 1, updatedAt: -1 });

module.exports = mongoose.model('IntegrationTemplate', integrationTemplateSchema);
module.exports.INTEGRATION_MODES = INTEGRATION_MODES;
module.exports.INTEGRATION_STACKS = INTEGRATION_STACKS;
module.exports.INTEGRATION_MODULES = INTEGRATION_MODULES;
