const mongoose = require('mongoose');

const dedicationSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  invitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation', index: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', index: true },
  publicName: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  message: { type: String, required: true, trim: true },
  type: { type: String, enum: ['dedication', 'wish', 'memory', 'toast'], default: 'dedication', index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'hidden'], default: 'pending', index: true },
  visibility: { type: String, enum: ['public', 'hosts_only'], default: 'public', index: true },
  reviewedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Dedication', dedicationSchema);
