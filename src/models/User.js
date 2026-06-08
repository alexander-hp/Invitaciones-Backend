const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  passwordResetTokenHash: { type: String, index: true },
  passwordResetExpiresAt: Date,
  role: { type: String, enum: ['client', 'organizer', 'admin'], default: 'client' },
  plan: { type: String, enum: ['free', 'event', 'pro', 'basic', 'premium', 'organizer'], default: 'free' }
}, { timestamps: true });

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

module.exports = mongoose.model('User', userSchema);
