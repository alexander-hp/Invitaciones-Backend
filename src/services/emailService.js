const nodemailer = require('nodemailer');
const env = require('../config/env');

function isEmailConfigured() {
  return Boolean((env.smtpHost || env.smtpService) && env.smtpUser && env.smtpPass && env.emailFrom);
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

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

async function sendMail({ to = env.emailTo, subject, text, html, replyTo }) {
  const transporter = createTransporter();
  if (!to) {
    const error = new Error('EMAIL_TO no configurado');
    error.statusCode = 501;
    throw error;
  }
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

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const safeName = name || 'Hola';
  const htmlName = escapeHtml(safeName);
  const htmlResetUrl = escapeHtml(resetUrl);
  const subject = 'Recupera tu password de Invitaciones';
  const text = [
    `${safeName}, recibimos una solicitud para recuperar tu password.`,
    '',
    'Abre este enlace para crear uno nuevo:',
    resetUrl,
    '',
    'Si no solicitaste este cambio, puedes ignorar este correo.'
  ].join('\n');
  const html = [
    `<p>${htmlName}, recibimos una solicitud para recuperar tu password.</p>`,
    `<p><a href="${htmlResetUrl}">Crear nuevo password</a></p>`,
    '<p>Si no solicitaste este cambio, puedes ignorar este correo.</p>'
  ].join('');

  return sendMail({ to, subject, text, html });
}

async function sendRsvpNotification({ to, invitation, rsvp }) {
  const title = invitation.content?.headline || invitation.slug || 'tu invitacion';
  const subject = `Nuevo RSVP para ${title}`;
  const text = [
    `Recibiste una nueva respuesta para ${title}.`,
    '',
    `Nombre: ${rsvp.name}`,
    `Correo: ${rsvp.email || 'Sin correo'}`,
    `Respuesta: ${rsvp.response}`,
    `Acompanantes: ${rsvp.companions || 0}`,
    rsvp.message ? `Mensaje: ${rsvp.message}` : ''
  ].filter(Boolean).join('\n');

  return sendMail({ to, subject, text });
}

async function sendInvitationPublishedEmail({ to, invitation, publicUrl }) {
  const title = invitation.content?.headline || invitation.slug || 'tu invitacion';
  const htmlTitle = escapeHtml(title);
  const htmlPublicUrl = escapeHtml(publicUrl);
  const subject = `Tu invitacion ya esta publicada: ${title}`;
  const text = [
    `Tu invitacion ${title} ya esta publicada.`,
    '',
    'Link publico:',
    publicUrl
  ].join('\n');
  const html = [
    `<p>Tu invitacion <strong>${htmlTitle}</strong> ya esta publicada.</p>`,
    `<p><a href="${htmlPublicUrl}">Ver invitacion publica</a></p>`
  ].join('');

  return sendMail({ to, subject, text, html });
}

async function sendRsvpReminderEmail({ to, name, invitation, deadline, publicUrl }) {
  const safeName = name || 'Invitado';
  const title = invitation.content?.headline || invitation.slug || 'tu invitacion';
  const htmlName = escapeHtml(safeName);
  const htmlTitle = escapeHtml(title);
  const htmlPublicUrl = escapeHtml(publicUrl);
  const deadlineText = deadline ? new Date(deadline).toLocaleString('es-MX') : 'la fecha limite';
  const subject = `Recordatorio RSVP - ${title}`;
  const text = [
    `${safeName}, te recordamos confirmar tu asistencia para ${title}.`,
    '',
    `Fecha limite: ${deadlineText}`,
    '',
    'Puedes responder aqui:',
    publicUrl
  ].join('\n');
  const html = [
    `<p>${htmlName}, te recordamos confirmar tu asistencia para <strong>${htmlTitle}</strong>.</p>`,
    `<p>Fecha limite: ${escapeHtml(deadlineText)}</p>`,
    `<p><a href="${htmlPublicUrl}">Responder invitacion</a></p>`
  ].join('');

  return sendMail({ to, subject, text, html });
}

module.exports = {
  isEmailConfigured,
  sendMail,
  sendContactMessage,
  sendPasswordResetEmail,
  sendRsvpNotification,
  sendInvitationPublishedEmail,
  sendRsvpReminderEmail
};
