const Stripe = require('stripe');
const Invitation = require('../models/Invitation');
const Payment = require('../models/Payment');
const User = require('../models/User');
const env = require('../config/env');
const { PLAN_DEFINITIONS, normalizePlan, getPlanDefinition } = require('../config/plans');
const asyncHandler = require('../utils/asyncHandler');

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

exports.listPlans = asyncHandler(async (_req, res) => {
  res.json({ plans: Object.values(PLAN_DEFINITIONS) });
});

exports.createCheckout = asyncHandler(async (req, res) => {
  const payload = req.validated.body;
  const planKey = normalizePlan(payload.package);
  const selected = getPlanDefinition(planKey);
  if (!selected || selected.key === 'free') {
    const error = new Error('Paquete invalido');
    error.statusCode = 400;
    throw error;
  }

  if (payload.invitation) {
    const invitation = await Invitation.findOne({ _id: payload.invitation, owner: req.user._id }).select('_id');
    if (!invitation) {
      const error = new Error('Invitacion no encontrada');
      error.statusCode = 404;
      throw error;
    }
  }

  const payment = await Payment.create({ owner: req.user._id, invitation: payload.invitation, package: selected.key, amount: selected.amount });
  if (!stripe) {
    return res.json({
      checkoutUrl: null,
      sessionId: null,
      manualPayment: true,
      payment,
      message: 'Stripe no esta configurado. Registra este pago manualmente antes de activar el plan.'
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${env.clientUrl}/dashboard?payment=success`,
    cancel_url: `${env.clientUrl}/dashboard?payment=cancelled`,
    line_items: [{ price_data: { currency: 'mxn', unit_amount: selected.amount, product_data: { name: selected.name } }, quantity: 1 }],
    metadata: { paymentId: String(payment._id), userId: String(req.user._id), package: selected.key }
  });
  payment.stripeSessionId = session.id;
  await payment.save();
  res.json({ checkoutUrl: session.url, sessionId: session.id });
});

exports.webhook = asyncHandler(async (req, res) => {
  if (!stripe || !env.stripeWebhookSecret) return res.status(501).json({ message: 'Stripe webhook no configurado' });
  const signature = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const payment = await Payment.findById(session.metadata.paymentId);
    if (payment && payment.status !== 'paid') {
      payment.status = 'paid';
      await payment.save();
      await User.findByIdAndUpdate(payment.owner, { plan: normalizePlan(payment.package) });
    }
  }
  res.json({ received: true });
});
