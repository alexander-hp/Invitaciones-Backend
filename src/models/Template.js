const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  eventType: { type: String, enum: ['boda', 'xv', 'graduacion', 'cumpleanos', 'bautizo', 'otro'], required: true },
  tier: { type: String, enum: ['free', 'premium'], default: 'free' },
  previewImageUrl: String,
  config: mongoose.Schema.Types.Mixed,
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Template', templateSchema);
