const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const env = require('../src/config/env');
const app = require('../src/app');
const Guest = require('../src/models/Guest');
const Event = require('../src/models/Event');
const Invitation = require('../src/models/Invitation');
const WhatsAppMessageLog = require('../src/models/WhatsAppMessageLog');
const whatsappService = require('../src/services/whatsappService');
const { buildGuestPassWhatsAppMedia } = require('../src/services/guestPassWhatsAppMedia');

env.whatsappProvider = 'openwa';
env.openWaBaseUrl = 'http://openwa.invalid';
env.openWaApiKey = 'test-key';
env.openWaSessionId = 'test-session';

WhatsAppMessageLog.create = async (payload) => ({ ...payload, _id: 'test-log', save: async () => {} });
const guest = { _id: 'test-guest', owner: 'test-owner', event: 'test-event', name: 'Invitado de prueba', phone: '+522727088143', checkInCode: 'TEST-QR', allowedCompanions: 2 };
const event = { _id: 'test-event', owner: 'test-owner', title: 'Evento de prueba', date: '2026-10-12' };
const invitation = { _id: 'test-invitation', slug: 'evento-prueba', content: {} };
Guest.findById = async () => guest;
Event.findById = () => ({ populate: async () => event });
Invitation.findOne = async () => invitation;

let sentPayload;
let mediaResponseId = 'test-message';
const realFetch = global.fetch;
global.fetch = async (input, options = {}) => {
  const url = String(input);
  if (!url.startsWith('http://openwa.invalid/')) return realFetch(input, options);
  if (url.endsWith('/test-session')) return { ok: true, json: async () => ({ status: 'ready', phone: '5215511111111' }) };
  if (url.includes('/contacts/check/')) return { ok: true, json: async () => ({ exists: true, whatsappId: '5215522222222@c.us' }) };
  if (url.endsWith('/messages/send-image')) {
    assert(Buffer.byteLength(options.body) < 100_000, 'OpenWA request must stay below a typical JSON limit');
    sentPayload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ success: true, data: { messageId: mediaResponseId } }) };
  }
  throw new Error(`Unexpected request: ${url}`);
};

async function main() {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    env.apiPublicBaseUrl = '';
    env.openWaMediaBaseUrl = '';
    assert(buildGuestPassWhatsAppMedia({ guest, event, invitation }).url.startsWith(`http://host.docker.internal:${env.port}/api/guests/whatsapp-pass/`));
    env.apiPublicBaseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const media = buildGuestPassWhatsAppMedia({ guest, event, invitation });
    assert.equal(media.mimetype, 'image/png');
    assert(!media.base64);
    assert(new URL(media.url).pathname.endsWith('/pase.png'), 'whatsapp-web.js needs a PNG filename in the URL path');
    assert(media.url.startsWith(`http://host.docker.internal:${server.address().port}/api/`));

    const imageResponse = await realFetch(media.url.replace('host.docker.internal', '127.0.0.1'));
    assert.equal(imageResponse.status, 200);
    const png = Buffer.from(await imageResponse.arrayBuffer());
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');

    const invalidResponse = await realFetch(`${env.apiPublicBaseUrl}/guests/whatsapp-pass/invalid-token-value-long-enough`);
    assert.equal(invalidResponse.status, 401);
    const expiredToken = jwt.sign({ purpose: 'whatsapp-pass-image', guestId: guest._id, eventId: event._id }, env.jwtSecret, { audience: 'whatsapp-pass-image', expiresIn: -1 });
    const expiredResponse = await realFetch(`${env.apiPublicBaseUrl}/guests/whatsapp-pass/${expiredToken}`);
    assert.equal(expiredResponse.status, 401);

    const result = await whatsappService.sendMessage({ owner: 'test-owner', guest, event, invitation, type: 'invitation', media });
    assert.equal(result.status, 'sent');
    assert.equal(result.messageId, 'test-message');
    assert.equal(sentPayload.chatId, '5215522222222@c.us');
    assert.equal(sentPayload.url, media.url);
    assert.equal(sentPayload.base64, undefined);
    assert.equal(sentPayload.filename, 'pase-test-guest.png');
    assert(sentPayload.caption.includes('Invitado de prueba'));
    assert(sentPayload.caption.includes('/i/evento-prueba'));
    mediaResponseId = undefined;
    await assert.rejects(
      whatsappService.sendMessage({ owner: 'test-owner', guest, event, invitation, type: 'invitation', media }),
      /no devolvio un identificador/
    );
    console.log('Signed pass image URL and small OpenWA payload ok');
  } finally {
    server.close();
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
