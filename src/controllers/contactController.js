const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');

exports.sendContact = asyncHandler(async (req, res) => {
  const info = await emailService.sendContactMessage(req.validated.body);
  res.json({
    ok: true,
    message: 'Mensaje enviado',
    id: info.messageId,
    response: info.response
  });
});