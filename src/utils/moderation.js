const emailService = require('../services/emailService');

function normalizeEmail(email) {
  return email ? String(email).toLowerCase().trim() : '';
}

function normalizePhone(value) {
  return value ? String(value).replace(/\D/g, '') : '';
}

function cleanList(values = [], normalizer = (value) => String(value || '').trim()) {
  return (values || []).map(normalizer).filter(Boolean);
}

function guestMatchesAutoApprove(guest, settings = {}) {
  if (!guest) return false;
  const roles = cleanList(guest.roles, (value) => String(value || '').toLowerCase().trim());
  const groups = cleanList([guest.group, guest.visibilityGroup]);
  const email = normalizeEmail(guest.email);
  const phone = normalizePhone(guest.phone);
  const allowedRoles = cleanList(settings.autoApproveRoles, (value) => String(value || '').toLowerCase().trim());
  const allowedGroups = cleanList(settings.autoApproveGroups);
  const allowedEmails = cleanList(settings.autoApproveEmails, normalizeEmail);
  const allowedPhones = cleanList(settings.autoApprovePhones, normalizePhone);
  return (
    roles.some((role) => allowedRoles.includes(role)) ||
    groups.some((group) => allowedGroups.includes(group)) ||
    (email && allowedEmails.includes(email)) ||
    (phone && allowedPhones.some((allowed) => phone.endsWith(allowed) || allowed.endsWith(phone)))
  );
}

function initialModerationStatus({ guest, settings = {}, kind, requireApproval = true }) {
  const flag = {
    album: 'autoApproveAlbum',
    song: 'autoApproveSongs',
    dedication: 'autoApproveDedications'
  }[kind];
  if (!requireApproval) return 'approved';
  if (flag && settings[flag] && guestMatchesAutoApprove(guest, settings)) return 'approved';
  return 'pending';
}

async function notifyReviewStatus({ guest, email, name, event, itemType, status, itemTitle, settings = {} }) {
  if (settings.notifyOnReview === false) return;
  const to = normalizeEmail(email || guest?.email);
  if (!to || !['approved', 'rejected', 'played', 'hidden'].includes(status)) return;
  try {
    await emailService.sendGuestReviewStatusEmail({
      to,
      name: name || guest?.name,
      event,
      itemType,
      status,
      itemTitle
    });
  } catch (error) {
    console.warn('Review status email failed:', error.message);
  }
}

module.exports = {
  initialModerationStatus,
  notifyReviewStatus
};
