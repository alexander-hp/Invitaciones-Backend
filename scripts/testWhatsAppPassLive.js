const mongoose = require('mongoose');

const env = require('../src/config/env');
const Guest = require('../src/models/Guest');
const Event = require('../src/models/Event');
const Invitation = require('../src/models/Invitation');
const WhatsAppMessageLog = require('../src/models/WhatsAppMessageLog');
const whatsappService = require('../src/services/whatsappService');
const { buildGuestPassWhatsAppMedia } = require('../src/services/guestPassWhatsAppMedia');

const TEST_PHONE = '522727088143';

async function markGuestAsSent(guest) {
  guest.communicationStatus = 'sent';
  guest.lastMessageType = 'invitation';
  guest.lastMessageChannel = 'whatsapp';
  guest.lastMessageSentAt = new Date();
  guest.lastMessageError = undefined;
  await guest.save();
}

async function latestGatewayImageStatus(since) {
  const base = env.openWaBaseUrl.replace(/\/$/, '');
  const url = `${base}/api/sessions/${encodeURIComponent(env.openWaSessionId)}/messages?limit=30`;
  const response = await fetch(url, { headers: { 'X-API-Key': env.openWaApiKey } });
  if (!response.ok) return 'no disponible';
  const body = await response.json();
  const latest = (body.messages || []).find((message) =>
    message.type === 'image'
    && String(message.chatId || '').includes(TEST_PHONE.slice(2))
    && Date.parse(message.createdAt) >= since - 1000
  );
  return latest ? `${latest.status}, waMessageId=${latest.waMessageId ? 'si' : 'no'}` : 'no encontrado';
}

async function main() {
  const guestId = process.argv.find((arg) => arg.startsWith('--guest='))?.slice('--guest='.length);
  if (!process.argv.includes('--send') || !guestId || !mongoose.isValidObjectId(guestId)) {
    throw new Error('Uso: npm run test:whatsapp-pass:live -- --guest=<id> --send');
  }
  if (whatsappService.activeProvider() !== 'openwa') {
    throw new Error('La prueba real requiere WHATSAPP_PROVIDER=openwa.');
  }

  const session = await whatsappService.getOpenWaSessionStatus();
  if (!session.ready) throw new Error(`OpenWA no esta listo (${session.status}).`);

  await mongoose.connect(env.mongoUri);
  try {
    const guest = await Guest.findById(guestId);
    if (!guest || whatsappService.normalizePhone(guest.phone) !== TEST_PHONE) {
      throw new Error('El invitado no existe o su telefono no coincide con el numero de prueba autorizado.');
    }
    const event = await Event.findById(guest.event);
    if (!event || String(guest.owner) !== String(event.owner)) {
      throw new Error('No se encontro el evento correspondiente al invitado.');
    }
    const invitation = await Invitation.findOne({ event: event._id, owner: event.owner, status: 'published' }).sort('-publishedAt');
    if (!invitation) throw new Error('El evento no tiene una invitacion publicada para la prueba.');

    const previous = await WhatsAppMessageLog.findOne({
      guest: guest._id,
      event: event._id,
      provider: 'openwa',
      status: { $in: ['sent', 'delivered', 'read'] },
      messageId: { $exists: true, $nin: ['', null] },
      'payload.media.type': 'image',
      'payload.media.filename': `pase-${guest._id}.png`
    }).sort('-createdAt');
    if (previous && !process.argv.includes('--resend')) {
      await markGuestAsSent(guest);
      console.log(JSON.stringify({
        provider: previous.provider,
        status: previous.status,
        messageId: previous.messageId,
        logId: String(previous._id),
        reused: true
      }));
      return;
    }

    const media = buildGuestPassWhatsAppMedia({ guest, event, invitation });
    const localUrl = media.url.replace(/^http:\/\/host\.docker\.internal(?=[:/])/, 'http://127.0.0.1');
    const imageResponse = await fetch(localUrl);
    if (!imageResponse.ok || !String(imageResponse.headers.get('content-type')).startsWith('image/png')) {
      throw new Error(`El pase PNG no esta disponible para OpenWA (HTTP ${imageResponse.status}).`);
    }
    const png = Buffer.from(await imageResponse.arrayBuffer());
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new Error('La respuesta del pase no es un PNG valido.');
    }

    const startedAt = Date.now();
    let result;
    try {
      result = await whatsappService.sendMessage({
        owner: event.owner,
        guest,
        event,
        invitation,
        type: 'invitation',
        media
      });
    } catch (error) {
      const gatewayStatus = await latestGatewayImageStatus(startedAt).catch(() => 'no disponible');
      throw new Error(`OpenWA rechazo el pase: ${error.message}. Estado en gateway: ${gatewayStatus}. No reintentes sin revisar el chat y los logs del contenedor.`);
    }
    if (result.status !== 'sent' || !result.messageId) {
      throw new Error('OpenWA no confirmo el mensaje con imagen.');
    }
    await markGuestAsSent(guest);
    console.log(JSON.stringify({ provider: result.provider, status: result.status, messageId: result.messageId, logId: String(result.log._id), imageBytes: png.length }));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
