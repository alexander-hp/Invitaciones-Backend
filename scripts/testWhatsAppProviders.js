const assert = require('assert');

process.env.WHATSAPP_PROVIDER = 'disabled';
process.env.PUBLIC_BASE_URL = 'http://localhost:4200';

const whatsappService = require('../src/services/whatsappService');

const guest = {
  name: 'Smoke Guest',
  phone: '3312345678',
  invitationToken: 'abc123'
};
const event = {
  title: 'Smoke Wedding',
  date: '2027-11-21',
  venue: { name: 'Smoke Venue', address: 'Smoke Address' }
};
const invitation = {
  slug: 'smoke-wedding',
  content: { headline: 'Smoke Wedding' }
};

assert.strictEqual(whatsappService.activeProvider(), 'disabled');
assert.strictEqual(whatsappService.normalizePhone('331 234 5678'), '523312345678');

const text = whatsappService.buildText({ guest, event, invitation, type: 'invitation' });
assert(text.includes('Smoke Wedding'));
assert(text.includes('/i/smoke-wedding?t=abc123'));

const payload = whatsappService.buildMetaTemplatePayload({
  phone: '523312345678',
  type: 'reminder',
  guest,
  event,
  invitation
});
assert.strictEqual(payload.messaging_product, 'whatsapp');
assert.strictEqual(payload.type, 'template');
assert.strictEqual(payload.template.name, 'rsvp_reminder');
assert.strictEqual(payload.to, '523312345678');

console.log('whatsapp providers ok');
