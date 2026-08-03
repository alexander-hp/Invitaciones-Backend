const mongoose = require('mongoose');

const eventTableSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  name: { type: String, required: true, trim: true },
  shape: { 
    type: String, 
    enum: [
      'round', 
      'rect', 
      'oval', 
      'square', 
      'dance_floor', 
      'stage_dj', 
      'bar', 
      'gift_table', 
      'cake_table', 
      'photobooth', 
      'entrance'
    ], 
    default: 'round' 
  },
  capacity: { type: Number, required: true, min: 0, max: 100 },
  notes: { type: String, trim: true },
  order: { type: Number, default: 0 },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  width: { type: Number, default: 120 },
  height: { type: Number, default: 120 },
  floor: { type: Number, default: 1 },
  floorName: { type: String, trim: true }
}, { timestamps: true });

eventTableSchema.index({ owner: 1, event: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('EventTable', eventTableSchema);
