const nodemailer = require('nodemailer');
const env = require('../config/env');

function isEmailConfigured() {
  return Boolean((env.smtpHost || env.smtpService) && env.emailFrom);
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

  const auth = (env.smtpUser || env.smtpPass)
    ? {
        auth: {
          user: env.smtpUser,
          pass: env.smtpPass
        }
      }
    : {};

  return nodemailer.createTransport({
    ...baseConfig,
    ...auth
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
  const htmlName = escapeHtml(safeName);
  const htmlEmail = escapeHtml(email || 'Sin correo');
  const htmlMessage = escapeHtml(message || '').replace(/\r?\n/g, '<br>');
  const subject = `Mensaje desde Invitaciones - ${safeName}`;

  const text = [
    `Nombre: ${safeName}`,
    `Correo: ${email}`,
    '',
    'Mensaje:',
    message
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mensaje de Contacto</title>
</head>
<body style="margin:0; padding:0; background-color:#f8f6f2; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#2d2926; -webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8f6f2; padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px; background-color:#ffffff; border-radius:16px; border:1px solid #e8dfd5; box-shadow:0 10px 25px rgba(0,0,0,0.04); overflow:hidden;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #1e1b18 0%, #2d2620 100%); padding:32px 36px; text-align:center; border-bottom:3px solid #c09c78;">
              <table align="center" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:linear-gradient(135deg, #c09c78, #a8825c); width:36px; height:36px; border-radius:10px; text-align:center; vertical-align:middle; color:#ffffff; font-weight:bold; font-size:18px;">
                    💬
                  </td>
                  <td style="padding-left:12px; font-family:'Georgia', serif; font-size:22px; font-weight:bold; color:#ffffff; letter-spacing:0.5px;">
                    Invitaciones.mx
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:36px 36px 32px;">
              
              <!-- Badge -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                <tr>
                  <td>
                    <span style="display:inline-block; padding:6px 14px; background-color:#f4ebe1; border:1px solid #e8dfd5; border-radius:20px; font-size:12px; font-weight:700; color:#a8825c; letter-spacing:0.5px; text-transform:uppercase;">
                      📩 NUEVO MENSAJE DE CONTACTO
                    </span>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 16px; font-size:22px; font-weight:700; color:#1e1b18; line-height:1.3;">
                Has recibido una nueva consulta
              </h1>
              
              <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#524c46;">
                Se ha enviado un nuevo mensaje desde el formulario de contacto del sitio web.
              </p>

              <!-- Remitente Info Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:24px; background-color:#fcfaf7; border:1px solid #efe4d8; border-radius:12px; padding:16px;">
                <tr>
                  <td style="padding:6px 0; font-size:14px; color:#524c46;">
                    <strong style="color:#1e1b18;">👤 Remitente:</strong> ${htmlName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0; font-size:14px; color:#524c46;">
                    <strong style="color:#1e1b18;">✉️ Correo:</strong> <a href="mailto:${htmlEmail}" style="color:#a8825c; text-decoration:none; font-weight:600;">${htmlEmail}</a>
                  </td>
                </tr>
              </table>

              <!-- Mensaje Card -->
              <div style="margin-bottom:28px;">
                <div style="margin-bottom:8px; font-size:13px; font-weight:700; color:#888077; text-transform:uppercase; letter-spacing:0.5px;">Mensaje recibido:</div>
                <div style="background-color:#ffffff; border-left:4px solid #c09c78; border-top:1px solid #f0e9e1; border-right:1px solid #f0e9e1; border-bottom:1px solid #f0e9e1; border-radius:0 12px 12px 0; padding:20px; font-size:15px; line-height:1.7; color:#2d2926; font-style:italic;">
                  "${htmlMessage}"
                </div>
              </div>

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="mailto:${htmlEmail}?subject=Re:%20Mensaje%20desde%20Invitaciones" target="_blank" style="display:inline-block; padding:14px 32px; background:linear-gradient(135deg, #c09c78 0%, #a8825c 100%); color:#ffffff; text-decoration:none; font-weight:700; font-size:15px; border-radius:10px; box-shadow:0 4px 12px rgba(192, 156, 120, 0.35);">
                      ↩️ Responder a ${htmlName}
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#faf7f2; padding:20px 36px; text-align:center; border-top:1px solid #e8dfd5; font-size:12px; color:#999085;">
              <p style="margin:0 0 6px;">Este correo fue generado automáticamente por el sistema de contacto de Invitaciones.mx.</p>
              <p style="margin:0; font-weight:600; color:#787067;">© Invitaciones.mx — Todos los derechos reservados.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendMail({
    subject,
    text,
    html,
    replyTo: email
  });
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const safeName = name || 'Hola';
  const htmlName = escapeHtml(safeName);
  const htmlResetUrl = escapeHtml(resetUrl);
  const subject = 'Recupera tu contraseña - Invitaciones.mx';
  const text = [
    `${safeName}, recibimos una solicitud para recuperar tu contraseña.`,
    '',
    'Abre este enlace para crear una nueva contraseña:',
    resetUrl,
    '',
    'Si no solicitaste este cambio, puedes ignorar este correo con seguridad.'
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer contraseña</title>
</head>
<body style="margin:0; padding:0; background-color:#f8f6f2; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#2d2926; -webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8f6f2; padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px; background-color:#ffffff; border-radius:16px; border:1px solid #e8dfd5; box-shadow:0 10px 25px rgba(0,0,0,0.04); overflow:hidden;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #1e1b18 0%, #2d2620 100%); padding:32px 36px; text-align:center; border-bottom:3px solid #c09c78;">
              <table align="center" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:linear-gradient(135deg, #c09c78, #a8825c); width:36px; height:36px; border-radius:10px; text-align:center; vertical-align:middle; color:#ffffff; font-weight:bold; font-size:18px;">
                    ✨
                  </td>
                  <td style="padding-left:12px; font-family:'Georgia', serif; font-size:22px; font-weight:bold; color:#ffffff; letter-spacing:0.5px;">
                    Invitaciones.mx
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:40px 36px 32px;">
              <h1 style="margin:0 0 16px; font-size:22px; font-weight:700; color:#1e1b18; line-height:1.3;">
                Recuperación de Contraseña
              </h1>
              
              <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#524c46;">
                Hola <strong>${htmlName}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta.
              </p>
              
              <p style="margin:0 0 28px; font-size:14.5px; line-height:1.6; color:#524c46;">
                Haz clic en el siguiente botón para crear una nueva contraseña de forma segura. Este enlace expira en 1 hora.
              </p>

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${htmlResetUrl}" target="_blank" style="display:inline-block; padding:14px 32px; background:linear-gradient(135deg, #c09c78 0%, #a8825c 100%); color:#ffffff; text-decoration:none; font-weight:700; font-size:15px; border-radius:10px; box-shadow:0 4px 12px rgba(192, 156, 120, 0.35);">
                      🔒 Restablecer mi contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0; font-size:13px; line-height:1.5; color:#888077; border-top:1px solid #f0e9e1; padding-top:20px;">
                Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
                <a href="${htmlResetUrl}" style="color:#a8825c; text-decoration:underline; word-break:break-all; font-size:12px;">${htmlResetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#faf7f2; padding:20px 36px; text-align:center; border-top:1px solid #e8dfd5; font-size:12px; color:#999085;">
              <p style="margin:0 0 6px;">Si no solicitaste este cambio, puedes ignorar este correo con total seguridad.</p>
              <p style="margin:0; font-weight:600; color:#787067;">© Invitaciones.mx — Todos los derechos reservados.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

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

function eventDateText(event) {
  return event?.date ? new Date(event.date).toLocaleDateString('es-MX', { dateStyle: 'full' }) : '';
}

function eventLocationText(event) {
  return [event?.venue?.name, event?.venue?.address].filter(Boolean).join(' - ');
}

function messageSubject(type, event) {
  const title = event?.title || 'Invitación';
  if (type === 'reminder') return `💌 Recordatorio RSVP - ${title}`;
  if (type === 'event_reminder') return `🎉 Recordatorio del evento - ${title}`;
  if (type === 'location_change') return `📍 Actualización de ubicación - ${title}`;
  if (type === 'thanks') return `❤️ Gracias por confirmar - ${title}`;
  return `✨ Estás invitado a ${title}`;
}

function buildGuestMessage({ guest, event, invitation, publicUrl, type = 'invitation' }) {
  const eventTitle = event?.title || invitation?.content?.headline || 'nuestro evento';
  const date = eventDateText(event);
  const location = eventLocationText(event);
  const greeting = `Hola ${guest.name},`;
  const rowsByType = {
    reminder: [
      `${greeting} te recordamos confirmar tu asistencia a ${eventTitle}.`,
      date ? `Fecha: ${date}` : '',
      publicUrl,
      'Tu confirmación nos ayuda a organizar mejor el evento.'
    ],
    event_reminder: [
      `${greeting} te compartimos un recordatorio para ${eventTitle}.`,
      date ? `Fecha: ${date}` : '',
      location ? `Lugar: ${location}` : '',
      publicUrl,
      'Te recomendamos revisar el enlace antes del evento.'
    ],
    location_change: [
      `${greeting} te compartimos una actualización de ubicación para ${eventTitle}.`,
      location ? `Lugar: ${location}` : '',
      publicUrl,
      'Revisa el enlace para ver los detalles actualizados.'
    ],
    thanks: [
      `${greeting} gracias por confirmar tu asistencia a ${eventTitle}.`,
      date ? `Nos vemos el ${date}.` : '',
      location ? `Lugar: ${location}` : '',
      'Nos encantará verte ahí.'
    ],
    invitation: [
      `${greeting} te compartimos tu invitación digital para ${eventTitle}.`,
      date ? `Fecha: ${date}` : '',
      location ? `Lugar: ${location}` : '',
      publicUrl,
      'Por favor confirma tu asistencia desde el enlace.'
    ]
  };
  return rowsByType[type] || rowsByType.invitation;
}

function buildGuestEmailHtml({ guest, event, invitation, publicUrl, type = 'invitation' }) {
  const eventTitle = escapeHtml(event?.title || invitation?.content?.headline || 'Nuestro Evento Especial');
  const guestName = escapeHtml(guest?.name || 'Invitado');
  const dateStr = escapeHtml(eventDateText(event));
  const locationStr = escapeHtml(eventLocationText(event));
  const htmlPublicUrl = escapeHtml(publicUrl);
  const tableStr = escapeHtml(guest?.tableName || '');

  let badgeText = '✨ INVITACIÓN DIGITAL';
  let ctaText = '✉️ Ver Mi Invitación Digital';
  let messageBody = `Te enviamos tu invitación digital para <strong>${eventTitle}</strong>. Nos dará muchísimo gusto contar con tu presencia en este día tan especial.`;

  if (type === 'reminder') {
    badgeText = '💌 RECORDATORIO RSVP';
    ctaText = '💌 Confirmar Asistencia';
    messageBody = `Te recordamos amablemente confirmar tu asistencia para <strong>${eventTitle}</strong>. Tu respuesta es muy importante para la organización del evento.`;
  } else if (type === 'event_reminder') {
    badgeText = '🎉 PRÓXIMO EVENTO';
    ctaText = '✨ Ver Detalles del Evento';
    messageBody = `¡Falta muy poco para <strong>${eventTitle}</strong>! Te compartimos la información para que estés listo(a).`;
  } else if (type === 'location_change') {
    badgeText = '📍 CAMBIO DE UBICACIÓN';
    ctaText = '🗺️ Ver Nueva Ubicación';
    messageBody = `Te informamos que hay una actualización importante en la ubicación para <strong>${eventTitle}</strong>. Revisa los detalles actualizados.`;
  } else if (type === 'thanks') {
    badgeText = '❤️ GRACIAS POR CONFIRMAR';
    ctaText = '💖 Ver Detalles del Evento';
    messageBody = `¡Muchas gracias por confirmar tu asistencia a <strong>${eventTitle}</strong>! Estamos muy emocionados de compartir este momento contigo.`;
  }

  const detailsHtml = (dateStr || locationStr || tableStr) ? `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:24px 0; background-color:#fcfaf7; border:1px solid #efe4d8; border-radius:12px; padding:16px;">
      ${dateStr ? `
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#524c46;">
            <strong style="color:#1e1b18;">📅 Fecha:</strong> ${dateStr}
          </td>
        </tr>
      ` : ''}
      ${locationStr ? `
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#524c46;">
            <strong style="color:#1e1b18;">📍 Lugar:</strong> ${locationStr}
          </td>
        </tr>
      ` : ''}
      ${tableStr ? `
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#524c46;">
            <strong style="color:#1e1b18;">🪑 Mesa:</strong> ${tableStr}
          </td>
        </tr>
      ` : ''}
    </table>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${eventTitle}</title>
</head>
<body style="margin:0; padding:0; background-color:#f8f6f2; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#2d2926; -webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8f6f2; padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px; background-color:#ffffff; border-radius:16px; border:1px solid #e8dfd5; box-shadow:0 10px 25px rgba(0,0,0,0.04); overflow:hidden;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #1e1b18 0%, #2d2620 100%); padding:32px 36px; text-align:center; border-bottom:3px solid #c09c78;">
              <table align="center" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:linear-gradient(135deg, #c09c78, #a8825c); width:36px; height:36px; border-radius:10px; text-align:center; vertical-align:middle; color:#ffffff; font-weight:bold; font-size:18px;">
                    ✨
                  </td>
                  <td style="padding-left:12px; font-family:'Georgia', serif; font-size:22px; font-weight:bold; color:#ffffff; letter-spacing:0.5px;">
                    Invitaciones.mx
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:36px 36px 32px;">
              
              <!-- Badge -->
              <div style="display:inline-block; padding:4px 12px; background-color:#f4ebe1; color:#a8825c; font-size:11px; font-weight:700; border-radius:20px; letter-spacing:0.8px; margin-bottom:16px;">
                ${badgeText}
              </div>

              <h1 style="margin:0 0 12px; font-size:24px; font-weight:700; color:#1e1b18; line-height:1.3; font-family:'Georgia', serif;">
                ${eventTitle}
              </h1>
              
              <p style="margin:0 0 16px; font-size:16px; line-height:1.5; color:#1e1b18; font-weight:600;">
                Hola ${guestName},
              </p>

              <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#524c46;">
                ${messageBody}
              </p>

              ${detailsHtml}

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:28px 0;">
                <tr>
                  <td align="center">
                    <a href="${htmlPublicUrl}" target="_blank" style="display:inline-block; padding:15px 36px; background:linear-gradient(135deg, #c09c78 0%, #a8825c 100%); color:#ffffff; text-decoration:none; font-weight:700; font-size:15.5px; border-radius:10px; box-shadow:0 4px 14px rgba(192, 156, 120, 0.4);">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0; font-size:13px; line-height:1.5; color:#888077; border-top:1px solid #f0e9e1; padding-top:20px;">
                Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
                <a href="${htmlPublicUrl}" style="color:#a8825c; text-decoration:underline; word-break:break-all; font-size:12px;">${htmlPublicUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#faf7f2; padding:20px 36px; text-align:center; border-top:1px solid #e8dfd5; font-size:12px; color:#999085;">
              <p style="margin:0 0 6px;">Este correo fue enviado desde la plataforma de invitaciones digitales.</p>
              <p style="margin:0; font-weight:600; color:#787067;">© Invitaciones.mx — Todos los derechos reservados.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

async function sendGuestInvitationEmail({ to, guest, event, invitation, publicUrl, type = 'invitation' }) {
  const subject = messageSubject(type, event);
  const rows = buildGuestMessage({ guest, event, invitation, publicUrl, type }).filter(Boolean);
  const text = rows.join('\n\n');
  const html = buildGuestEmailHtml({ guest, event, invitation, publicUrl, type });

  return sendMail({ to, subject, text, html });
}

async function sendGuestReviewStatusEmail({ to, name, event, itemType, status, itemTitle }) {
  const safeName = name || 'Invitado';
  const eventTitle = event?.title || 'nuestro evento';
  const htmlName = escapeHtml(safeName);
  const htmlEventTitle = escapeHtml(eventTitle);
  const htmlItemTitle = escapeHtml(itemTitle || '');

  const itemLabels = {
    album: 'foto',
    song: 'canción',
    dedication: 'dedicatoria'
  };

  const itemCaps = {
    album: 'Foto',
    song: 'Canción',
    dedication: 'Dedicatoria'
  };

  const itemEmojis = {
    album: '📸',
    song: '🎵',
    dedication: '✍️'
  };

  const statusLabels = {
    approved: 'aprobada',
    rejected: 'denegada',
    played: 'reproducida',
    hidden: 'oculta'
  };

  const itemLabel = itemLabels[itemType] || 'envío';
  const itemCap = itemCaps[itemType] || 'Envío';
  const itemEmoji = itemEmojis[itemType] || '✨';
  const statusLabel = statusLabels[status] || status;

  const subject = `Tu ${itemLabel} fue ${statusLabel} - ${eventTitle}`;

  let badgeText = `✨ ${itemCap.toUpperCase()} ${statusLabel.toUpperCase()}`;
  let badgeBg = '#f4ebe1';
  let badgeColor = '#a8825c';
  let badgeBorder = '#e8dfd5';
  let headerEmoji = itemEmoji;
  let heroTitle = `Tu ${itemLabel} fue ${statusLabel}`;

  let bodyMsg = `Te informamos que tu ${itemLabel} para <strong>${htmlEventTitle}</strong> fue ${statusLabel}.`;

  if (status === 'approved') {
    badgeText = `✅ ${itemCap.toUpperCase()} APROBADA`;
    badgeBg = '#e6f4ea';
    badgeColor = '#137333';
    badgeBorder = '#ceead6';
    headerEmoji = '✅';
    heroTitle = `¡Tu ${itemLabel} fue aprobada!`;
    if (itemType === 'song') {
      bodyMsg = `¡Excelentes noticias! La canción que sugeriste para <strong>${htmlEventTitle}</strong> ha sido aprobada por los organizadores y ya está en la lista de reproducción del evento.`;
    } else if (itemType === 'album') {
      bodyMsg = `¡Excelentes noticias! La foto que compartiste para <strong>${htmlEventTitle}</strong> ha sido aprobada y ya se encuentra disponible en el álbum del evento.`;
    } else if (itemType === 'dedication') {
      bodyMsg = `¡Excelentes noticias! Tu dedicatoria para <strong>${htmlEventTitle}</strong> ha sido aprobada y ya forma parte del muro de mensajes del evento.`;
    }
  } else if (status === 'rejected') {
    badgeText = `❌ ${itemCap.toUpperCase()} DENEGADA`;
    badgeBg = '#fce8e6';
    badgeColor = '#c5221f';
    badgeBorder = '#fad2cf';
    headerEmoji = '❌';
    heroTitle = `Tu ${itemLabel} fue denegada`;
    if (itemType === 'song') {
      bodyMsg = `Te informamos que la canción que sugeriste para <strong>${htmlEventTitle}</strong> no pudo ser aprobada por los organizadores.`;
    } else if (itemType === 'album') {
      bodyMsg = `Te informamos que la foto que compartiste para <strong>${htmlEventTitle}</strong> no fue aprobada por los organizadores.`;
    } else if (itemType === 'dedication') {
      bodyMsg = `Te informamos que la dedicatoria que escribiste para <strong>${htmlEventTitle}</strong> no fue aprobada.`;
    }
  } else if (status === 'played') {
    badgeText = `🎶 CANCIÓN REPRODUCIDA`;
    badgeBg = '#e8f0fe';
    badgeColor = '#1a73e8';
    badgeBorder = '#d2e3fc';
    headerEmoji = '🎶';
    heroTitle = `¡Tu canción ya sonó!`;
    bodyMsg = `¡Tu canción ya fue reproducida en la fiesta de <strong>${htmlEventTitle}</strong>! Esperamos que hayas disfrutado el momento.`;
  } else if (status === 'hidden') {
    badgeText = `👁️ ${itemCap.toUpperCase()} OCULTA`;
    badgeBg = '#f1f3f4';
    badgeColor = '#5f6368';
    badgeBorder = '#dadce0';
    headerEmoji = '👁️';
    heroTitle = `Tu ${itemLabel} está oculta`;
    bodyMsg = `Te informamos que el estado de tu ${itemLabel} para <strong>${htmlEventTitle}</strong> ha sido cambiado a oculto.`;
  }

  let itemDetailHtml = '';
  if (itemTitle) {
    if (itemType === 'album' && /^https?:\/\//i.test(itemTitle)) {
      itemDetailHtml = `
        <div style="margin-top:10px; text-align:center;">
          <img src="${htmlItemTitle}" alt="Foto" style="max-width:100%; max-height:220px; border-radius:10px; object-fit:cover; border:1px solid #e8dfd5; box-shadow:0 4px 12px rgba(0,0,0,0.08);" />
        </div>
      `;
    } else if (itemType === 'dedication') {
      itemDetailHtml = `
        <div style="margin-top:8px; background-color:#ffffff; border-left:4px solid #c09c78; border-radius:4px; padding:12px 16px; font-style:italic; color:#4a443f; font-size:14px; line-height:1.5;">
          “${htmlItemTitle}”
        </div>
      `;
    } else {
      itemDetailHtml = `
        <div style="margin-top:8px; background-color:#ffffff; border:1px dashed #d5c8b8; border-radius:8px; padding:10px 14px; color:#1e1b18; font-weight:600; font-size:14.5px;">
          ${itemEmoji} ${htmlItemTitle}
        </div>
      `;
    }
  }

  const text = [
    `Hola ${safeName},`,
    heroTitle,
    bodyMsg.replace(/<\/?strong>/g, ''),
    itemTitle ? `Detalle: ${itemTitle}` : ''
  ].filter(Boolean).join('\n\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heroTitle}</title>
</head>
<body style="margin:0; padding:0; background-color:#f8f6f2; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#2d2926; -webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8f6f2; padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px; background-color:#ffffff; border-radius:16px; border:1px solid #e8dfd5; box-shadow:0 10px 25px rgba(0,0,0,0.04); overflow:hidden;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #1e1b18 0%, #2d2620 100%); padding:32px 36px; text-align:center; border-bottom:3px solid #c09c78;">
              <table align="center" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:linear-gradient(135deg, #c09c78, #a8825c); width:36px; height:36px; border-radius:10px; text-align:center; vertical-align:middle; color:#ffffff; font-weight:bold; font-size:18px;">
                    ${headerEmoji}
                  </td>
                  <td style="padding-left:12px; font-family:'Georgia', serif; font-size:22px; font-weight:bold; color:#ffffff; letter-spacing:0.5px;">
                    Invitaciones.mx
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:36px 36px 32px;">
              
              <!-- Status Badge -->
              <div style="display:inline-block; padding:5px 14px; background-color:${badgeBg}; color:${badgeColor}; border:1px solid ${badgeBorder}; font-size:11.5px; font-weight:700; border-radius:20px; letter-spacing:0.8px; margin-bottom:16px;">
                ${badgeText}
              </div>

              <h1 style="margin:0 0 12px; font-size:24px; font-weight:700; color:#1e1b18; line-height:1.3; font-family:'Georgia', serif;">
                ${heroTitle}
              </h1>
              
              <p style="margin:0 0 16px; font-size:16px; line-height:1.5; color:#1e1b18; font-weight:600;">
                Hola ${htmlName},
              </p>

              <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#524c46;">
                ${bodyMsg}
              </p>

              <!-- Details Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:24px 0; background-color:#fcfaf7; border:1px solid #efe4d8; border-radius:12px; padding:16px;">
                <tr>
                  <td style="padding:6px 0; font-size:14px; color:#524c46;">
                    <strong style="color:#1e1b18;">🎉 Evento:</strong> ${htmlEventTitle}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0; font-size:14px; color:#524c46;">
                    <strong style="color:#1e1b18;">${itemEmoji} ${itemCap}:</strong>
                    ${itemDetailHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0; font-size:14px; color:#524c46;">
                    <strong style="color:#1e1b18;">📌 Estado:</strong> ${escapeHtml(statusLabel)}
                  </td>
                </tr>
              </table>

              <p style="margin:0; font-size:13px; line-height:1.5; color:#888077; border-top:1px solid #f0e9e1; padding-top:20px;">
                Gracias por formar parte de este evento especial.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#faf7f2; padding:20px 36px; text-align:center; border-top:1px solid #e8dfd5; font-size:12px; color:#999085;">
              <p style="margin:0 0 6px;">Este correo fue enviado desde la plataforma de invitaciones digitales.</p>
              <p style="margin:0; font-weight:600; color:#787067;">© Invitaciones.mx — Todos los derechos reservados.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendMail({ to, subject, text, html });
}

async function sendEventMemberInviteEmail({ to, name, event, inviter, role, permissions = [], inviteUrl, hasAccount }) {
  const safeName = name || to;
  const eventTitle = event?.title || 'Evento';
  const inviterName = inviter?.name || inviter?.email || 'El organizador';
  const subject = `${inviterName} te invito a colaborar en ${eventTitle}`;
  const roleLabel = {
    organizer: 'Organizador',
    client: 'Cliente',
    venue_owner: 'Dueno de salon / venue',
    vendor: 'Proveedor',
    staff: 'Staff / recepcion',
    dj: 'DJ',
    photographer: 'Fotografo'
  }[role] || role;
  const actionText = hasAccount ? 'Inicia sesion y acepta el acceso' : 'Crea tu cuenta y acepta el acceso';
  const text = [
    `Hola ${safeName},`,
    '',
    `${inviterName} te invito a colaborar en el evento "${eventTitle}" dentro de KyndraSoft Invitaciones.`,
    `Rol asignado: ${roleLabel}`,
    permissions.length ? `Permisos: ${permissions.join(', ')}` : '',
    '',
    `${actionText}:`,
    inviteUrl,
    '',
    'Este enlace es personal y expira en 14 dias. No compartas este acceso con otras personas.'
  ].filter(Boolean).join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitacion de equipo</title>
</head>
<body style="margin:0; padding:0; background-color:#f8f6f2; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#2d2926;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8f6f2; padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px; background-color:#ffffff; border-radius:16px; border:1px solid #e8dfd5; overflow:hidden;">
          <tr>
            <td style="background:#2d2620; padding:28px 34px; text-align:center; color:#ffffff;">
              <div style="font-family:Georgia, serif; font-size:24px; font-weight:bold;">KyndraSoft Invitaciones</div>
              <div style="margin-top:8px; color:#dec9b1; font-size:14px;">Acceso de equipo interno</div>
            </td>
          </tr>
          <tr>
            <td style="padding:34px;">
              <h1 style="margin:0 0 12px; font-size:24px; color:#2d2926;">Te invitaron a colaborar</h1>
              <p style="margin:0 0 18px; line-height:1.6;">Hola <strong>${escapeHtml(safeName)}</strong>, ${escapeHtml(inviterName)} te agrego al evento <strong>${escapeHtml(eventTitle)}</strong>.</p>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f8f6f2; border:1px solid #e8dfd5; border-radius:12px; margin:18px 0;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 8px;"><strong>Rol:</strong> ${escapeHtml(roleLabel)}</p>
                    <p style="margin:0;"><strong>Permisos:</strong> ${escapeHtml(permissions.length ? permissions.join(', ') : 'Acceso basico al evento')}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 22px; line-height:1.6;">${escapeHtml(actionText)}. No enviamos contrasenas por correo; cada persona crea o usa su propia cuenta.</p>
              <p style="margin:0 0 24px;">
                <a href="${escapeHtml(inviteUrl)}" style="display:inline-block; background:#c09c78; color:#ffffff; text-decoration:none; padding:13px 22px; border-radius:10px; font-weight:700;">Aceptar invitacion</a>
              </p>
              <p style="margin:0; color:#787067; font-size:13px; line-height:1.5;">El enlace expira en 14 dias y es personal. Si no esperabas este acceso, puedes ignorar este correo.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendMail({ to, subject, text, html });
}

module.exports = {
  isEmailConfigured,
  sendMail,
  sendContactMessage,
  sendPasswordResetEmail,
  sendRsvpNotification,
  sendInvitationPublishedEmail,
  sendRsvpReminderEmail,
  sendGuestInvitationEmail,
  sendGuestReviewStatusEmail,
  sendEventMemberInviteEmail
};
