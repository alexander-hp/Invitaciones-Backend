const mongoose = require('mongoose');
const env = require('../src/config/env');
const Invitation = require('../src/models/Invitation');
const Guest = require('../src/models/Guest');
const Rsvp = require('../src/models/Rsvp');
const emailService = require('../src/services/emailService');

function reminderWindowStart(deadline, daysBefore) {
  return new Date(new Date(deadline).getTime() - daysBefore * 24 * 60 * 60 * 1000);
}

async function sendReminder({ to, name, invitation, deadline }) {
  const publicUrl = `${env.publicBaseUrl}/i/${invitation.slug}`;
  await emailService.sendRsvpReminderEmail({ to, name, invitation, deadline, publicUrl });
}

async function processInvitation(invitation) {
  const deadline = invitation.rsvpSettings?.deadline;
  if (!deadline) return { sent: 0, skipped: 0 };

  const now = new Date();
  const daysBefore = invitation.rsvpSettings?.reminderDaysBeforeDeadline ?? 3;
  if (now < reminderWindowStart(deadline, daysBefore) || now > new Date(deadline)) {
    return { sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;
  const publicUrl = `${env.publicBaseUrl}/i/${invitation.slug}`;

  const maybeRsvps = await Rsvp.find({ invitation: invitation._id, response: 'maybe', email: { $exists: true, $ne: '' } });
  for (const rsvp of maybeRsvps) {
    try {
      await emailService.sendRsvpReminderEmail({ to: rsvp.email, name: rsvp.name, invitation, deadline, publicUrl });
      sent += 1;
    } catch (error) {
      skipped += 1;
      console.warn('RSVP maybe reminder failed:', { email: rsvp.email, message: error.message });
    }
  }

  const pendingGuests = await Guest.find({ event: invitation.event, status: 'pending', email: { $exists: true, $ne: '' } });
  for (const guest of pendingGuests) {
    const hasRsvp = await Rsvp.exists({ invitation: invitation._id, guest: guest._id });
    if (hasRsvp) {
      skipped += 1;
      continue;
    }
    try {
      await sendReminder({ to: guest.email, name: guest.name, invitation, deadline });
      sent += 1;
    } catch (error) {
      skipped += 1;
      console.warn('RSVP guest reminder failed:', { email: guest.email, message: error.message });
    }
  }

  return { sent, skipped };
}

async function main() {
  await mongoose.connect(env.mongoUri);
  const invitations = await Invitation.find({
    status: 'published',
    'rsvpSettings.deadline': { $exists: true, $ne: null }
  });

  let totalSent = 0;
  let totalSkipped = 0;
  for (const invitation of invitations) {
    const result = await processInvitation(invitation);
    totalSent += result.sent;
    totalSkipped += result.skipped;
  }

  console.log('RSVP reminders complete:', { invitations: invitations.length, sent: totalSent, skipped: totalSkipped });
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('RSVP reminders error:', { message: error.message, code: error.code });
  await mongoose.disconnect();
  process.exit(1);
});
