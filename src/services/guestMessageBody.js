function replaceGuestPlaceholders(text, guest = {}) {
  if (!text) return '';
  return text
    .replace(/\{\{\s*(?:nip|pin)\s*\}\}/gi, guest.accessPin || '')
    .replace(/\{\{\s*(?:nombre|name)\s*\}\}/gi, guest.name || '')
    .replace(/\{\{\s*(?:mesa|table)\s*\}\}/gi, guest.tableName || '')
    .replace(/\{\{\s*(?:asiento|seat)\s*\}\}/gi, guest.seatLabel || '')
    .replace(/\{\{\s*(?:pases|companions)\s*\}\}/gi, String((guest.allowedCompanions || 0) + 1));
}

function customMessageRows({ guest, messageBody, links = [] }) {
  if (!messageBody?.trim()) return null;
  const resolvedBody = replaceGuestPlaceholders(messageBody.trim(), guest);
  return [
    `Hola ${guest?.name || 'Invitado'},`,
    resolvedBody,
    ...links.filter(Boolean)
  ];
}

module.exports = { customMessageRows, replaceGuestPlaceholders };
