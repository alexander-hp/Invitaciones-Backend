const HIGH_PRIORITY_LABELS = new Set([
  'anfitrion', 'host', 'novio', 'novia', 'padre', 'madre', 'padres',
  'vip', 'familia', 'family', 'padrino', 'madrina', 'dama_honor',
  'dama de honor', 'bridesmaid', 'groomsman', 'graduado', 'quinceanera'
]);

function normalizeLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, '_');
}

function highPriorityMatch(guest) {
  if (!guest) return '';
  const labels = [
    ...(guest.roles || []),
    ...(guest.tags || []),
    guest.group,
    guest.visibilityGroup,
    guest.relationshipLabel
  ].filter(Boolean);
  return labels.find((label) => {
    const normalized = normalizeLabel(label);
    return HIGH_PRIORITY_LABELS.has(normalized) || normalized.includes('vip') || normalized.includes('familia') || normalized.includes('mesa_principal');
  }) || '';
}

function deriveSongPriority({ guest, requesterName, priority, prioritySource } = {}) {
  if (prioritySource === 'manual' && ['high', 'normal'].includes(priority)) {
    return { priority, prioritySource: 'manual', priorityReason: 'Definida manualmente' };
  }
  if (['high', 'normal'].includes(priority) && (!guest || !Array.isArray(guest.roles))) {
    return { priority, prioritySource: 'auto', priorityReason: priority === 'high' ? 'Rol prioritario al solicitar' : 'Orden general' };
  }
  const matched = highPriorityMatch(guest);
  if (matched) {
    return { priority: 'high', prioritySource: 'auto', priorityReason: `Rol o grupo: ${matched}` };
  }
  if (!guest && /organizador|dj|cabina|staff/i.test(String(requesterName || ''))) {
    return { priority: 'high', prioritySource: 'auto', priorityReason: 'Agregada por el equipo del evento' };
  }
  return { priority: 'normal', prioritySource: 'auto', priorityReason: 'Orden general' };
}

function decorateSongRequest(songRequest) {
  const source = songRequest?.toObject ? songRequest.toObject({ virtuals: true }) : { ...songRequest };
  const derived = deriveSongPriority(source);
  return { ...source, ...derived };
}

function interleavePriority(items) {
  const high = items.filter((item) => item.priority === 'high');
  const normal = items.filter((item) => item.priority !== 'high');
  const ordered = [];
  while (high.length || normal.length) {
    for (let index = 0; index < 2 && high.length; index += 1) ordered.push(high.shift());
    if (normal.length) ordered.push(normal.shift());
    if (!high.length && normal.length) ordered.push(...normal.splice(0));
  }
  return ordered;
}

function orderSongRequests(songRequests = []) {
  const decorated = songRequests.map(decorateSongRequest);
  const approved = interleavePriority(decorated.filter((item) => item.status === 'approved'))
    .map((item, index) => ({ ...item, queuePosition: index + 1 }));
  const pending = interleavePriority(decorated.filter((item) => item.status === 'pending'));
  const played = decorated.filter((item) => item.status === 'played');
  const rejected = decorated.filter((item) => item.status === 'rejected');
  return [...approved, ...pending, ...played, ...rejected];
}

module.exports = {
  deriveSongPriority,
  decorateSongRequest,
  orderSongRequests
};
