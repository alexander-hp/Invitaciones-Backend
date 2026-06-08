const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  invitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation' },
  package: { type: String, enum: ['event', 'pro', 'basic', 'premium', 'organizer'], required: true },
  stripeSessionId: String,
  status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  amount: Number,
  currency: { type: String, default: 'mxn' }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
