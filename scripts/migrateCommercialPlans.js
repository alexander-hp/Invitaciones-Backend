require('dotenv').config();

const { connectDatabase } = require('../src/config/database');
const Event = require('../src/models/Event');
const User = require('../src/models/User');
const { planExpiresAt } = require('../src/config/plans');

async function main() {
  await connectDatabase();

  const events = await Event.find({ plan: { $in: ['event', 'event_12m', 'external_dashboard_12m'] }, planExpiresAt: { $exists: false } });
  let migratedEvents = 0;
  for (const event of events) {
    const activatedAt = event.planActivatedAt || event.updatedAt || event.createdAt || new Date();
    const normalizedPlan = event.plan === 'event' ? 'event_12m' : event.plan;
    event.plan = normalizedPlan;
    event.planActivatedAt = event.planActivatedAt || activatedAt;
    event.planExpiresAt = planExpiresAt(activatedAt, normalizedPlan);
    await event.save();
    migratedEvents += 1;
  }

  const users = await User.find({ plan: { $in: ['pro', 'organizer'] }, subscriptionStatus: { $in: [undefined, null, 'inactive'] } });
  let migratedUsers = 0;
  for (const user of users) {
    user.subscriptionPlan = user.subscriptionPlan || 'planner_pro_monthly';
    user.subscriptionStatus = user.subscriptionStatus || 'active';
    await user.save();
    migratedUsers += 1;
  }

  console.log(`[migrate:commercial-plans] events=${migratedEvents} users=${migratedUsers}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[migrate:commercial-plans] FAIL');
  console.error(error.message);
  process.exit(1);
});
