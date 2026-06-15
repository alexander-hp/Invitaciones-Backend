const Stripe = require('stripe');
const Event = require('../models/Event');
const Invitation = require('../models/Invitation');
const Payment = require('../models/Payment');
const User = require('../models/User');
const env = require('../config/env');
const {
  PLAN_DEFINITIONS,
  normalizePlan,
  getPlanDefinition,
  getEffectivePlanDefinition,
  isSubscriptionActive,
  isEventPlanActive,
  planExpiresAt
} = require('../config/plans');
const asyncHandler = require('../utils/asyncHandler');

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;
const CANONICAL_PLAN_KEYS = ['free', 'event_12m', 'external_dashboard_12m', 'planner_pro_monthly', 'planner_pro_yearly'];

function canonicalPlans() {
  return CANONICAL_PLAN_KEYS.map((key) => PLAN_DEFINITIONS[key]);
}

function groupedPlans() {
  const plans = canonicalPlans();
  return {
    free: plans.filter((plan) => plan.billingType === 'free'),
    oneTime: plans.filter((plan) => plan.billingType === 'one_time' && plan.key !== 'external_dashboard_12m'),
    externalDashboard: plans.filter((plan) => plan.key === 'external_dashboard_12m'),
    subscriptions: plans.filter((plan) => plan.billingType === 'subscription')
  };
}

function priceIdForPlan(plan) {
  const map = {
    STRIPE_PRICE_EVENT_12M: env.stripePriceEvent12m,
    STRIPE_PRICE_EXTERNAL_DASHBOARD_12M: env.stripePriceExternalDashboard12m,
    STRIPE_PRICE_PLANNER_PRO_MONTHLY: env.stripePricePlannerProMonthly,
    STRIPE_PRICE_PLANNER_PRO_YEARLY: env.stripePricePlannerProYearly
  };
  return plan.stripePriceEnv ? map[plan.stripePriceEnv] : '';
}

function lineItemForPlan(plan) {
  const price = priceIdForPlan(plan);
  if (price) return { price, quantity: 1 };

  return {
    price_data: {
      currency: 'mxn',
      unit_amount: plan.amount,
      product_data: { name: plan.name },
      ...(plan.billingType === 'subscription'
        ? { recurring: { interval: plan.billingCycle === 'yearly' ? 'year' : 'month' } }
        : {})
    },
    quantity: 1
  };
}

function resolveRequestedPlan(payload) {
  const raw = normalizePlan(payload.package);
  if (raw === 'planner_pro_monthly' || raw === 'planner_pro_yearly') return raw;
  if (raw === 'external_dashboard_12m') return raw;
  if (raw === 'event_12m') return raw;
  if (payload.package === 'pro' || raw === 'planner_pro_monthly') {
    return payload.billingCycle === 'yearly' ? 'planner_pro_yearly' : 'planner_pro_monthly';
  }
  return raw;
}

async function eventForCheckout({ payload, owner }) {
  let eventId = payload.event;
  if (payload.invitation) {
    const invitation = await Invitation.findOne({ _id: payload.invitation, owner }).select('_id event');
    if (!invitation) {
      const error = new Error('Invitacion no encontrada');
      error.statusCode = 404;
      throw error;
    }
    eventId = String(invitation.event);
  }

  if (!eventId) return null;
  const event = await Event.findOne({ _id: eventId, owner }).select('_id title mode plan planActivatedAt planExpiresAt');
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  return event;
}

async function activateOneTimePayment(payment, stripeEventId) {
  const plan = getPlanDefinition(payment.package);
  if (plan.scope !== 'event' || !payment.event) return;

  const activatedAt = new Date();
  const expiresAt = planExpiresAt(activatedAt, plan.key);
  payment.status = 'paid';
  payment.paidAt = activatedAt;
  payment.expiresAt = expiresAt;
  payment.stripeEventId = stripeEventId;
  await payment.save();

  await Event.findOneAndUpdate(
    { _id: payment.event, owner: payment.owner },
    {
      plan: plan.key,
      planActivatedAt: activatedAt,
      planExpiresAt: expiresAt,
      ...(plan.key === 'external_dashboard_12m' ? { mode: 'external_dashboard' } : {})
    }
  );
}

async function applySubscriptionToUser({ userId, planKey, status, customerId, subscriptionId, currentPeriodEnd }) {
  await User.findByIdAndUpdate(userId, {
    subscriptionPlan: planKey,
    subscriptionStatus: status || 'active',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionCurrentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : undefined
  });
}

async function applySubscriptionObject(subscription) {
  const metadata = subscription.metadata || {};
  const userId = metadata.userId;
  const planKey = normalizePlan(metadata.package || metadata.plan || 'planner_pro_monthly');
  if (!userId) return;
  await applySubscriptionToUser({
    userId,
    planKey,
    status: subscription.status,
    customerId: subscription.customer,
    subscriptionId: subscription.id,
    currentPeriodEnd: subscription.current_period_end
  });
}

exports.listPlans = asyncHandler(async (_req, res) => {
  res.json({ plans: canonicalPlans(), groups: groupedPlans() });
});

exports.status = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ owner: req.user._id }).sort('-createdAt').limit(10);
  let event = null;
  if (req.query.eventId) {
    event = await Event.findOne({ _id: req.query.eventId, owner: req.user._id }).select('_id title mode plan planActivatedAt planExpiresAt');
    if (!event) {
      const error = new Error('Evento no encontrado');
      error.statusCode = 404;
      throw error;
    }
  }

  const subscriptionActive = isSubscriptionActive(req.user);
  const accountPlan = subscriptionActive ? normalizePlan(req.user.subscriptionPlan) : normalizePlan(req.user.plan);

  res.json({
    plan: accountPlan,
    planDefinition: getPlanDefinition(accountPlan),
    subscriptionPlan: req.user.subscriptionPlan,
    subscriptionStatus: req.user.subscriptionStatus || 'inactive',
    subscriptionActive,
    subscriptionCurrentPeriodEnd: req.user.subscriptionCurrentPeriodEnd,
    eventPlan: event ? normalizePlan(event.plan) : undefined,
    eventPlanDefinition: event ? getEffectivePlanDefinition(req.user, event) : undefined,
    eventPlanActive: event ? isEventPlanActive(event) : undefined,
    eventPlanActivatedAt: event?.planActivatedAt,
    eventPlanExpiresAt: event?.planExpiresAt,
    eventMode: event?.mode,
    payments
  });
});

exports.createCheckout = asyncHandler(async (req, res) => {
  const payload = req.validated.body;
  const planKey = resolveRequestedPlan(payload);
  const selected = getPlanDefinition(planKey);
  if (!selected || selected.key === 'free') {
    const error = new Error('Paquete invalido');
    error.statusCode = 400;
    throw error;
  }

  const event = await eventForCheckout({ payload, owner: req.user._id });
  if (selected.scope === 'event' && !event) {
    const error = new Error('Selecciona el evento que se desbloqueara con este pago');
    error.statusCode = 400;
    throw error;
  }

  const payment = await Payment.create({
    owner: req.user._id,
    event: event?._id,
    invitation: payload.invitation,
    package: selected.key,
    billingType: selected.billingType === 'subscription' ? 'subscription' : 'one_time',
    scope: selected.scope,
    amount: selected.amount
  });

  if (!stripe) {
    return res.json({
      checkoutUrl: null,
      sessionId: null,
      manualPayment: true,
      payment,
      message: 'Stripe no esta configurado. Registra este pago manualmente antes de activar el plan.'
    });
  }

  const metadata = {
    paymentId: String(payment._id),
    userId: String(req.user._id),
    eventId: event ? String(event._id) : '',
    package: selected.key,
    scope: selected.scope,
    billingType: selected.billingType
  };
  const sessionPayload = {
    mode: selected.billingType === 'subscription' ? 'subscription' : 'payment',
    success_url: `${env.clientUrl}/dashboard?payment=success`,
    cancel_url: `${env.clientUrl}/dashboard?payment=cancelled`,
    line_items: [lineItemForPlan(selected)],
    metadata
  };
  if (req.user.stripeCustomerId) {
    sessionPayload.customer = req.user.stripeCustomerId;
  } else {
    sessionPayload.customer_email = req.user.email;
  }
  if (selected.billingType === 'subscription') {
    sessionPayload.subscription_data = { metadata };
  }

  const session = await stripe.checkout.sessions.create(sessionPayload);
  payment.stripeSessionId = session.id;
  payment.stripeCustomerId = session.customer || req.user.stripeCustomerId;
  await payment.save();
  res.json({ checkoutUrl: session.url, sessionId: session.id, payment });
});

exports.webhook = asyncHandler(async (req, res) => {
  if (!stripe || !env.stripeWebhookSecret) return res.status(501).json({ message: 'Stripe webhook no configurado' });
  const signature = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
  console.log('Stripe event:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const payment = await Payment.findById(session.metadata?.paymentId) || await Payment.findOne({ stripeSessionId: session.id });
    if (payment && session.metadata?.userId && String(payment.owner) !== String(session.metadata.userId)) {
      console.warn('Stripe webhook user mismatch:', { paymentId: payment._id, eventId: event.id });
      return res.json({ received: true });
    }

    if (payment && payment.status !== 'paid') {
      payment.stripeSessionId = payment.stripeSessionId || session.id;
      payment.stripeCustomerId = session.customer;
      payment.stripeSubscriptionId = session.subscription;

      if (payment.billingType === 'subscription') {
        payment.status = 'paid';
        payment.paidAt = new Date();
        payment.stripeEventId = event.id;
        await payment.save();
        await applySubscriptionToUser({
          userId: payment.owner,
          planKey: payment.package,
          status: 'active',
          customerId: session.customer,
          subscriptionId: session.subscription,
          currentPeriodEnd: undefined
        });
      } else {
        await activateOneTimePayment(payment, event.id);
      }
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    const payment = await Payment.findById(session.metadata?.paymentId) || await Payment.findOne({ stripeSessionId: session.id });
    if (payment && payment.status === 'pending') {
      payment.status = 'failed';
      payment.stripeEventId = event.id;
      await payment.save();
    }
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      await applySubscriptionObject(subscription);
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    if (invoice.subscription) {
      const user = await User.findOne({ stripeSubscriptionId: invoice.subscription });
      if (user) {
        user.subscriptionStatus = 'past_due';
        await user.save();
      }
    }
  }

  if (event.type === 'customer.subscription.updated') {
    await applySubscriptionObject(event.data.object);
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const user = await User.findOne({ stripeSubscriptionId: subscription.id });
    if (user) {
      user.subscriptionStatus = 'canceled';
      user.subscriptionCurrentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : user.subscriptionCurrentPeriodEnd;
      await user.save();
    }
  }

  res.json({ received: true });
});
