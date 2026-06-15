const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  invitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation' },
  package: { type: String, enum: ['event', 'pro', 'basic', 'premium', 'organizer', 'event_12m', 'external_dashboard_12m', 'planner_pro_monthly', 'planner_pro_yearly'], required: true },
  billingType: { type: String, enum: ['one_time', 'subscription'], default: 'one_time' },
  scope: { type: String, enum: ['event', 'account'], default: 'event' },
  stripeSessionId: String,
  stripeEventId: String,
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  paidAt: Date,
  expiresAt: Date,
  amount: Number,
  currency: { type: String, default: 'mxn' }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
