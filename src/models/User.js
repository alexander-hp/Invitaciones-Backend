const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String },
  passwordResetTokenHash: { type: String, index: true },
  passwordResetExpiresAt: Date,
  role: { type: String, enum: ['client', 'organizer', 'venue_owner', 'vendor', 'admin'], default: 'client' },
  accountType: { type: String, enum: ['client', 'organizer', 'venue_owner', 'vendor', 'planner', 'staff'], default: 'client', index: true },
  authProviders: [{ type: String, enum: ['password', 'google', 'facebook', 'apple'] }],
  socialAccounts: [{
    provider: { type: String, enum: ['google', 'facebook', 'apple'], required: true },
    providerUserId: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    avatarUrl: { type: String, trim: true },
    connectedAt: { type: Date, default: Date.now }
  }],
  avatarUrl: { type: String, trim: true },
  plan: { type: String, enum: ['free', 'event', 'pro', 'basic', 'premium', 'organizer'], default: 'free' },
  subscriptionPlan: { type: String, enum: ['planner_pro_monthly', 'planner_pro_yearly'] },
  subscriptionStatus: { type: String, enum: ['inactive', 'active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete'], default: 'inactive', index: true },
  stripeCustomerId: { type: String, index: true },
  stripeSubscriptionId: { type: String, index: true },
  subscriptionCurrentPeriodEnd: Date
}, { timestamps: true });

userSchema.methods.comparePassword = function comparePassword(password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

userSchema.index({ 'socialAccounts.provider': 1, 'socialAccounts.providerUserId': 1 });

module.exports = mongoose.model('User', userSchema);
