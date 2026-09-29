const DEFAULT_API_URL = 'http://localhost:4000/api';
const apiUrl = (process.env.SMOKE_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
const runId = Date.now();
const email = `smoke.${runId}@example.com`;
const password = 'SmokeTest123!';

async function request(path, { method = 'GET', token, body, expected = [200] } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_error) {
      data = { raw: text };
    }
  }

  if (!expected.includes(response.status)) {
    const message = data?.message || data?.raw || response.statusText;
    throw new Error(`${method} ${path} expected ${expected.join('/')} got ${response.status}: ${message}`);
  }

  return data || {};
}

function idOf(document) {
  return document?._id || document?.id;
}

function assertPublicInvitationPayload(invitation) {
  if (!invitation) throw new Error('Public invitation payload missing invitation');
  if (invitation.owner || invitation.owner === null) throw new Error('Public invitation leaks owner');
  if (invitation.createdAt || invitation.updatedAt) throw new Error('Public invitation leaks internal timestamps');
  if (invitation.event?.owner) throw new Error('Public event leaks owner');
  if (!invitation.id || !invitation.slug || !invitation.event?.title) throw new Error('Public invitation missing required public fields');
}

async function main() {
  console.log(`[smoke:mvp] API ${apiUrl}`);

  const registered = await request('/auth/register', {
    method: 'POST',
    expected: [201],
    body: { name: 'Smoke Tester', email, password, role: 'organizer' }
  });
  if (!registered.token) throw new Error('Register did not return token');
  console.log('[smoke:mvp] registered user');

  const loggedIn = await request('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  const token = loggedIn.token;
  if (!token) throw new Error('Login did not return token');
  console.log('[smoke:mvp] login ok');

  const eventResult = await request('/events', {
    method: 'POST',
    token,
    expected: [201],
    body: {
      type: 'boda',
      title: `Smoke Wedding ${runId}`,
      hosts: ['Smoke A', 'Smoke B'],
      date: '2027-11-21',
      venue: { name: 'Smoke Venue', address: 'Smoke Address', mapUrl: 'https://maps.google.com' }
    }
  });
  const eventId = idOf(eventResult.event);
  if (!eventId) throw new Error('Create event did not return id');
  console.log('[smoke:mvp] event created');

  const invitationResult = await request('/invitations', {
    method: 'POST',
    token,
    expected: [201],
    body: {
      event: eventId,
      slug: `smoke-${runId}`,
      accessMode: 'guest_list',
      content: {
        headline: `Smoke Wedding ${runId}`,
        subheadline: 'Smoke invitation',
        message: 'Automated MVP smoke test',
        palette: { primary: '#1f2a44', secondary: '#f7f2ea', accent: '#b67b4b' },
        gallery: [],
        dressCode: 'Formal',
        itinerary: [{ time: '18:00', title: 'Ceremonia', description: 'Jardin' }],
        giftRegistry: [{ label: 'Mesa smoke', url: 'https://example.com/regalos' }],
        lodging: [{ name: 'Hotel smoke', description: 'Tarifa preferente', url: 'https://example.com/hotel' }]
      },
      rsvpSettings: {
        customQuestions: [
          { key: 'song', label: 'Cancion sugerida', type: 'text', required: false },
          { key: 'menu', label: 'Menu', type: 'select', required: true, options: ['Pollo', 'Vegetariano'] }
        ]
      }
    }
  });
  const invitation = invitationResult.invitation;
  const invitationId = idOf(invitation);
  if (!invitationId || !invitation.slug) throw new Error('Create invitation did not return id/slug');
  console.log('[smoke:mvp] invitation created');
  await request(`/invitations/public/${invitation.slug}`, { expected: [404] });
  await request(`/invitations/public/${eventId}`, { expected: [404] });

  const guestEmail = `guest.${runId}@example.com`;
  const guestResult = await request('/guests', {
    method: 'POST',
    token,
    expected: [201],
    body: {
      event: eventId,
      name: 'Smoke Guest',
      email: guestEmail,
      allowedCompanions: 1
    }
  });
  const guestId = idOf(guestResult.guest);
  if (!guestId) throw new Error('Create guest did not return id');
  if (!guestResult.guest.invitationToken) throw new Error('Create guest did not return personalized invitation token');
  console.log('[smoke:mvp] guest created');

  await request(`/invitations/${invitationId}/publish`, { method: 'POST', token });
  console.log('[smoke:mvp] invitation published');

  await request(`/invitations/public/${invitation.slug}`, { expected: [401] });
  await request(`/invitations/public/${invitation.slug}/album`, { expected: [401] });
  await request(`/invitations/public/${invitation.slug}/dedications`, { expected: [401] });
  await request(`/invitations/public/${invitation.slug}/song-requests`, { expected: [401] });
  console.log('[smoke:mvp] restricted invitation requires a personal session');

  const access = await request(`/invitations/public/${invitation.slug}/guest-access`, {
    method: 'POST',
    body: { email: `unknown.${runId}@example.com` }
  });
  if (!access.message || access.guest || access.guestSessionToken) throw new Error('Contact lookup exposed guest data');
  console.log('[smoke:mvp] contact lookup does not expose guest data');

  const tokenAccess = await request(`/invitations/public/${invitation.slug}/guest-token/${guestResult.guest.invitationToken}`);
  if (tokenAccess.guest?.id !== guestId || !tokenAccess.guestSessionToken) throw new Error('Guest token access did not resolve the expected guest');
  const publicInvitation = await request(`/invitations/public/${invitation.slug}`, { token: tokenAccess.guestSessionToken });
  assertPublicInvitationPayload(publicInvitation.invitation);
  console.log('[smoke:mvp] personalized guest token ok');

  const rsvpPayload = {
    guest: tokenAccess.guest.id,
    name: tokenAccess.guest.name,
    email: tokenAccess.guest.email,
    response: 'confirmed',
    companions: 1,
    companionNames: ['Smoke Plus One'],
    customAnswers: [
      { key: 'song', label: 'Cancion sugerida', value: 'Smoke song' },
      { key: 'menu', label: 'Menu', value: 'Pollo' }
    ],
    message: 'Smoke RSVP confirmed'
  };
  await request(`/rsvps/public/${invitation.slug}`, { method: 'POST', body: rsvpPayload, expected: [401] });
  await request(`/invitations/public/${invitation.slug}/dedications`, {
    method: 'POST', body: { publicName: 'Smoke Guest', message: 'Private message' }, expected: [401]
  });
  await request(`/invitations/public/${invitation.slug}/song-requests`, {
    method: 'POST', body: { title: 'Private song' }, expected: [401]
  });
  const rsvpResult = await request(`/rsvps/public/${invitation.slug}`, {
    method: 'POST',
    expected: [201, 200],
    token: tokenAccess.guestSessionToken,
    body: rsvpPayload
  });
  if (!idOf(rsvpResult.rsvp)) throw new Error('RSVP did not return id');
  console.log('[smoke:mvp] rsvp submitted');

  const updatedRsvp = await request(`/rsvps/public/${invitation.slug}`, {
    method: 'POST',
    expected: [200],
    token: tokenAccess.guestSessionToken,
    body: { ...rsvpPayload, message: 'Smoke RSVP updated' }
  });
  if (!updatedRsvp.updated) throw new Error('Duplicate RSVP did not update existing RSVP');
  console.log('[smoke:mvp] duplicate rsvp updates existing response');

  const rsvps = await request(`/rsvps/event/${eventId}`, { token });
  if (!Array.isArray(rsvps.rsvps) || !rsvps.rsvps.some((item) => idOf(item) === idOf(rsvpResult.rsvp))) {
    throw new Error('Created RSVP was not found in event RSVP list');
  }
  console.log('[smoke:mvp] rsvp listed in admin');

  const dashboard = await request('/dashboard/summary', { token });
  if (!dashboard.metrics || dashboard.metrics.events < 1) throw new Error('Dashboard metrics missing or invalid');
  console.log('[smoke:mvp] dashboard metrics ok');

  const otherGuest = await request('/guests', {
    method: 'POST', token, expected: [201],
    body: { event: eventId, name: 'Other Guest', email: `other.${runId}@example.com` }
  });
  await request(`/invitations/${invitationId}`, {
    method: 'PATCH', token, body: { accessMode: 'specific_users', rsvpSettings: { allowedGuestIds: [guestId] } }
  });
  await request(`/invitations/public/${invitation.slug}`, { token: tokenAccess.guestSessionToken });
  await request(`/invitations/public/${invitation.slug}/guest-token/${otherGuest.guest.invitationToken}`, { expected: [403] });
  console.log('[smoke:mvp] specific-user access enforced');
  console.log('[smoke:mvp] PASS');
}

main().catch((error) => {
  console.error('[smoke:mvp] FAIL');
  console.error(error.message);
  process.exit(1);
});
