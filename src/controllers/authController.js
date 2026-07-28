const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const emailService = require('../services/emailService');
const asyncHandler = require('../utils/asyncHandler');

const PASSWORD_RESET_MESSAGE = 'Si el email existe, se enviara un enlace de recuperacion.';
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const SOCIAL_PROVIDERS = ['google', 'facebook', 'apple'];

function signToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountType: user.accountType,
    avatarUrl: user.avatarUrl,
    authProviders: user.authProviders || [],
    plan: user.plan,
    subscriptionPlan: user.subscriptionPlan,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd
  };
}

function normalizeAccountRole(role, accountType) {
  const normalizedRole = ['client', 'organizer', 'venue_owner', 'vendor'].includes(role) ? role : undefined;
  const normalizedAccountType = ['client', 'organizer', 'venue_owner', 'vendor', 'planner', 'staff'].includes(accountType) ? accountType : undefined;
  if (normalizedRole) return normalizedRole;
  if (normalizedAccountType === 'planner') return 'organizer';
  if (normalizedAccountType === 'staff') return 'vendor';
  return normalizedAccountType || 'client';
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error('No se pudo validar el proveedor social');
    error.statusCode = 401;
    throw error;
  }
  return response.json();
}

async function verifyGoogle({ idToken }) {
  if (!idToken) return null;
  const profile = await fetchJson(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (env.googleClientId && profile.aud !== env.googleClientId) {
    const error = new Error('Token Google no pertenece a esta aplicacion');
    error.statusCode = 401;
    throw error;
  }
  return {
    providerUserId: profile.sub,
    email: profile.email,
    name: profile.name || profile.email,
    avatarUrl: profile.picture
  };
}

async function verifyFacebook({ accessToken }) {
  if (!accessToken) return null;
  const profile = await fetchJson(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(accessToken)}`);
  return {
    providerUserId: profile.id,
    email: profile.email,
    name: profile.name || profile.email,
    avatarUrl: profile.picture?.data?.url
  };
}

function verifyApple({ idToken }) {
  if (!idToken) return null;
  const profile = decodeJwtPayload(idToken);
  if (!profile?.sub) return null;
  if (profile.exp && Number(profile.exp) * 1000 < Date.now()) {
    const error = new Error('Token Apple expirado');
    error.statusCode = 401;
    throw error;
  }
  if (env.appleClientId && profile.aud !== env.appleClientId) {
    const error = new Error('Token Apple no pertenece a esta aplicacion');
    error.statusCode = 401;
    throw error;
  }
  return {
    providerUserId: profile.sub,
    email: profile.email,
    name: profile.name || profile.email,
    avatarUrl: undefined
  };
}

async function resolveSocialProfile({ provider, idToken, accessToken, profile }) {
  let verifiedProfile = null;
  if (provider === 'google') verifiedProfile = await verifyGoogle({ idToken });
  if (provider === 'facebook') verifiedProfile = await verifyFacebook({ accessToken });
  if (provider === 'apple') verifiedProfile = verifyApple({ idToken });

  if (!verifiedProfile && env.allowUnverifiedSocialLogin && profile?.email) {
    verifiedProfile = {
      providerUserId: profile.providerUserId || profile.email,
      email: profile.email,
      name: profile.name || profile.email,
      avatarUrl: profile.avatarUrl
    };
  }

  if (!verifiedProfile?.email) {
    const error = new Error('No se pudo obtener un email verificable del proveedor social');
    error.statusCode = 401;
    throw error;
  }

  return {
    providerUserId: String(verifiedProfile.providerUserId || verifiedProfile.email),
    email: String(verifiedProfile.email).toLowerCase().trim(),
    name: String(verifiedProfile.name || verifiedProfile.email).trim(),
    avatarUrl: verifiedProfile.avatarUrl
  };
}

async function findOrCreateSocialUser({ provider, socialProfile, role, accountType }) {
  const roleValue = normalizeAccountRole(role, accountType);
  const accountTypeValue = accountType || roleValue;
  let user = await User.findOne({
    'socialAccounts.provider': provider,
    'socialAccounts.providerUserId': socialProfile.providerUserId
  });

  if (!user) {
    user = await User.findOne({ email: socialProfile.email });
  }

  if (!user) {
    user = await User.create({
      name: socialProfile.name,
      email: socialProfile.email,
      role: roleValue,
      accountType: accountTypeValue,
      avatarUrl: socialProfile.avatarUrl,
      authProviders: [provider],
      socialAccounts: [{ provider, providerUserId: socialProfile.providerUserId, email: socialProfile.email, avatarUrl: socialProfile.avatarUrl }]
    });
    return user;
  }

  const providers = new Set(user.authProviders || []);
  providers.add(provider);
  user.authProviders = Array.from(providers);
  if (!user.avatarUrl && socialProfile.avatarUrl) user.avatarUrl = socialProfile.avatarUrl;
  if (!user.accountType) user.accountType = accountTypeValue;
  const hasSocialAccount = (user.socialAccounts || []).some((account) => account.provider === provider && account.providerUserId === socialProfile.providerUserId);
  if (!hasSocialAccount) {
    user.socialAccounts.push({ provider, providerUserId: socialProfile.providerUserId, email: socialProfile.email, avatarUrl: socialProfile.avatarUrl });
  }
  await user.save();
  return user;
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
  const { name, email, password, role = 'client', accountType } = req.body;
  const exists = await User.findOne({ email });
  if (exists) {
    const error = new Error('El email ya esta registrado');
    error.statusCode = 409;
    throw error;
  }
  const passwordHash = await User.hashPassword(password);
  const roleValue = normalizeAccountRole(role, accountType);
  const user = await User.create({ name, email, passwordHash, role: roleValue, accountType: accountType || roleValue, authProviders: ['password'] });
  res.status(201).json({ token: signToken(user), user: sanitizeUser(user) });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    const error = new Error('Credenciales invalidas');
    error.statusCode = 401;
    throw error;
  }
  res.json({ token: signToken(user), user: sanitizeUser(user) });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

exports.socialLogin = asyncHandler(async (req, res) => {
  const { provider, idToken, accessToken, profile, role, accountType } = req.validated.body;
  if (!SOCIAL_PROVIDERS.includes(provider)) {
    const error = new Error('Proveedor social no soportado');
    error.statusCode = 400;
    throw error;
  }

  const socialProfile = await resolveSocialProfile({ provider, idToken, accessToken, profile });
  const user = await findOrCreateSocialUser({ provider, socialProfile, role, accountType });
  res.json({ token: signToken(user), user: sanitizeUser(user) });
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
