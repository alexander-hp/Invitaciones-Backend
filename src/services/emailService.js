const nodemailer = require('nodemailer');
const env = require('../config/env');

function isEmailConfigured() {
  return Boolean((env.smtpHost || env.smtpService) && env.smtpUser && env.smtpPass && env.emailFrom && env.emailTo);
}

function createTransporter() {
  if (!isEmailConfigured()) {
    const error = new Error('SMTP no configurado');
    error.statusCode = 501;
    throw error;
  }

  const baseConfig = env.smtpService
    ? { service: env.smtpService }
    : { host: env.smtpHost, port: env.smtpPort, secure: env.smtpSecure };

  return nodemailer.createTransport({
    ...baseConfig,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  });
}

async function sendMail({ to = env.emailTo, subject, text, html, replyTo }) {
  const transporter = createTransporter();
  return transporter.sendMail({
    from: env.emailFrom,
    to,
    subject,
    text,
    html,
    replyTo
  });
}

async function sendContactMessage({ name, email, message }) {
  const safeName = name || 'Visitante';
  const subject = `Mensaje desde Invitaciones - ${safeName}`;
  const text = [
    `Nombre: ${safeName}`,
    `Correo: ${email}`,
    '',
    'Mensaje:',
    message
  ].join('\n');

  return sendMail({
    subject,
    text,
    replyTo: email
  });
}

module.exports = {
  isEmailConfigured,
  sendMail,
  sendContactMessage
};