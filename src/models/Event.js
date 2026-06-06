const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
