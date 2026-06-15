const mongoose = require('mongoose');

const albumAssetSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  invitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation', index: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest' },
  uploaderName: { type: String, trim: true },
  uploaderEmail: { type: String, lowercase: true, trim: true },
  key: { type: String, required: true },
  url: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('AlbumAsset', albumAssetSchema);
