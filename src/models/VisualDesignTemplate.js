const mongoose = require('mongoose');

const visualDesignTemplateSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  authorName: { type: String, trim: true, default: 'Creador de la Comunidad' },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  eventType: { type: String, trim: true, default: 'otro', index: true },
  category: { type: String, trim: true, default: 'general', index: true },
  description: { type: String, trim: true, maxlength: 500 },
  previewImageUrl: { type: String, trim: true },
  thumbnailUrl: { type: String, trim: true },
  isPublic: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['draft', 'pending', 'published', 'featured', 'rejected'], default: 'published', index: true },
  adminFeedback: { type: String, trim: true },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorRewardPercent: { type: Number, default: 5 },
  includesInvitation: { type: Boolean, default: true },
  includesPass: { type: Boolean, default: false },
  includesAccess: { type: Boolean, default: false },
  design: { type: mongoose.Schema.Types.Mixed, required: true },
  passDesign: { type: mongoose.Schema.Types.Mixed },
  accessScreen: { type: mongoose.Schema.Types.Mixed },
  tags: [{ type: String, trim: true }],
  usageCount: { type: Number, default: 0 },
  likesCount: { type: Number, default: 0 },
  tier: { type: String, enum: ['free', 'premium'], default: 'free' }
}, { timestamps: true });

visualDesignTemplateSchema.index({ isPublic: 1, eventType: 1, usageCount: -1 });

module.exports = mongoose.model('VisualDesignTemplate', visualDesignTemplateSchema);
