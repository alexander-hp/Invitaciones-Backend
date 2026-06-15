require('dotenv').config();

const Stripe = require('stripe');

const apiUrl = (process.env.STRIPE_TEST_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const webhookUrl = process.env.STRIPE_TEST_WEBHOOK_URL || 'http://localhost:4000/webhook';
const runId = Date.now();
const email = `stripe.${runId}@example.com`;
const password = 'StripeTest123!';

function assertEnv() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY no configurado');
  if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) throw new Error('STRIPE_SECRET_KEY no esta en modo test');
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET no configurado');
  if (!process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) throw new Error('STRIPE_WEBHOOK_SECRET no parece valido');
}

function idOf(document) {
  return document?._id || document?.id;
}

async function request(url, { method = 'GET', token, body, headers = {}, expected = [200] } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    throw new Error(`No se pudo conectar a ${url}. Verifica que Mongo este activo y que el backend este corriendo en localhost:4000.`);
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_error) {
      data = { raw: text };
    }
  }

  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${url} expected ${expected.join('/')} got ${response.status}: ${data.message || data.raw || response.statusText}`);
  }

  return data;
}

async function api(path, options = {}) {
  return request(`${apiUrl}${path}`, options);
}

async function postSignedWebhook(stripe, session) {
  const payload = JSON.stringify({
    id: `evt_local_${runId}`,
    object: 'event',
    api_version: '2026-05-27.dahlia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    type: 'checkout.session.completed',
    data: {
      object: {
        ...session,
        payment_status: 'paid',
        status: 'complete'
      }
    }
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET
  });

  return fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature
    },
    body: payload
  });
}

async function main() {
  assertEnv();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  console.log(`[stripe:test] API ${apiUrl}`);
  console.log(`[stripe:test] webhook ${webhookUrl}`);

  const registered = await api('/auth/register', {
    method: 'POST',
    expected: [201],
    body: { name: 'Stripe Tester', email, password, role: 'organizer' }
  });
  const token = registered.token;
  if (!token) throw new Error('Register no devolvio token');
  console.log('[stripe:test] user registered');

  const eventResult = await api('/events', {
    method: 'POST',
    token,
    expected: [201],
    body: {
      type: 'boda',
      title: `Stripe Test ${runId}`,
      hosts: ['Stripe Tester'],
      date: '2027-12-12',
      venue: { name: 'Stripe Venue', address: 'Test Address' }
    }
  });
  const eventId = idOf(eventResult.event);
  if (!eventId) throw new Error('Create event no devolvio id');
  console.log('[stripe:test] event created');

  const checkout = await api('/payments/checkout', {
    method: 'POST',
    token,
    body: { package: 'event_12m', event: eventId }
  });
  if (!checkout.sessionId || !checkout.checkoutUrl) throw new Error('Checkout no devolvio sessionId/checkoutUrl');
  console.log(`[stripe:test] checkout session ${checkout.sessionId}`);

  const session = await stripe.checkout.sessions.retrieve(checkout.sessionId);
  if (session.metadata?.package !== 'event_12m') throw new Error('Stripe session metadata.package inesperado');
  if (session.metadata?.eventId !== eventId) throw new Error('Stripe session metadata.eventId inesperado');
  if (!session.metadata?.paymentId) throw new Error('Stripe session sin metadata.paymentId');
  console.log('[stripe:test] stripe session retrieved');

  const webhookResponse = await postSignedWebhook(stripe, session);
  if (!webhookResponse.ok) {
    const text = await webhookResponse.text();
    throw new Error(`Webhook fallo ${webhookResponse.status}: ${text}`);
  }
  console.log('[stripe:test] signed webhook accepted');

  const status = await api(`/payments/status?eventId=${eventId}`, { token });
  if (status.eventPlan !== 'event_12m') throw new Error(`Plan de evento esperado event_12m, recibido ${status.eventPlan}`);
  if (!status.eventPlanExpiresAt) throw new Error('Evento pagado no devolvio fecha de expiracion');
  const payment = (status.payments || []).find((item) => item.stripeSessionId === checkout.sessionId);
  if (!payment || payment.status !== 'paid') throw new Error('Pago no quedo marcado como paid');
  console.log('[stripe:test] payment paid and event plan unlocked');
  console.log('[stripe:test] PASS');
}

main().catch((error) => {
  console.error('[stripe:test] FAIL');
  console.error(error.message);
  process.exit(1);
});
