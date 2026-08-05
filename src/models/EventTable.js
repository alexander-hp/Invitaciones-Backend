const mongoose = require('mongoose');

const eventTableSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  name: { type: String, required: true, trim: true },
  capacity: { type: Number, required: true, min: 0, max: 100 },
  notes: { type: String, trim: true },
  order: { type: Number, default: 0 },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  floor: { type: Number, default: 1 },
  floorName: { type: String, trim: true, default: 'Planta Baja' },
  shape: { type: String, default: 'round' },
  width: { type: Number, default: 120 },
  height: { type: Number, default: 120 }
}, { timestamps: true });

eventTableSchema.index({ owner: 1, event: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('EventTable', eventTableSchema);
