const PLAN_DEFINITIONS = {
  free: {
    key: 'free',
    name: 'Free Demo',
    amount: 0,
    stripePackage: null,
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
    stripePackage: 'event',
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
  pro: {
    key: 'pro',
    name: 'Pro',
    amount: 149900,
    stripePackage: 'pro',
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
      customDomain: true,
      whiteLabel: true
    }
  }
};

const LEGACY_PLAN_ALIASES = {
  basic: 'event',
  premium: 'event',
  organizer: 'pro'
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

function assertPlanFeature(user, feature, message) {
  const limits = getPlanLimits(user);
  if (limits[feature]) return;
  const error = new Error(message || 'Tu plan actual no incluye esta funcion');
  error.statusCode = 402;
  throw error;
}

module.exports = {
  PLAN_DEFINITIONS,
  LEGACY_PLAN_ALIASES,
  normalizePlan,
  getPlanDefinition,
  getPlanLimits,
  assertPlanFeature
};
