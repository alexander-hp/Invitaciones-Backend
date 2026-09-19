const mongoose = require('mongoose');

const visualDesignTemplateSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  eventType: { type: String, trim: true, default: 'otro' },
  description: { type: String, trim: true, maxlength: 500 },
  previewImageUrl: String,
  design: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

visualDesignTemplateSchema.index({ owner: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('VisualDesignTemplate', visualDesignTemplateSchema);
