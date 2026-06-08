const mongoose = require('mongoose');

const whatsappMediaAssetSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  key: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, enum: ['image', 'video', 'audio', 'document'], required: true },
  fileName: { type: String, trim: true },
  mimetype: { type: String, trim: true },
  size: Number,
  caption: { type: String, trim: true },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

module.exports = mongoose.model('WhatsAppMediaAsset', whatsappMediaAssetSchema);
