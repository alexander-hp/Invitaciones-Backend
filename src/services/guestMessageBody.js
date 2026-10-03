function customMessageRows({ guest, messageBody, links = [] }) {
  if (!messageBody?.trim()) return null;
  return [
    `Hola ${guest.name},`,
    messageBody.trim(),
    ...links.filter(Boolean)
  ];
}

module.exports = { customMessageRows };
