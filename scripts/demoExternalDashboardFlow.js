const zlib = require('zlib');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');
const Event = require('../src/models/Event');

const apiUrl = (process.env.DEMO_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const clientUrl = (process.env.DEMO_CLIENT_URL || env.clientUrl || 'http://localhost:4200').replace(/\/$/, '');
const demoEmail = process.env.DEMO_EXTERNAL_EMAIL || 'external.demo@kyndrasoft.local';
const demoPassword = process.env.DEMO_EXTERNAL_PASSWORD || 'KyndraDemo2026!';
const guestEmail = process.env.DEMO_EXTERNAL_GUEST_EMAIL || 'hdezppalex@gmail.com';
const guestPhone = process.env.DEMO_EXTERNAL_GUEST_PHONE || '2727088143';
const eventTitle = process.env.DEMO_EXTERNAL_EVENT_TITLE || 'KyndraSoft Demo Dashboard Externo';

async function request(path, { method = 'GET', token, body, expected = [200] } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} expected ${expected.join('/')} got ${response.status}: ${data.message || text}`);
  }
  return data;
}

function idOf(document) {
  return document?._id || document?.id;
}

function crc32(buffer) {
  let crc = ~0;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function pngBuffer(width, height, topColor, bottomColor) {
  const rawRows = [];
  for (let y = 0; y < height; y += 1) {
    const ratio = y / Math.max(height - 1, 1);
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = 1 + x * 4;
      row[offset] = Math.round(topColor[0] * (1 - ratio) + bottomColor[0] * ratio);
      row[offset + 1] = Math.round(topColor[1] * (1 - ratio) + bottomColor[1] * ratio);
      row[offset + 2] = Math.round(topColor[2] * (1 - ratio) + bottomColor[2] * ratio);
      row[offset + 3] = 255;
    }
    rawRows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rawRows))),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function wavBuffer(seconds = 2, frequency = 440) {
  const sampleRate = 44100;
  const samples = sampleRate * seconds;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples; i += 1) {
    const value = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0x3fff;
    buffer.writeInt16LE(value, 44 + i * 2);
  }
  return buffer;
}

async function ensureDemoUser() {
  await mongoose.connect(env.mongoUri);
  const passwordHash = await User.hashPassword(demoPassword);
  await User.findOneAndUpdate(
    { email: demoEmail },
    { name: 'KyndraSoft Demo Externo', email: demoEmail, passwordHash, role: 'organizer', plan: 'free' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await mongoose.disconnect();
  return request('/auth/login', { method: 'POST', body: { email: demoEmail, password: demoPassword } });
}

async function ensureEvent(token) {
  const events = await request('/events', { token });
  const existing = (events.events || []).find((event) => event.title === eventTitle);
  if (existing) return existing;
  const created = await request('/events', {
    method: 'POST',
    token,
    expected: [201],
    body: {
      mode: 'external_dashboard',
      type: 'boda',
      title: eventTitle,
      hosts: ['KyndraSoft', 'Cliente Externo'],
      date: '2027-02-14T20:00:00.000Z',
      status: 'published',
      externalSiteUrl: `${clientUrl}/assets/external-demo-api.html`,
      externalSiteLabel: 'Pagina externa del cliente',
      externalPortalEnabled: true,
      externalPortalSettings: {
        brandLabel: 'KyndraSoft Demo',
        welcomeMessage: 'Confirma tu asistencia, consulta tu pase y comparte fotos.'
      },
      venue: {
        name: 'Hacienda Demo KyndraSoft',
        address: 'Av. Demo 123, Puebla',
        mapUrl: 'https://maps.google.com/?q=Hacienda+Demo+KyndraSoft'
      },
      agenda: [
        { time: '18:00', title: 'Ceremonia', description: 'Jardin principal' },
        { time: '20:00', title: 'Recepcion', description: 'Salon cristal' }
      ]
    }
  });
  return created.event;
}

async function activateDemoPlan(eventId) {
  await mongoose.connect(env.mongoUri);
  const now = new Date();
  await Event.findByIdAndUpdate(eventId, {
    plan: 'external_dashboard_12m',
    planActivatedAt: now,
    planExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    status: 'published'
  });
  await mongoose.disconnect();
}

async function uploadAsset(token, eventId, asset) {
  const upload = await request('/assets/upload-url', {
    method: 'POST',
    token,
    body: {
      fileName: asset.fileName,
      contentType: asset.contentType,
      folder: asset.folder,
      event: eventId,
      size: asset.buffer.length
    }
  });
  const put = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': asset.contentType },
    body: asset.buffer
  });
  if (!put.ok) throw new Error(`PUT ${asset.fileName} failed: ${put.status} ${put.statusText}`);
  return upload.publicUrl;
}

async function ensureGuest(token, eventId) {
  const guests = await request(`/guests/event/${eventId}`, { token });
  const existing = (guests.guests || []).find((guest) => guest.email === guestEmail);
  const payload = {
    name: 'Hdezpp Alex',
    email: guestEmail,
    phone: guestPhone,
    group: 'Demo VIP',
    roles: ['vip', 'familia'],
    tags: ['demo', 'pagina_externa'],
    relationshipLabel: 'Invitado principal',
    visibilityGroup: 'vip',
    tableName: 'Mesa Demo',
    seatLabel: 'A1',
    allowedCompanions: 2,
    companions: [
      { name: 'Acompanante Demo 1', tableName: 'Mesa Demo' },
      { name: 'Acompanante Demo 2', tableName: 'Mesa Demo' }
    ]
  };
  if (existing) {
    return (await request(`/guests/${idOf(existing)}`, { method: 'PATCH', token, body: payload })).guest;
  }
  return (await request('/guests', { method: 'POST', token, expected: [201], body: { event: eventId, ...payload } })).guest;
}

async function main() {
  console.log(`[demo:external] API ${apiUrl}`);
  const login = await ensureDemoUser();
  const token = login.token;
  const event = await ensureEvent(token);
  const eventId = idOf(event);
  await activateDemoPlan(eventId);

  const palette = [
    [[15, 118, 110], [190, 71, 100]],
    [[31, 42, 68], [183, 121, 31]],
    [[94, 92, 230], [14, 165, 233]],
    [[22, 101, 52], [245, 158, 11]],
    [[136, 19, 55], [30, 64, 175]],
    [[67, 56, 202], [236, 72, 153]],
    [[17, 24, 39], [20, 184, 166]],
    [[180, 83, 9], [124, 58, 237]]
  ];
  const imageAssets = palette.map((colors, index) => ({
    fileName: `demo-external-${index + 1}.png`,
    contentType: 'image/png',
    folder: index < 2 ? 'covers' : 'gallery',
    buffer: pngBuffer(960, 540, colors[0], colors[1])
  }));
  const audioMain = { fileName: 'demo-external-main.wav', contentType: 'audio/wav', folder: 'music', buffer: wavBuffer(2, 392) };
  const audioSection = { fileName: 'demo-external-section.wav', contentType: 'audio/wav', folder: 'music', buffer: wavBuffer(2, 523) };

  const urls = [];
  for (const asset of imageAssets) urls.push(await uploadAsset(token, eventId, asset));
  const musicUrl = await uploadAsset(token, eventId, audioMain);
  const sectionAudioUrl = await uploadAsset(token, eventId, audioSection);

  const externalContent = {
    coverImageUrl: urls[0],
    heroImageUrl: urls[1],
    carousel: urls.slice(2, 5),
    gallery: urls.slice(5, 8),
    spectacularImages: [urls[7]],
    musicUrl,
    audioSections: [{ title: 'Entrada demo', url: sectionAudioUrl, description: 'Audio reproducible subido por API KyndraSoft' }],
    locations: [
      {
        type: 'ceremonia',
        name: 'Jardin principal',
        address: 'Av. Demo 123, Puebla',
        mapUrl: 'https://maps.google.com/?q=Av.+Demo+123+Puebla',
        wazeUrl: 'https://waze.com/ul?q=Av.%20Demo%20123%20Puebla',
        notes: 'Acceso por puerta norte',
        time: '18:00'
      },
      {
        type: 'recepcion',
        name: 'Salon cristal',
        address: 'Av. Demo 123, Puebla',
        mapUrl: 'https://maps.google.com/?q=Salon+Cristal+Puebla',
        notes: 'Cena y pista',
        time: '20:00'
      }
    ],
    sections: [
      { key: 'dress-code', type: 'text', title: 'Dress code', body: 'Formal elegante. Esta seccion viene desde la API publica.', roles: ['vip', 'familia'], order: 1 },
      { key: 'timeline', type: 'timeline', title: 'Momentos clave', body: 'Ceremonia, cena, brindis y DJ.', order: 2 },
      { key: 'cta-rsvp', type: 'cta', title: 'Confirma asistencia', body: 'La pagina externa puede usar iframe o POST directo.', url: `${clientUrl}/assets/external-demo-api.html`, order: 3 }
    ],
    songRequestSettings: { enabled: true, maxRequestsPerGuest: 3, allowDedications: true }
  };

  const updated = await request(`/events/${eventId}`, {
    method: 'PATCH',
    token,
    body: {
      externalSiteUrl: `${clientUrl}/assets/external-demo-api.html?portal=${event.externalPortalSlug}`,
      externalSiteLabel: 'Pagina API directa',
      externalContent,
      externalPortalSettings: {
        brandLabel: 'KyndraSoft Demo',
        welcomeMessage: 'Demo completa con imagenes, audio, RSVP, album y DJ.'
      },
      status: 'published'
    }
  });

  const guest = await ensureGuest(token, eventId);
  const slug = updated.event.externalPortalSlug;
  const output = {
    dashboard: {
      email: demoEmail,
      password: demoPassword,
      eventUrl: `${clientUrl}/events/${eventId}`
    },
    guest: {
      email: guestEmail,
      phone: guestPhone,
      id: idOf(guest),
      invitationToken: guest.invitationToken
    },
    external: {
      portalSlug: slug,
      portalUrl: `${clientUrl}/e/${slug}`,
      widgetsDemoUrl: `${clientUrl}/assets/external-demo-widgets.html?portal=${slug}`,
      apiDemoUrl: `${clientUrl}/assets/external-demo-api.html?portal=${slug}`,
      apiConfigUrl: `${apiUrl}/external/${slug}/config`,
      apiAssetsUrl: `${apiUrl}/external/${slug}/assets?type=all`
    },
    assets: {
      cover: externalContent.coverImageUrl,
      hero: externalContent.heroImageUrl,
      carousel: externalContent.carousel,
      gallery: externalContent.gallery,
      music: externalContent.musicUrl,
      sectionAudio: sectionAudioUrl
    }
  };
  console.log(JSON.stringify(output, null, 2));
  console.log('[demo:external] PASS');
}

main().catch(async (error) => {
  try { await mongoose.disconnect(); } catch (_disconnectError) {}
  console.error('[demo:external] FAIL');
  console.error(error.message);
  process.exit(1);
});
