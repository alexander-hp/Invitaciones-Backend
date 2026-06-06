const env = require('../src/config/env');
const emailService = require('../src/services/emailService');

async function main() {
  const to = process.env.SMTP_TEST_TO || env.emailTo || env.smtpUser;
  if (!to) {
    throw new Error('Configura SMTP_TEST_TO, EMAIL_TO o SMTP_USER para enviar el correo de prueba.');
  }

  const info = await emailService.sendMail({
    to,
    subject: 'Prueba SMTP - Invitaciones',
    text: [
      'Este es un correo de prueba enviado desde la configuracion SMTP actual.',
      '',
      `FRONTEND_URL: ${env.frontendUrl}`,
      `SMTP_SERVICE: ${env.smtpService || 'custom-host'}`,
      `SMTP_HOST: ${env.smtpHost || 'service-default'}`
    ].join('\n')
  });

  console.log('SMTP OK:', {
    to,
    messageId: info.messageId,
    response: info.response
  });
}

main().catch((error) => {
  console.error('SMTP ERROR:', {
    code: error.code,
    command: error.command,
    responseCode: error.responseCode,
    message: error.message
  });
  process.exit(1);
});
