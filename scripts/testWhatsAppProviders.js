const assert = require('assert');

process.env.WHATSAPP_PROVIDER = 'disabled';
process.env.PUBLIC_BASE_URL = 'http://localhost:4200';

const whatsappService = require('../src/services/whatsappService');
const emailService = require('../src/services/emailService');
const env = require('../src/config/env');

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

const editedBody = 'Nos encantará verte. <b>Confirma</b> tu asistencia.';
const editedWhatsApp = whatsappService.buildText({ guest, event, invitation, type: 'invitation', messageBody: editedBody });
assert(editedWhatsApp.includes(`Hola ${guest.name},`));
assert(editedWhatsApp.includes(editedBody));
assert(editedWhatsApp.includes('/i/smoke-wedding?t=abc123'));

const secondGuest = { ...guest, name: 'Second Guest', invitationToken: 'different-token' };
const secondText = whatsappService.buildText({ guest: secondGuest, event, invitation, type: 'invitation', messageBody: editedBody });
assert(secondText.includes('Hola Second Guest,'));
assert(secondText.includes('different-token'));
assert(!secondText.includes('abc123'));

const publicUrl = 'http://localhost:4200/i/smoke-wedding?t=abc123';
const editedEmail = emailService.buildGuestMessage({ guest, event, invitation, publicUrl, messageBody: editedBody });
assert(editedEmail.join('\n\n').includes(editedBody));
assert(editedEmail.join('\n\n').includes(publicUrl));
const html = emailService.buildGuestEmailHtml({ guest, event, invitation, publicUrl, messageBody: editedBody });
assert(html.includes('&lt;b&gt;Confirma&lt;/b&gt;'));
assert(!html.includes('<b>Confirma</b>'));

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

env.whatsappProvider = 'meta';
assert.rejects(
  () => whatsappService.sendMessage({ guest, event, invitation, messageBody: editedBody }),
  { statusCode: 400 }
).then(() => console.log('whatsapp providers and custom messages ok'));
