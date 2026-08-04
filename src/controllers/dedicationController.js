const Dedication = require('../models/Dedication');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const Invitation = require('../models/Invitation');
const asyncHandler = require('../utils/asyncHandler');
const { verifyGuestSession } = require('../utils/guestSession');
const { initialModerationStatus, notifyReviewStatus } = require('../utils/moderation');
const { requireEventAccess } = require('../utils/eventAccess');

function normalizeEmail(email) {
  return email ? String(email).toLowerCase().trim() : '';
}

function publicDedication(dedication) {
  return {
    id: dedication._id,
    publicName: dedication.publicName,
    message: dedication.message,
    type: dedication.type,
    status: dedication.status,
    visibility: dedication.visibility,
    createdAt: dedication.createdAt,
    reviewedAt: dedication.reviewedAt
  };
}

function adminDedication(dedication) {
  return {
    id: dedication._id,
    _id: dedication._id,
    event: dedication.event,
    invitation: dedication.invitation,
    guest: dedication.guest,
    publicName: dedication.publicName,
    email: dedication.email,
    message: dedication.message,
    type: dedication.type,
    status: dedication.status,
    visibility: dedication.visibility,
    createdAt: dedication.createdAt,
    reviewedAt: dedication.reviewedAt
  };
}

async function getPublicExternalEvent(portalSlug) {
  const event = await Event.findOne({
    externalPortalSlug: portalSlug,
    mode: 'external_dashboard',
    externalPortalEnabled: { $ne: false }
  });
  if (!event) {
    const error = new Error('Portal externo no disponible');
    error.statusCode = 404;
    throw error;
  }
  return event;
}

async function findGuest(eventId, body) {
  if (body.guest) return Guest.findOne({ _id: body.guest, event: eventId }).select('_id name email phone group roles visibilityGroup');
  const email = normalizeEmail(body.email);
  if (email) return Guest.findOne({ email, event: eventId }).select('_id name email phone group roles visibilityGroup');
  return null;
}

exports.listExternalPublic = asyncHandler(async (req, res) => {
  const event = await getPublicExternalEvent(req.params.portalSlug);
  const dedications = await Dedication.find({ event: event._id, status: 'approved', visibility: 'public' })
    .select('publicName message type status visibility createdAt reviewedAt')
    .sort('-createdAt')
    .limit(100);
  res.json({ dedications: dedications.map(publicDedication) });
});

exports.createExternalPublic = asyncHandler(async (req, res) => {
  const event = await getPublicExternalEvent(req.params.portalSlug);
  let guest = null;
  if (req.get('authorization')) {
    const session = await verifyGuestSession(req, req.params.portalSlug);
    guest = session.guest;
  } else {
    guest = await findGuest(event._id, req.validated.body);
  }
  const status = initialModerationStatus({
    guest,
    settings: event.externalContent?.moderationSettings || {},
    kind: 'dedication',
    requireApproval: event.externalContent?.dedicationSettings?.requireApproval !== false
  });
  const dedication = await Dedication.create({
    owner: event.owner,
    event: event._id,
    guest: guest?._id,
    publicName: req.validated.body.publicName || guest?.name,
    email: normalizeEmail(req.validated.body.email) || guest?.email,
    message: req.validated.body.message,
    type: req.validated.body.type || 'dedication',
    status,
    reviewedAt: status === 'approved' ? new Date() : undefined,
    visibility: req.validated.body.visibility || 'public'
  });
  res.status(201).json({ dedication: publicDedication(dedication) });
});

exports.listInvitationPublic = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).select('_id event');
  if (!invitation) {
    const error = new Error('Invitacion no disponible');
    error.statusCode = 404;
    throw error;
  }
  const dedications = await Dedication.find({ invitation: invitation._id, status: 'approved', visibility: 'public' })
    .select('publicName message type status visibility createdAt reviewedAt')
    .sort('-createdAt')
    .limit(100);
  res.json({ dedications: dedications.map(publicDedication) });
});

exports.createInvitationPublic = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({ slug: req.params.slug, status: 'published' }).select('_id event owner content');
  if (!invitation) {
    const error = new Error('Invitacion no disponible');
    error.statusCode = 404;
    throw error;
  }
  const guest = await findGuest(invitation.event, req.validated.body);
  const status = initialModerationStatus({
    guest,
    settings: invitation.content?.moderationSettings || {},
    kind: 'dedication',
    requireApproval: invitation.content?.dedicationSettings?.requireApproval !== false
  });
  const dedication = await Dedication.create({
    owner: invitation.owner,
    event: invitation.event,
    invitation: invitation._id,
    guest: guest?._id,
    publicName: req.validated.body.publicName || guest?.name,
    email: normalizeEmail(req.validated.body.email) || guest?.email,
    message: req.validated.body.message,
    type: req.validated.body.type || 'dedication',
    status,
    reviewedAt: status === 'approved' ? new Date() : undefined,
    visibility: req.validated.body.visibility || 'public'
  });
  res.status(201).json({ dedication: publicDedication(dedication) });
});

exports.listAdmin = asyncHandler(async (req, res) => {
  const { event } = await requireEventAccess({ eventId: req.params.eventId, user: req.user, permission: 'review_dedications', select: '_id title externalContent' });
  const dedications = await Dedication.find({ event: event._id })
    .populate('guest', 'name group roles relationshipLabel tableName')
    .sort('-createdAt')
    .limit(200);
  res.json({ dedications: dedications.map(adminDedication) });
});

exports.updateAdmin = asyncHandler(async (req, res) => {
  const { event } = await requireEventAccess({ eventId: req.params.eventId, user: req.user, permission: 'review_dedications', select: '_id externalContent' });
  const dedication = await Dedication.findOneAndUpdate(
    { _id: req.params.dedicationId, event: event._id },
    { status: req.validated.body.status, reviewedAt: new Date() },
    { new: true }
  ).populate('guest', 'name group roles relationshipLabel tableName');
  if (!dedication) {
    const error = new Error('Dedicatoria no encontrada');
    error.statusCode = 404;
    throw error;
  }
  await notifyReviewStatus({
    guest: dedication.guest,
    email: dedication.email,
    name: dedication.publicName,
    event,
    itemType: 'dedication',
    status: dedication.status,
    itemTitle: dedication.message,
    settings: event.externalContent?.moderationSettings || {}
  });
  res.json({ dedication: adminDedication(dedication) });
});

exports.publicDedication = publicDedication;
