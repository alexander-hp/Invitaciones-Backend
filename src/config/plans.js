const PLAN_DEFINITIONS = {
  free: {
    key: 'free',
    name: 'Free Demo',
    amount: 0,
    billingType: 'free',
    scope: 'event',
    durationMonths: 0,
    stripePackage: null,
    stripePriceEnv: null,
    limits: {
      guests: 25,
      galleryImages: 3,
      music: false,
      premiumTemplates: false,
      exportData: false,
      whatsappMessaging: false,
      whatsappBulk: false,
      whatsappMedia: false,
      checkIn: false,
      seating: false,
      guestAlbum: false,
      customDomain: false,
      whiteLabel: false
    }
  },
  event: {
    key: 'event',
    name: 'Evento Individual',
    amount: 49900,
    billingType: 'one_time',
    scope: 'event',
    durationMonths: 12,
    stripePackage: 'event',
    stripePriceEnv: 'STRIPE_PRICE_EVENT_12M',
    limits: {
      guests: 200,
      galleryImages: 20,
      music: true,
      premiumTemplates: true,
      exportData: true,
      whatsappMessaging: true,
      whatsappBulk: false,
      whatsappMedia: true,
      checkIn: true,
      seating: true,
      guestAlbum: true,
      customDomain: false,
      whiteLabel: false
    }
  },
  event_12m: {
    key: 'event_12m',
    name: 'Evento Individual',
    amount: 49900,
    billingType: 'one_time',
    scope: 'event',
    durationMonths: 12,
    stripePackage: 'event_12m',
    stripePriceEnv: 'STRIPE_PRICE_EVENT_12M',
    limits: {
      guests: 200,
      galleryImages: 20,
      music: true,
      premiumTemplates: true,
      exportData: true,
      whatsappMessaging: true,
      whatsappBulk: false,
      whatsappMedia: true,
      checkIn: true,
      seating: true,
      guestAlbum: true,
      externalDashboard: false,
      customDomain: false,
      whiteLabel: false
    }
  },
  external_dashboard_12m: {
    key: 'external_dashboard_12m',
    name: 'Dashboard Externo',
    amount: 39900,
    billingType: 'one_time',
    scope: 'event',
    durationMonths: 12,
    stripePackage: 'external_dashboard_12m',
    stripePriceEnv: 'STRIPE_PRICE_EXTERNAL_DASHBOARD_12M',
    limits: {
      guests: 300,
      galleryImages: 50,
      music: true,
      premiumTemplates: false,
      exportData: true,
      whatsappMessaging: true,
      whatsappBulk: false,
      whatsappMedia: true,
      checkIn: true,
      seating: true,
      guestAlbum: true,
      externalDashboard: true,
      customDomain: false,
      whiteLabel: false
    }
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    amount: 149900,
    billingType: 'subscription',
    scope: 'account',
    billingCycle: 'monthly',
    durationMonths: 1,
    stripePackage: 'pro',
    stripePriceEnv: 'STRIPE_PRICE_PLANNER_PRO_MONTHLY',
    limits: {
      guests: 1000,
      galleryImages: 100,
      music: true,
      premiumTemplates: true,
      exportData: true,
      whatsappMessaging: true,
      whatsappBulk: true,
      whatsappMedia: true,
      checkIn: true,
      seating: true,
      guestAlbum: true,
      externalDashboard: true,
      customDomain: true,
      whiteLabel: true
    }
  },
  planner_pro_monthly: {
    key: 'planner_pro_monthly',
    name: 'Planner Pro Mensual',
    amount: 149900,
    billingType: 'subscription',
    scope: 'account',
    billingCycle: 'monthly',
    durationMonths: 1,
    stripePackage: 'planner_pro_monthly',
    stripePriceEnv: 'STRIPE_PRICE_PLANNER_PRO_MONTHLY',
    limits: {
      guests: 1000,
      galleryImages: 100,
      music: true,
      premiumTemplates: true,
      exportData: true,
      whatsappMessaging: true,
      whatsappBulk: true,
      whatsappMedia: true,
      checkIn: true,
      seating: true,
      guestAlbum: true,
      externalDashboard: true,
      customDomain: true,
      whiteLabel: true
    }
  },
  planner_pro_yearly: {
    key: 'planner_pro_yearly',
    name: 'Planner Pro Anual',
    amount: 1499900,
    billingType: 'subscription',
    scope: 'account',
    billingCycle: 'yearly',
    durationMonths: 12,
    stripePackage: 'planner_pro_yearly',
    stripePriceEnv: 'STRIPE_PRICE_PLANNER_PRO_YEARLY',
    limits: {
      guests: 1000,
      galleryImages: 100,
      music: true,
      premiumTemplates: true,
      exportData: true,
      whatsappMessaging: true,
      whatsappBulk: true,
      whatsappMedia: true,
      checkIn: true,
      seating: true,
      guestAlbum: true,
      externalDashboard: true,
      customDomain: true,
      whiteLabel: true
    }
  }
};

const LEGACY_PLAN_ALIASES = {
  basic: 'event_12m',
  premium: 'event_12m',
  event: 'event_12m',
  organizer: 'planner_pro_monthly',
  pro: 'planner_pro_monthly'
};

function normalizePlan(plan) {
  return LEGACY_PLAN_ALIASES[plan] || plan || 'free';
}

function getPlanDefinition(plan) {
  return PLAN_DEFINITIONS[normalizePlan(plan)] || PLAN_DEFINITIONS.free;
}

function getPlanLimits(user) {
  return getPlanDefinition(user?.plan).limits;
}

function isSubscriptionActive(user) {
  const status = user?.subscriptionStatus;
  if (!['active', 'trialing'].includes(status)) return false;
  const periodEnd = user?.subscriptionCurrentPeriodEnd;
  return !periodEnd || new Date(periodEnd) > new Date();
}

function isLegacyPro(user) {
  return ['pro', 'organizer'].includes(user?.plan);
}

function isEventPlanActive(event) {
  const plan = normalizePlan(event?.plan);
  if (!['event_12m', 'external_dashboard_12m'].includes(plan)) return false;
  return !event?.planExpiresAt || new Date(event.planExpiresAt) > new Date();
}

function effectivePlanKey(user, event) {
  if (isLegacyPro(user) || isSubscriptionActive(user)) return normalizePlan(user?.subscriptionPlan || user?.plan || 'planner_pro_monthly');
  if (isEventPlanActive(event)) return normalizePlan(event.plan);
  return 'free';
}

function getEffectivePlanDefinition(user, event) {
  return getPlanDefinition(effectivePlanKey(user, event));
}

function getEffectivePlanLimits(user, event) {
  return getEffectivePlanDefinition(user, event).limits;
}

function assertPlanFeature(user, feature, message) {
  const limits = getPlanLimits(user);
  if (limits[feature]) return;
  const error = new Error(message || 'Tu plan actual no incluye esta funcion');
  error.statusCode = 402;
  throw error;
}

function assertEffectivePlanFeature(user, event, feature, message) {
  const limits = getEffectivePlanLimits(user, event);
  if (limits[feature]) return;
  const error = new Error(message || 'El plan de este evento no incluye esta funcion');
  error.statusCode = 402;
  throw error;
}

function planExpiresAt(fromDate, planKey) {
  const definition = getPlanDefinition(planKey);
  if (!definition.durationMonths) return undefined;
  const expiresAt = new Date(fromDate || Date.now());
  expiresAt.setMonth(expiresAt.getMonth() + definition.durationMonths);
  return expiresAt;
}

module.exports = {
  PLAN_DEFINITIONS,
  LEGACY_PLAN_ALIASES,
  normalizePlan,
  getPlanDefinition,
  getPlanLimits,
  isSubscriptionActive,
  isEventPlanActive,
  effectivePlanKey,
  getEffectivePlanDefinition,
  getEffectivePlanLimits,
  assertPlanFeature,
  assertEffectivePlanFeature,
  planExpiresAt
};
