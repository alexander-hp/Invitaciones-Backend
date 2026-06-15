const mongoose = require('mongoose');

const songRequestSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', index: true },
  requesterName: { type: String, trim: true },
  requesterEmail: { type: String, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  artist: { type: String, trim: true },
  dedication: { type: String, trim: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true }
}, { timestamps: true });

module.exports = mongoose.model('SongRequest', songRequestSchema);
