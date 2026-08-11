const crypto = require('crypto');
const slugify = require('slugify');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Invitation = require('../models/Invitation');
const EventAccessToken = require('../models/EventAccessToken');
const EventMember = require('../models/EventMember');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');
const env = require('../config/env');

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function buildInviteToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    hash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
  };
}

function serializeMember(member) {
  return {
    id: member._id,
    user: member.user,
    email: member.email,
    name: member.name,
    role: member.role,
    permissions: member.permissions || [],
    status: member.status,
    invitedAt: member.invitedAt,
    inviteTokenExpiresAt: member.inviteTokenExpiresAt,
    inviteEmailSentAt: member.inviteEmailSentAt,
    acceptedAt: member.acceptedAt,
    lastUsedAt: member.lastUsedAt,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt
  };
}

function defaultPermissionsForRole(role) {
  return EventMember.ROLE_PERMISSIONS[role] || EventMember.ROLE_PERMISSIONS.client;
}

async function activateInvitedMembersForUser(user) {
  if (!user?.email) return;
  await EventMember.updateMany(
    {
      email: normalizeEmail(user.email),
      status: 'invited',
      $or: [{ user: { $exists: false } }, { user: null }, { user: user._id }]
    },
    {
      $set: {
        user: user._id,
        status: 'active',
        acceptedAt: new Date()
      },
      $unset: {
        inviteTokenHash: '',
        inviteTokenExpiresAt: ''
      }
    }
  );
}

async function findOwnedOrMemberEvent(eventId, user, permission = 'view_event') {
  const owned = await Event.findOne({ _id: eventId, owner: user._id });
  if (owned) return { event: owned, access: { owner: true, permissions: EventMember.PERMISSIONS } };

  let member = await EventMember.findOne({
    event: eventId,
    user: user._id,
    status: 'active',
    permissions: permission
  });

  if (!member && user.email) {
    const invited = await EventMember.findOne({
      event: eventId,
      email: normalizeEmail(user.email),
      status: 'invited',
      $or: [{ user: { $exists: false } }, { user: null }, { user: user._id }]
    });
    if (invited) {
      invited.user = user._id;
      invited.status = 'active';
      invited.acceptedAt = invited.acceptedAt || new Date();
      invited.inviteTokenHash = undefined;
      invited.inviteTokenExpiresAt = undefined;
      await invited.save();
      if ((invited.permissions || []).includes(permission)) member = invited;
    }
  }

  if (!member) return null;
  member.lastUsedAt = new Date();
  await member.save();
  const event = await Event.findById(eventId);
  return event ? { event, access: { owner: false, role: member.role, permissions: member.permissions } } : null;
}

async function buildUniquePortalSlug(source, excludeId) {
  const base = slugify(source || 'evento', { lower: true, strict: true }) || 'evento';
  let slug = base;
  let counter = 1;
  const query = () => ({ externalPortalSlug: slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
  while (await Event.exists(query())) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

function normalizeExternalPortalSettings(settings = {}) {
  return {
    rsvpEnabled: settings.rsvpEnabled !== false,
    albumEnabled: settings.albumEnabled !== false,
    passEnabled: settings.passEnabled !== false,
    calendarEnabled: settings.calendarEnabled !== false,
    showLocation: settings.showLocation !== false,
    brandLabel: settings.brandLabel,
    welcomeMessage: settings.welcomeMessage
  };
}

async function ensureExternalPortalPayload(payload, currentEvent) {
  if (payload.mode !== 'external_dashboard' && currentEvent?.mode !== 'external_dashboard') return payload;
  const next = { ...payload };
  if (!next.externalPortalSlug && !currentEvent?.externalPortalSlug) {
    next.externalPortalSlug = await buildUniquePortalSlug(next.title || currentEvent?.title, currentEvent?._id);
  }
  if (next.externalPortalSettings || !currentEvent?.externalPortalSettings) {
    next.externalPortalSettings = normalizeExternalPortalSettings(next.externalPortalSettings);
  }
  return next;
}

function publicGuest(guest) {
  return {
    id: guest._id,
    name: guest.name,
    email: guest.email,
    allowedCompanions: guest.allowedCompanions,
    status: guest.status,
    communicationStatus: guest.communicationStatus,
    checkInCode: guest.checkInCode,
    qrCode: guest.qrCode,
    tableName: guest.tableName,
    seatLabel: guest.seatLabel,
    companions: guest.companions || []
  };
}

function publicExternalEvent(event) {
  return {
    id: event._id,
    mode: event.mode,
    type: event.type,
    title: event.title,
    hosts: event.hosts,
    date: event.date,
    venue: event.venue,
    agenda: event.agenda,
    externalSiteUrl: event.externalSiteUrl,
    externalSiteLabel: event.externalSiteLabel,
    externalPortalSlug: event.externalPortalSlug,
    externalPortalEnabled: event.externalPortalEnabled,
    externalPortalSettings: normalizeExternalPortalSettings(event.externalPortalSettings || {})
  };
}

exports.list = asyncHandler(async (req, res) => {
  await activateInvitedMembersForUser(req.user);
  const memberships = await EventMember.find({ user: req.user._id, status: 'active', permissions: 'view_event' }).select('event role permissions').lean();
  const memberEventIds = memberships.map((member) => member.event);
  const membershipByEvent = new Map(memberships.map((member) => [String(member.event), member]));
  const events = await Event.find({ $or: [{ owner: req.user._id }, { _id: { $in: memberEventIds } }] }).sort('-createdAt').lean();
  events.forEach((event) => {
    const member = membershipByEvent.get(String(event._id));
    event.access = String(event.owner) === String(req.user._id)
      ? { owner: true, permissions: EventMember.PERMISSIONS }
      : { owner: false, role: member?.role, permissions: member?.permissions || [] };
  });
  res.json({ events });
});

exports.create = asyncHandler(async (req, res) => {
  const payload = await ensureExternalPortalPayload(req.validated.body);
  const event = await Event.create({ ...payload, owner: req.user._id });
  res.status(201).json({ event });
});

exports.get = asyncHandler(async (req, res) => {
  const result = await findOwnedOrMemberEvent(req.params.id, req.user);
  if (!result) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  res.json({ event: result.event, access: result.access });
});

exports.update = asyncHandler(async (req, res) => {
  const current = await Event.findOne({ _id: req.params.id, owner: req.user._id });
  if (!current) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const payload = await ensureExternalPortalPayload(req.validated.body, current);
  const event = await Event.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, payload, { new: true });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  res.json({ event });
});

exports.publicByPortalSlug = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    externalPortalSlug: req.params.portalSlug,
    mode: 'external_dashboard',
    externalPortalEnabled: { $ne: false }
  });
  if (!event) {
    const error = new Error('Portal no disponible');
    error.statusCode = 404;
    throw error;
  }
  res.json({ event: publicExternalEvent(event) });
});

exports.publicGuestAccess = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    externalPortalSlug: req.params.portalSlug,
    mode: 'external_dashboard',
    externalPortalEnabled: { $ne: false }
  }).select('_id');
  if (!event) {
    const error = new Error('Portal no disponible');
    error.statusCode = 404;
    throw error;
  }
  const guest = await Guest.findOne({
    event: event._id,
    email: req.validated.body.email.toLowerCase().trim()
  }).select('name email allowedCompanions status communicationStatus checkInCode qrCode tableName seatLabel companions invitationToken');
  if (!guest) {
    const error = new Error('Este correo no esta en la lista de invitados');
    error.statusCode = 403;
    throw error;
  }
  res.json({ guest: publicGuest(guest) });
});

exports.publicGuestByToken = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    externalPortalSlug: req.params.portalSlug,
    mode: 'external_dashboard',
    externalPortalEnabled: { $ne: false }
  }).select('_id');
  if (!event) {
    const error = new Error('Portal no disponible');
    error.statusCode = 404;
    throw error;
  }
  const guest = await Guest.findOne({
    event: event._id,
    invitationToken: String(req.params.token || '').trim()
  }).select('name email allowedCompanions status communicationStatus checkInCode qrCode tableName seatLabel companions invitationOpenedAt');
  if (!guest) {
    const error = new Error('Link personalizado invalido');
    error.statusCode = 404;
    throw error;
  }
  guest.invitationOpenedAt = guest.invitationOpenedAt || new Date();
  if (guest.communicationStatus === 'sent') guest.communicationStatus = 'opened';
  await guest.save();
  res.json({ guest: publicGuest(guest) });
});

exports.listAccessLinks = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const links = await EventAccessToken.find({ owner: req.user._id, event: event._id }).sort('-createdAt');
  res.json({ links: links.map((link) => ({
    id: link._id,
    role: link.role,
    label: link.label,
    tokenPreview: `${String(link.token).slice(0, 6)}...${String(link.token).slice(-4)}`,
    accessToken: link.role === 'integration_api' ? link.token : undefined,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
    lastUsedAt: link.lastUsedAt,
    createdAt: link.createdAt,
    url: `${env.clientUrl}/external-access/${link.token}`
  })) });
});

exports.createAccessLink = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const days = Number(req.validated.body.days || 7);
  const access = await EventAccessToken.create({
    owner: req.user._id,
    event: event._id,
    token: crypto.randomBytes(24).toString('hex'),
    role: req.validated.body.role,
    label: req.validated.body.label,
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  });
  res.status(201).json({
    link: {
      id: access._id,
      role: access.role,
      label: access.label,
      tokenPreview: `${String(access.token).slice(0, 6)}...${String(access.token).slice(-4)}`,
      accessToken: access.role === 'integration_api' ? access.token : undefined,
      expiresAt: access.expiresAt,
      url: `${env.clientUrl}/external-access/${access.token}`
    }
  });
});

exports.revokeAccessLink = asyncHandler(async (req, res) => {
  const link = await EventAccessToken.findOneAndUpdate(
    { _id: req.params.linkId, event: req.params.eventId, owner: req.user._id },
    { revokedAt: new Date() },
    { new: true }
  );
  if (!link) {
    const error = new Error('Link no encontrado');
    error.statusCode = 404;
    throw error;
  }
  res.json({ message: 'Link revocado' });
});

exports.listMembers = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const members = await EventMember.find({ owner: req.user._id, event: event._id }).sort('-createdAt').populate('user', 'name email role accountType avatarUrl');
  res.json({ members: members.map(serializeMember), permissions: EventMember.PERMISSIONS, rolePermissions: EventMember.ROLE_PERMISSIONS });
});

exports.createMember = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id owner title date');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const email = normalizeEmail(req.validated.body.email);
  const user = await User.findOne({ email }).select('_id name email');
  const invite = buildInviteToken();
  const member = await EventMember.findOneAndUpdate(
    { event: event._id, email },
    {
      owner: req.user._id,
      event: event._id,
      user: user?._id,
      email,
      name: req.validated.body.name || user?.name,
      role: req.validated.body.role,
      permissions: req.validated.body.permissions || defaultPermissionsForRole(req.validated.body.role),
      status: user ? 'active' : 'invited',
      inviteTokenHash: invite.hash,
      inviteTokenExpiresAt: invite.expiresAt,
      invitedBy: req.user._id,
      invitedAt: new Date(),
      ...(user ? { acceptedAt: new Date() } : {})
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const inviteUrl = `${env.frontendUrl.replace(/\/$/, '')}/new/member-invite/${invite.token}`;
  let inviteEmailSent = false;
  let inviteEmailError = '';
  if (emailService.isEmailConfigured()) {
    try {
      await emailService.sendEventMemberInviteEmail({
        to: email,
        name: member.name || user?.name || email,
        event,
        inviter: req.user,
        role: member.role,
        permissions: member.permissions || [],
        inviteUrl,
        hasAccount: Boolean(user)
      });
      member.inviteEmailSentAt = new Date();
      await member.save();
      inviteEmailSent = true;
    } catch (error) {
      inviteEmailError = error.message;
      console.warn('Event member invite email failed:', error.message);
    }
  } else {
    inviteEmailError = 'SMTP no configurado';
  }
  res.status(201).json({ member: serializeMember(member), inviteEmailSent, inviteEmailError });
});

exports.getMemberInvite = asyncHandler(async (req, res) => {
  const hash = crypto.createHash('sha256').update(String(req.params.token || '')).digest('hex');
  const member = await EventMember.findOne({ inviteTokenHash: hash, status: { $ne: 'disabled' } })
    .populate('event', 'title date')
    .select('email name role permissions status inviteTokenExpiresAt acceptedAt event');
  if (!member) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }
  if (member.inviteTokenExpiresAt && member.inviteTokenExpiresAt < new Date()) {
    const error = new Error('La invitacion expiro. Solicita un nuevo acceso al dueno del evento.');
    error.statusCode = 410;
    throw error;
  }
  const user = await User.findOne({ email: member.email }).select('_id');
  res.json({
    invite: {
      email: member.email,
      name: member.name,
      role: member.role,
      permissions: member.permissions || [],
      status: member.status,
      acceptedAt: member.acceptedAt,
      hasAccount: Boolean(user),
      event: member.event ? {
        id: member.event._id,
        title: member.event.title,
        date: member.event.date
      } : undefined
    }
  });
});

exports.acceptMemberInvite = asyncHandler(async (req, res) => {
  const hash = crypto.createHash('sha256').update(String(req.params.token || '')).digest('hex');
  const member = await EventMember.findOne({ inviteTokenHash: hash, status: { $ne: 'disabled' } }).populate('event', 'title');
  if (!member) {
    const error = new Error('Invitacion no encontrada');
    error.statusCode = 404;
    throw error;
  }
  if (member.inviteTokenExpiresAt && member.inviteTokenExpiresAt < new Date()) {
    const error = new Error('La invitacion expiro. Solicita un nuevo acceso al dueno del evento.');
    error.statusCode = 410;
    throw error;
  }
  if (normalizeEmail(req.user.email) !== member.email) {
    const error = new Error('Esta invitacion pertenece a otro correo');
    error.statusCode = 403;
    throw error;
  }
  member.user = req.user._id;
  member.status = 'active';
  member.acceptedAt = member.acceptedAt || new Date();
  member.lastUsedAt = new Date();
  member.inviteTokenHash = undefined;
  member.inviteTokenExpiresAt = undefined;
  await member.save();
  res.json({ member: serializeMember(member), eventId: member.event?._id || member.event });
});

exports.updateMember = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id }).select('_id');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const member = await EventMember.findOneAndUpdate(
    { _id: req.params.memberId, owner: req.user._id, event: event._id },
    {
      ...req.validated.body,
      ...(req.validated.body.role && !req.validated.body.permissions ? { permissions: defaultPermissionsForRole(req.validated.body.role) } : {})
    },
    { new: true }
  );
  if (!member) {
    const error = new Error('Miembro no encontrado');
    error.statusCode = 404;
    throw error;
  }
  res.json({ member: serializeMember(member) });
});

exports.removeMember = asyncHandler(async (req, res) => {
  const member = await EventMember.findOneAndUpdate(
    { _id: req.params.memberId, owner: req.user._id, event: req.params.eventId },
    { status: 'disabled' },
    { new: true }
  );
  if (!member) {
    const error = new Error('Miembro no encontrado');
    error.statusCode = 404;
    throw error;
  }
  res.json({ message: 'Miembro desactivado', member: serializeMember(member) });
});

async function primaryInvitationForEvent(eventId, owner) {
  const published = await Invitation.findOne({ event: eventId, owner, status: 'published' }).sort('-publishedAt');
  if (published) return published;
  return Invitation.findOne({ event: eventId, owner }).sort('-createdAt');
}

function personalizedPublicUrl(invitation, guest) {
  const baseUrl = `${env.publicBaseUrl}/i/${invitation.slug}`;
  return guest.invitationToken ? `${baseUrl}?t=${encodeURIComponent(guest.invitationToken)}` : baseUrl;
}

function markEmailResult(guest, { type, status, error }) {
  guest.lastMessageType = type;
  guest.lastMessageChannel = 'email';
  if (status === 'sent') {
    guest.communicationStatus = 'sent';
    guest.lastMessageSentAt = new Date();
    guest.lastMessageError = undefined;
  } else {
    guest.communicationStatus = 'failed';
    guest.lastMessageError = String(error || 'No se pudo enviar el correo').slice(0, 240);
  }
}

exports.sendEmailBulk = asyncHandler(async (req, res) => {
  if (!req.validated.body.confirm) {
    const error = new Error('Confirma el envio masivo antes de continuar');
    error.statusCode = 400;
    throw error;
  }
  if (!emailService.isEmailConfigured()) {
    const error = new Error('SMTP no configurado');
    error.statusCode = 501;
    throw error;
  }
  const event = await Event.findOne({ _id: req.params.eventId, owner: req.user._id });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const invitation = await primaryInvitationForEvent(event._id, req.user._id);
  if (!invitation) {
    const error = new Error('Crea una invitacion antes de enviar email');
    error.statusCode = 400;
    throw error;
  }

  const query = { owner: req.user._id, event: event._id, email: { $exists: true, $ne: '' } };
  if (req.validated.body.guestIds?.length) query._id = { $in: req.validated.body.guestIds };
  const guests = await Guest.find(query).sort('name').limit(200);
  const type = req.validated.body.messageType || 'invitation';
  const results = [];

  for (const guest of guests) {
    try {
      await emailService.sendGuestInvitationEmail({
        to: guest.email,
        guest,
        event,
        invitation,
        publicUrl: personalizedPublicUrl(invitation, guest),
        type
      });
      markEmailResult(guest, { type, status: 'sent' });
      await guest.save();
      results.push({ guest: guest._id, status: 'sent' });
    } catch (error) {
      markEmailResult(guest, { type, status: 'failed', error: error.message });
      await guest.save();
      results.push({ guest: guest._id, status: 'failed', error: error.message });
    }
  }

  res.json({
    requested: guests.length,
    sent: results.filter((item) => item.status === 'sent').length,
    skipped: 0,
    failed: results.filter((item) => item.status === 'failed').length,
    results
  });
});
