const Event = require('../models/Event');
const EventMember = require('../models/EventMember');
const User = require('../models/User');

const OWNER_PLAN_SELECT = 'plan subscriptionPlan subscriptionStatus subscriptionCurrentPeriodEnd';

function accessForOwner() {
  return { owner: true, role: 'owner', permissions: EventMember.PERMISSIONS };
}

function accessForMember(member) {
  return { owner: false, role: member.role, permissions: member.permissions || [] };
}

async function ownerPlanUserFor(event, currentUser) {
  if (String(event.owner) === String(currentUser._id)) return currentUser;
  if (typeof event.owner === 'object' && event.owner?.subscriptionStatus !== undefined) return event.owner;
  return User.findById(event.owner).select(OWNER_PLAN_SELECT);
}

async function requireEventAccess({ eventId, user, permission = 'view_event', select = '' }) {
  const event = await Event.findById(eventId).select(`${select} owner plan planExpiresAt`).lean(false);
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  if (String(event.owner) === String(user._id)) {
    return { event, ownerPlanUser: user, access: accessForOwner() };
  }

  const member = await EventMember.findOne({
    event: event._id,
    user: user._id,
    status: 'active',
    permissions: permission
  });
  if (!member) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  member.lastUsedAt = new Date();
  await member.save();
  const ownerPlanUser = await ownerPlanUserFor(event, user);
  return { event, ownerPlanUser, access: accessForMember(member), member };
}

module.exports = {
  requireEventAccess,
  OWNER_PLAN_SELECT
};
