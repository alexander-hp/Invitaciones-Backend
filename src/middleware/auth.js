const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    const error = new Error('No autorizado');
    error.statusCode = 401;
    throw error;
  }

  const payload = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(payload.sub).select('-passwordHash');
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 401;
    throw error;
  }

  req.user = user;
  next();
});

const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) {
    const error = new Error('Permisos insuficientes');
    error.statusCode = 403;
    return next(error);
  }
  next();
};

module.exports = { protect, requireRole };
