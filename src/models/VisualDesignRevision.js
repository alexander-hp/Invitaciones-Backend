const mongoose = require('mongoose');

const visualDesignRevisionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  invitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation', required: true, index: true },
  label: { type: String, required: true, trim: true, maxlength: 120 },
  design: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

visualDesignRevisionSchema.index({ invitation: 1, createdAt: -1 });

module.exports = mongoose.model('VisualDesignRevision', visualDesignRevisionSchema);
