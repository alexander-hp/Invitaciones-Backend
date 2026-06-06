const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

function signToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
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

exports.requestPasswordReset = asyncHandler(async (_req, res) => {
  res.json({ message: 'Si el email existe, se enviara un enlace de recuperacion.' });
});
