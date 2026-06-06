const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const emailService = require('../services/emailService');
const asyncHandler = require('../utils/asyncHandler');

const PASSWORD_RESET_MESSAGE = 'Si el email existe, se enviara un enlace de recuperacion.';
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function signToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function logPasswordResetEmailError(error, user) {
  const details = {
    email: user.email,
    code: error.code,
    command: error.command,
    responseCode: error.responseCode,
    message: error.message
  };
  console.warn('Password reset email failed:', details);
}

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'client' } = req.body;
  const exists = await User.findOne({ email });
  if (exists) {
    const error = new Error('El email ya esta registrado');
    error.statusCode = 409;
    throw error;
  }
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role });
  res.status(201).json({ token: signToken(user), user: { id: user._id, name, email, role: user.role, plan: user.plan } });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    const error = new Error('Credenciales invalidas');
    error.statusCode = 401;
    throw error;
  }
  res.json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role, plan: user.plan } });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

exports.requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.validated.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ message: PASSWORD_RESET_MESSAGE });
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashResetToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await user.save();

  const resetUrl = `${env.frontendUrl}/password-reset/confirm?token=${encodeURIComponent(token)}`;
  try {
    await emailService.sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
  } catch (error) {
    logPasswordResetEmailError(error, user);
  }

  res.json({ message: PASSWORD_RESET_MESSAGE });
});

exports.confirmPasswordReset = asyncHandler(async (req, res) => {
  const { token, password } = req.validated.body;
  const user = await User.findOne({
    passwordResetTokenHash: hashResetToken(token),
    passwordResetExpiresAt: { $gt: new Date() }
  });

  if (!user) {
    const error = new Error('Token invalido o expirado');
    error.statusCode = 400;
    throw error;
  }

  user.passwordHash = await User.hashPassword(password);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  res.json({ message: 'Password actualizado correctamente.' });
});
