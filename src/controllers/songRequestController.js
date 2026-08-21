const Event = require('../models/Event');
const SongRequest = require('../models/SongRequest');
const asyncHandler = require('../utils/asyncHandler');
const { notifyReviewStatus } = require('../utils/moderation');
const { logEventActivity } = require('../services/eventLogService');

function getYouTubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (parsed.hostname.includes('youtube.com')) return parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop() || '';
  } catch (_error) {
    return '';
  }
  return '';
}

function getSpotifyTrackId(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('spotify.com')) return '';
    const parts = parsed.pathname.split('/').filter(Boolean);
    const trackIndex = parts.indexOf('track');
    return trackIndex >= 0 ? parts[trackIndex + 1] || '' : '';
  } catch (_error) {
    return '';
  }
}

function normalizeSongLookup({ query, url, sourceUrl, title, artist }) {
  const raw = String(sourceUrl || url || query || '').trim();
  const cleanTitle = String(title || '').trim();
  const cleanArtist = String(artist || '').trim();
  if (!raw && (cleanTitle || cleanArtist)) {
    return { title: cleanTitle || 'Canción solicitada', artist: cleanArtist };
  }

  const youtubeId = /^https?:\/\//i.test(raw) ? getYouTubeId(raw) : '';
  if (youtubeId) {
    return {
      title: cleanTitle || 'Canción de YouTube',
      artist: cleanArtist,
      sourceProvider: 'youtube',
      sourceUrl: raw,
      externalId: youtubeId,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
    };
  }

  const spotifyId = /^https?:\/\//i.test(raw) ? getSpotifyTrackId(raw) : '';
  if (spotifyId) {
    return {
      title: cleanTitle || 'Canción de Spotify',
      artist: cleanArtist,
      sourceProvider: 'spotify',
      sourceUrl: raw,
      externalId: spotifyId
    };
  }

  const parts = raw.split(/\s+-\s+|\s+by\s+/i).map((part) => part.trim()).filter(Boolean);
  return {
    title: cleanTitle || parts[0] || raw || 'Canción solicitada',
    artist: cleanArtist || parts[1] || '',
    sourceProvider: /^https?:\/\//i.test(raw) ? 'url' : 'manual',
    sourceUrl: /^https?:\/\//i.test(raw) ? raw : undefined
  };
}

async function findOwnedEvent(eventId, ownerId) {
  const event = await Event.findOne({ _id: eventId, owner: ownerId });
  if (!event) {
    console.warn(`[SongRequestController] Evento no encontrado o sin permisos: eventId=${eventId}, userId=${ownerId}`);
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  return event;
}

exports.list = asyncHandler(async (req, res) => {
  console.log(`[SongRequestController:list] Obteniendo canciones para eventId=${req.params.eventId}`);
  await findOwnedEvent(req.params.eventId, req.user.id);
  const songRequests = await SongRequest.find({ event: req.params.eventId })
    .populate('guest', 'name group roles relationshipLabel visibilityGroup tableName')
    .sort({ sortOrder: 1, createdAt: -1 });
  console.log(`[SongRequestController:list] Encontradas ${songRequests.length} peticiones de canciones`);
  res.json({ songRequests });
});

exports.create = asyncHandler(async (req, res) => {
  console.log(`[SongRequestController:create] Recibiendo petición de canción para eventId=${req.params.eventId}`, req.body);
  const event = await findOwnedEvent(req.params.eventId, req.user.id);

  const songData = normalizeSongLookup(req.validated?.body || req.body);
  const status = req.body.status || 'approved';
  const requesterName = req.body.requesterName || req.user.name || 'Organizador';
  const requesterEmail = req.body.requesterEmail || req.user.email || '';
  const dedication = req.body.dedication || '';

  const maxOrderDoc = await SongRequest.findOne({ event: event._id }).sort({ sortOrder: -1 }).select('sortOrder');
  const sortOrder = (maxOrderDoc?.sortOrder || 0) + 1;

  const songRequest = new SongRequest({
    owner: event.owner,
    event: event._id,
    requesterName,
    requesterEmail,
    title: songData.title,
    artist: songData.artist,
    dedication,
    sourceProvider: songData.sourceProvider || 'manual',
    sourceUrl: songData.sourceUrl,
    externalId: songData.externalId,
    thumbnailUrl: songData.thumbnailUrl,
    sortOrder,
    status,
    reviewedAt: new Date()
  });

  const saved = await songRequest.save();
  console.log(`[SongRequestController:create] ¡Canción guardada con éxito! ID=${saved._id}, Titulo="${saved.title}", Estado=${saved.status}`);

  logEventActivity({
    eventId: event._id,
    actor: req.user,
    actorType: 'user',
    category: 'music',
    action: 'song_requested',
    description: `Canción solicitada: ${saved.title}${saved.artist ? ' - ' + saved.artist : ''}`,
    metadata: { songRequestId: saved._id, title: saved.title, artist: saved.artist, status: saved.status }
  });

  res.status(201).json({ songRequest: saved });
});

exports.update = asyncHandler(async (req, res) => {
  console.log(`[SongRequestController:update] Actualizando canción requestId=${req.params.songRequestId} en eventId=${req.params.eventId}`, req.body);
  const event = await findOwnedEvent(req.params.eventId, req.user.id);
  const update = {};
  if (req.validated.body.status) {
    update.status = req.validated.body.status;
    update.reviewedAt = new Date();
    if (req.validated.body.status === 'played') update.playedAt = new Date();
  }
  if (req.validated.body.sortOrder !== undefined) update.sortOrder = req.validated.body.sortOrder;
  const songRequest = await SongRequest.findOneAndUpdate(
    { _id: req.params.songRequestId, event: req.params.eventId },
    update,
    { new: true }
  ).populate('guest', 'name group roles relationshipLabel visibilityGroup tableName');
  if (!songRequest) {
    console.warn(`[SongRequestController:update] Solicitud no encontrada: requestId=${req.params.songRequestId}`);
    const error = new Error('Solicitud no encontrada');
    error.statusCode = 404;
    throw error;
  }
  console.log(`[SongRequestController:update] Canción actualizada ID=${songRequest._id}, Nuevo Estado=${songRequest.status}`);
  if (req.validated.body.status) {
    await notifyReviewStatus({
      guest: songRequest.guest,
      email: songRequest.requesterEmail,
      name: songRequest.requesterName,
      event,
      itemType: 'song',
      status: songRequest.status,
      itemTitle: [songRequest.title, songRequest.artist].filter(Boolean).join(' - '),
      settings: event.externalContent?.moderationSettings || {}
    });
  }

  logEventActivity({
    eventId: event._id,
    actor: req.user,
    actorType: 'user',
    category: 'music',
    action: songRequest.status === 'approved' ? 'song_approved' : songRequest.status === 'rejected' ? 'song_rejected' : songRequest.status === 'played' ? 'song_played' : 'song_updated',
    description: songRequest.status === 'approved' ? `Canción aprobada: ${songRequest.title}` : songRequest.status === 'rejected' ? `Canción denegada: ${songRequest.title}` : songRequest.status === 'played' ? `Canción reproducida: ${songRequest.title}` : `Petición de canción actualizada`,
    metadata: { songRequestId: songRequest._id, title: songRequest.title, artist: songRequest.artist, status: songRequest.status }
  });

  res.json({ songRequest });
});

async function searchYouTubeVideo(query) {
  if (!query) return null;
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    const html = await res.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData"\s*:\s*({.*?})\s*;/s);
    if (match) {
      const data = JSON.parse(match[1]);
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
      for (const item of contents) {
        if (item.videoRenderer?.videoId) {
          const vId = item.videoRenderer.videoId;
          const videoTitle = item.videoRenderer.title?.runs?.[0]?.text || query;
          const channelName = item.videoRenderer.ownerText?.runs?.[0]?.text || '';
          return {
            videoId: vId,
            sourceUrl: `https://www.youtube.com/watch?v=${vId}`,
            thumbnailUrl: `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
            title: videoTitle,
            artist: channelName
          };
        }
      }
    }
  } catch (err) {
    console.error('[YouTubeSearch] Error buscando vídeo:', err);
  }
  return null;
}

exports.lookupYouTube = asyncHandler(async (req, res) => {
  const query = (req.body?.query || req.query?.query || [req.body?.artist, req.body?.title].filter(Boolean).join(' ')).trim();
  const video = await searchYouTubeVideo(query);
  res.json({ video, query });
});
