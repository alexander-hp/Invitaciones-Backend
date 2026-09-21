const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

const GOOGLE_MAP_HOSTS = new Set(['google.com', 'www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl']);
const GOOGLE_SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);
const userAgent = 'KyndraSoft-Invitaciones/1.0 (location-search)';
const searchCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 7000;
let lastNominatimRequestAt = 0;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function waitForNominatim() {
  const waitMs = Math.max(0, 1100 - (Date.now() - lastNominatimRequestAt));
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastNominatimRequestAt = Date.now();
}

function navigationLinks(lat, lon) {
  return {
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    wazeUrl: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`
  };
}

function nominatimAddress(item) {
  const address = item.address || {};
  return [
    address.road || address.pedestrian || address.suburb,
    address.house_number,
    address.city || address.town || address.village || address.county,
    address.state,
    address.country
  ].filter(Boolean).join(', ') || item.display_name || '';
}

async function searchGooglePlaces(query) {
  if (!env.googleMapsApiKey) return [];
  const response = await fetchWithTimeout('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.googleMapsApiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.nationalPhoneNumber,places.websiteUri,places.regularOpeningHours.weekdayDescriptions,places.primaryTypeDisplayName'
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'es', maxResultCount: 5 })
  });
  if (!response.ok) throw new Error(`Google Places respondió ${response.status}`);
  const payload = await response.json();
  return (payload.places || []).map((place) => {
    const lat = Number(place.location?.latitude);
    const lon = Number(place.location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      provider: 'google', externalId: place.id || '',
      name: place.displayName?.text || '', type: place.primaryTypeDisplayName?.text || '',
      address: place.formattedAddress || '', lat, lon,
      mapUrl: place.googleMapsUri || navigationLinks(lat, lon).mapUrl,
      wazeUrl: navigationLinks(lat, lon).wazeUrl,
      phone: place.nationalPhoneNumber || '', websiteUrl: place.websiteUri || '',
      schedule: place.regularOpeningHours?.weekdayDescriptions || []
    };
  }).filter(Boolean);
}

async function searchNominatim(query) {
  await waitForNominatim();
  const params = new URLSearchParams({ format: 'jsonv2', q: query, addressdetails: '1', limit: '5', 'accept-language': 'es' });
  const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Nominatim respondió ${response.status}`);
  const payload = await response.json();
  return payload.map((item) => {
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    return {
      provider: 'openstreetmap', externalId: String(item.place_id || ''),
      name: item.name || item.display_name?.split(',')[0] || query,
      type: item.type || item.category || '', address: nominatimAddress(item), lat, lon,
      ...navigationLinks(lat, lon), phone: '', websiteUrl: '', schedule: []
    };
  });
}

async function reverseGeocode(lat, lon) {
  await waitForNominatim();
  const params = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lon), addressdetails: '1', 'accept-language': 'es' });
  const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/reverse?${params}`, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  if (!response.ok) return {};
  const item = await response.json();
  return { name: item.name || item.address?.amenity || item.address?.building || '', address: nominatimAddress(item) };
}

function assertGoogleMapsUrl(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (![...GOOGLE_MAP_HOSTS].some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    const error = new Error('Solo se permiten enlaces de Google Maps');
    error.statusCode = 400;
    throw error;
  }
  return url;
}

async function resolveGoogleRedirect(url) {
  let current = assertGoogleMapsUrl(url);
  if (!GOOGLE_SHORT_HOSTS.has(current.hostname.toLowerCase())) return current.toString();
  for (let step = 0; step < 5; step += 1) {
    let response = await fetchWithTimeout(current, { method: 'HEAD', redirect: 'manual', headers: { 'User-Agent': userAgent } });
    if (response.status === 405) {
      response = await fetchWithTimeout(current, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': userAgent } });
    }
    const location = response.headers.get('location');
    if (!location) return current.toString();
    current = assertGoogleMapsUrl(new URL(location, current).toString());
  }
  return current.toString();
}

function parseGoogleMapsUrl(value) {
  let lat;
  let lon;
  let name = '';
  const pin = value.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const at = value.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const query = value.match(/[?&](?:query|q|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const coordinates = pin || at || query;
  if (coordinates) { lat = Number(coordinates[1]); lon = Number(coordinates[2]); }
  const place = value.match(/\/place\/([^/@?]+)/);
  if (place) name = decodeURIComponent(place[1].replace(/\+/g, ' '));
  return { lat, lon, name };
}

exports.search = asyncHandler(async (req, res) => {
  const cacheKey = req.query.q.trim().toLocaleLowerCase('es');
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return res.json({ ...cached.payload, cached: true });
  let places = [];
  let warning = '';
  if (env.googleMapsApiKey) {
    try { places = await searchGooglePlaces(req.query.q); }
    catch (error) { warning = error.message; }
  }
  if (!places.length) places = await searchNominatim(req.query.q);
  const payload = { places, provider: places[0]?.provider || 'none', warning };
  searchCache.set(cacheKey, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
  if (searchCache.size > 250) searchCache.delete(searchCache.keys().next().value);
  res.json(payload);
});

exports.inspectMapUrl = asyncHandler(async (req, res) => {
  const resolvedUrl = await resolveGoogleRedirect(req.body.url);
  const parsed = parseGoogleMapsUrl(resolvedUrl);
  const details = Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon) ? await reverseGeocode(parsed.lat, parsed.lon) : {};
  res.json({
    location: {
      name: parsed.name || details.name || '', address: details.address || '',
      lat: parsed.lat, lon: parsed.lon, mapUrl: resolvedUrl,
      wazeUrl: Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon) ? navigationLinks(parsed.lat, parsed.lon).wazeUrl : ''
    }
  });
});
