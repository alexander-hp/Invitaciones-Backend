const Stripe = require('stripe');
const Invitation = require('../models/Invitation');
const Payment = require('../models/Payment');
const User = require('../models/User');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;
const packages = {
  basic: { amount: 19900, name: 'Invitacion Basica' },
  premium: { amount: 49900, name: 'Invitacion Premium' },
  organizer: { amount: 149900, name: 'Plan Organizador' }
};

exports.createCheckout = asyncHandler(async (req, res) => {
  if (!stripe) {
    const error = new Error('STRIPE_SECRET_KEY no configurado');
    error.statusCode = 501;
    throw error;
  }
  const payload = req.validated.body;
  const selected = packages[payload.package];
  if (!selected) {
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

  const payment = await Payment.create({ owner: req.user._id, invitation: payload.invitation, package: payload.package, amount: selected.amount });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${env.clientUrl}/dashboard?payment=success`,
    cancel_url: `${env.clientUrl}/dashboard?payment=cancelled`,
    line_items: [{ price_data: { currency: 'mxn', unit_amount: selected.amount, product_data: { name: selected.name } }, quantity: 1 }],
    metadata: { paymentId: String(payment._id), userId: String(req.user._id), package: payload.package }
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
      await User.findByIdAndUpdate(payment.owner, { plan: payment.package });
    }
  }
  res.json({ received: true });
});