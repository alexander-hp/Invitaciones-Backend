/**
 * Mock Server for WhatsApp OpenWA
 * 
 * Runs a mock OpenWA API server on the port defined by OPENWA_BASE_URL.
 * Provides a stunning developer dashboard to inspect outgoing messages
 * and simulate webhook callbacks.
 */

const path = require('path');
const express = require('express');
const cors = require('cors');

// Load environment variables from the parent directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Resolve Ports
const backendPort = process.env.PORT || 4000;
const backendWebhookUrl = `http://localhost:${backendPort}/api/webhooks/whatsapp/openwa`;

const openwaBaseUrl = process.env.OPENWA_BASE_URL || 'http://localhost:2785';
let mockPort = 2785;
try {
  const urlObj = new URL(openwaBaseUrl);
  if (urlObj.port) {
    mockPort = parseInt(urlObj.port, 10);
  }
} catch (e) {
  // Fall back to default
}

// In-Memory State
let sessionState = {
  status: 'ready',
  phone: '5213312345678',
  pushName: 'Mock Administrator'
};

let messages = [];
let autoWebhookEnabled = true;
let clients = []; // SSE Client connections for real-time dashboard updates

// SSE Helper to push updates to the dashboard
function broadcast(type, data) {
  clients.forEach(client => {
    client.write(`event: ${type}\n`);
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// Helper to simulate webhook status back to backend
async function triggerWebhook(messageId, status) {
  console.log(`[Mock WhatsApp] Triggering webhook: messageId=${messageId}, status=${status}`);
  try {
    const payload = {
      messageId: messageId,
      status: status,
      event: status,
      timestamp: Date.now()
    };

    const response = await fetch(backendWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[Mock WhatsApp] Webhook returned status ${response.status}`);
    }
  } catch (error) {
    console.error('[Mock WhatsApp] Failed to send webhook to backend:', error.message);
  }
}

// OpenWA Session Status Endpoint
app.get('/api/sessions/:sessionId', (req, res) => {
  console.log(`[Mock WhatsApp] GET Session Status for: ${req.params.sessionId}`);
  res.json(sessionState);
});

// Check Contact Endpoint
app.get('/api/sessions/:sessionId/contacts/check/:phone', (req, res) => {
  const phone = req.params.phone;
  console.log(`[Mock WhatsApp] Checking contact availability: ${phone}`);

  // Simulated behavior: assume numbers starting with '000' do not exist
  if (phone.startsWith('000') || phone.includes('999999')) {
    return res.status(404).json({
      exists: false,
      message: 'Contact does not exist'
    });
  }

  res.json({
    exists: true,
    whatsappId: `${phone}@c.us`
  });
});

// Send Text Endpoint
app.post('/api/sessions/:sessionId/messages/send-text', (req, res) => {
  const { chatId, text } = req.body;
  console.log(`[Mock WhatsApp] Send Text to ${chatId}: ${text.slice(0, 60)}...`);

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const phone = chatId.replace('@c.us', '');

  const newMessage = {
    id: messageId,
    chatId,
    phone,
    text,
    type: 'text',
    status: 'sent',
    timestamp: new Date().toISOString()
  };

  messages.unshift(newMessage);
  broadcast('message', newMessage);

  res.json({
    id: messageId,
    chatId,
    status: 'sent'
  });

  if (autoWebhookEnabled) {
    setTimeout(async () => {
      newMessage.status = 'delivered';
      broadcast('status', { id: messageId, status: 'delivered' });
      await triggerWebhook(messageId, 'delivered');

      setTimeout(async () => {
        newMessage.status = 'read';
        broadcast('status', { id: messageId, status: 'read' });
        await triggerWebhook(messageId, 'read');
      }, 1000);
    }, 1000);
  }
});

// Send Media Endpoints (Image, Video, Audio, Document)
const handleMediaSend = (req, res, mediaType) => {
  const { chatId, url, base64, mimetype, filename, caption } = req.body;
  console.log(`[Mock WhatsApp] Send Media (${mediaType}) to ${chatId}: filename=${filename || 'unnamed'}`);

  const messageId = `msg_media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const phone = chatId.replace('@c.us', '');

  const newMessage = {
    id: messageId,
    chatId,
    phone,
    text: caption || `[Media: ${mediaType}]`,
    type: mediaType,
    mediaUrl: url || (base64 ? `data:${mimetype};base64,${base64}` : null),
    mimetype,
    filename,
    status: 'sent',
    timestamp: new Date().toISOString()
  };

  messages.unshift(newMessage);
  broadcast('message', newMessage);

  res.json({
    id: messageId,
    chatId,
    status: 'sent'
  });

  if (autoWebhookEnabled) {
    setTimeout(async () => {
      newMessage.status = 'delivered';
      broadcast('status', { id: messageId, status: 'delivered' });
      await triggerWebhook(messageId, 'delivered');

      setTimeout(async () => {
        newMessage.status = 'read';
        broadcast('status', { id: messageId, status: 'read' });
        await triggerWebhook(messageId, 'read');
      }, 1000);
    }, 1000);
  }
};

app.post('/api/sessions/:sessionId/messages/send-image', (req, res) => handleMediaSend(req, res, 'image'));
app.post('/api/sessions/:sessionId/messages/send-video', (req, res) => handleMediaSend(req, res, 'video'));
app.post('/api/sessions/:sessionId/messages/send-audio', (req, res) => handleMediaSend(req, res, 'audio'));
app.post('/api/sessions/:sessionId/messages/send-document', (req, res) => handleMediaSend(req, res, 'document'));

// SSE Endpoint for real-time dashboard updates
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

// Control API to change Mock Server state from the UI
app.post('/api/control/session', (req, res) => {
  const { status, phone, pushName } = req.body;
  if (status) sessionState.status = status;
  if (phone) sessionState.phone = phone;
  if (pushName) sessionState.pushName = pushName;

  console.log('[Mock WhatsApp] Session config updated:', sessionState);
  broadcast('session', sessionState);
  res.json({ success: true, session: sessionState });
});

// Control API to clear messages
app.post('/api/control/clear', (req, res) => {
  messages = [];
  broadcast('clear', {});
  res.json({ success: true });
});

// Control API to toggle Auto Webhook
app.post('/api/control/webhook-toggle', (req, res) => {
  autoWebhookEnabled = req.body.enabled;
  console.log('[Mock WhatsApp] Auto Webhook set to:', autoWebhookEnabled);
  res.json({ success: true, autoWebhookEnabled });
});

// Control API to trigger a manual webhook status for a message
app.post('/api/control/trigger-webhook', async (req, res) => {
  const { messageId, status } = req.body;
  const msg = messages.find(m => m.id === messageId);
  if (msg) {
    msg.status = status;
    broadcast('status', { id: messageId, status });
  }
  await triggerWebhook(messageId, status);
  res.json({ success: true });
});

// Dashboard UI
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp OpenWA Mock Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0f172a;
      --bg-card: rgba(30, 41, 59, 0.7);
      --bg-input: #1e293b;
      --primary: #10b981;
      --primary-hover: #059669;
      --primary-glow: rgba(16, 185, 129, 0.15);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --border-color: rgba(255, 255, 255, 0.08);
      --danger: #ef4444;
      --warning: #f59e0b;
      --info: #3b82f6;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg-dark);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    /* Background decorative blobs */
    .bg-blob {
      position: absolute;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%);
      top: -100px;
      right: -100px;
      z-index: -1;
      pointer-events: none;
    }

    .bg-blob-2 {
      position: absolute;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, transparent 70%);
      bottom: -150px;
      left: -150px;
      z-index: -1;
      pointer-events: none;
    }

    header {
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      padding: 1.25rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo-icon {
      width: 2.25rem;
      height: 2.25rem;
      background-color: var(--primary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 15px var(--primary-glow);
    }

    .logo-icon svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: #fff;
    }

    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .header-info {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .container {
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
      padding: 2rem;
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 2rem;
      flex: 1;
    }

    @media (max-width: 900px) {
      .container {
        grid-template-columns: 1fr;
      }
    }

    .panel {
      background: var(--bg-card);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 1.5rem;
      height: fit-content;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }

    .panel-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.75rem;
    }

    .form-group {
      margin-bottom: 1.25rem;
    }

    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    input, select {
      width: 100%;
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.75rem;
      color: var(--text-main);
      font-family: inherit;
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }

    input:focus, select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 2px var(--primary-glow);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .status-ready {
      background: rgba(16, 185, 129, 0.1);
      color: var(--primary);
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .status-loading {
      background: rgba(245, 158, 11, 0.1);
      color: var(--warning);
      border: 1px solid rgba(245, 158, 11, 0.2);
    }

    .status-disconnected {
      background: rgba(239, 68, 68, 0.1);
      color: var(--danger);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      width: 100%;
      font-family: inherit;
    }

    .btn-primary {
      background: var(--primary);
      color: #fff;
    }

    .btn-primary:hover {
      background: var(--primary-hover);
      box-shadow: 0 0 15px var(--primary-glow);
    }

    .btn-outline {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-main);
    }

    .btn-outline:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: var(--text-muted);
    }

    .toggle-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
    }

    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--bg-input);
      transition: .3s;
      border-radius: 24px;
      border: 1px solid var(--border-color);
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background-color: var(--text-muted);
      transition: .3s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: var(--primary);
    }

    input:checked + .slider:before {
      transform: translateX(20px);
      background-color: #fff;
    }

    /* Messages Section */
    .messages-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .message-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      position: relative;
      transition: border-color 0.3s ease, transform 0.2s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .message-card:hover {
      border-color: rgba(16, 185, 129, 0.3);
      transform: translateY(-2px);
    }

    .message-card.status-read-border {
      border-left: 4px solid var(--primary);
    }
    .message-card.status-delivered-border {
      border-left: 4px solid var(--info);
    }
    .message-card.status-sent-border {
      border-left: 4px solid var(--text-muted);
    }
    .message-card.status-failed-border {
      border-left: 4px solid var(--danger);
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
    }

    .recipient {
      font-weight: 600;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .timestamp {
      color: var(--text-muted);
    }

    .message-body {
      background: rgba(15, 23, 42, 0.4);
      border-radius: 8px;
      padding: 0.85rem;
      font-size: 0.95rem;
      line-height: 1.5;
      white-space: pre-wrap;
      border: 1px solid rgba(255, 255, 255, 0.03);
    }

    .media-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      background: rgba(59, 130, 246, 0.08);
      color: #93c5fd;
      padding: 0.5rem;
      border-radius: 6px;
      margin-bottom: 0.5rem;
    }

    .media-info svg {
      width: 1rem;
      height: 1rem;
      fill: currentColor;
    }

    .media-preview-img {
      max-width: 200px;
      max-height: 150px;
      border-radius: 6px;
      margin-top: 0.5rem;
      border: 1px solid var(--border-color);
    }

    .message-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-top: 0.25rem;
      border-top: 1px solid var(--border-color);
      padding-top: 0.75rem;
    }

    .action-btn {
      padding: 0.35rem 0.65rem;
      font-size: 0.75rem;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-muted);
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .action-btn:hover {
      color: var(--text-main);
      background: rgba(255, 255, 255, 0.05);
    }

    .action-btn.active-delivered:hover, .action-btn.active-delivered {
      color: #93c5fd;
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.3);
    }

    .action-btn.active-read:hover, .action-btn.active-read {
      color: #34d399;
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.3);
    }

    .action-btn.active-failed:hover, .action-btn.active-failed {
      color: #f87171;
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: var(--text-muted);
      font-weight: 300;
    }

    .empty-state svg {
      width: 3.5rem;
      height: 3.5rem;
      margin-bottom: 1rem;
      fill: var(--text-muted);
      opacity: 0.3;
    }

    .badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-text { background: rgba(255,255,255,0.06); color: var(--text-muted); }
    .badge-image { background: rgba(16, 185, 129, 0.15); color: var(--primary); }
    .badge-document { background: rgba(59, 130, 246, 0.15); color: var(--info); }
    .badge-video { background: rgba(245, 158, 11, 0.15); color: var(--warning); }
    .badge-audio { background: rgba(139, 92, 246, 0.15); color: #c084fc; }

  </style>
</head>
<body>
  <div class="bg-blob"></div>
  <div class="bg-blob-2"></div>

  <header>
    <div class="logo-container">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.47 5.47.003 12.003.003c3.166.001 6.141 1.233 8.377 3.473 2.235 2.24 3.461 5.218 3.459 8.385-.004 6.533-5.471 12-12.003 12-2.013-.002-3.993-.513-5.749-1.488L0 24zm6.59-4.82c1.652.981 3.268 1.498 4.887 1.499 5.25.003 9.544-4.29 9.547-9.542.002-2.544-.988-4.937-2.79-6.74C16.438 2.595 14.049 1.604 11.5 1.604c-5.25 0-9.544 4.291-9.547 9.544-.001 1.74.475 3.428 1.378 4.908l-.996 3.639 3.722-.975zm12.39-7.234c-.266-.134-1.579-.78-1.823-.867-.243-.088-.421-.132-.599.133-.178.266-.689.867-.844 1.046-.156.177-.311.2-.577.067-.266-.134-1.12-.413-2.133-1.317-.788-.703-1.32-1.572-1.475-1.839-.156-.266-.017-.41.117-.543.12-.12.266-.31.4-.466.133-.155.178-.266.266-.443.089-.178.045-.333-.022-.466-.067-.134-.599-1.442-.821-1.975-.217-.521-.454-.45-.626-.459-.162-.008-.348-.01-.533-.01-.186 0-.488.07-.743.348-.256.278-.977.955-.977 2.33 0 1.376 1.002 2.705 1.142 2.893.14.188 1.972 3.01 4.775 4.221.666.288 1.187.46 1.593.589.67.213 1.28.183 1.761.11.536-.08 1.579-.646 1.801-1.24.222-.593.222-1.101.155-1.21-.067-.108-.244-.176-.51-.31z"/>
        </svg>
      </div>
      <div>
        <h1>OpenWA Mock Dashboard</h1>
        <div class="header-info">Modo Desarrollo - Backend Invitaciones</div>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap: 1rem;">
      <span style="font-size:0.875rem; color:var(--text-muted)">Webhook URL: <code style="color:var(--text-main)">/api/webhooks/whatsapp/openwa</code></span>
      <button class="btn btn-outline" style="width:auto; padding: 0.5rem 1rem; font-size: 0.8rem;" onclick="clearMessages()">Limpiar Historial</button>
    </div>
  </header>

  <div class="container">
    <!-- Sidebar: Control Panel -->
    <aside class="panel">
      <div class="panel-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        Configuración del Mock
      </div>

      <div class="form-group">
        <label>Estado de Sesión OpenWA</label>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 0.75rem;">
          <span id="session-badge" class="status-badge status-ready">Listo</span>
          <select id="session-status" style="width: auto; padding: 0.25rem 0.5rem;" onchange="updateSession()">
            <option value="ready">Ready (Listo)</option>
            <option value="loading">Loading (Iniciando)</option>
            <option value="not_configured">Disconnected</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Nombre del Administrador</label>
        <input type="text" id="admin-name" value="Mock Administrator" onchange="updateSession()">
      </div>

      <div class="form-group">
        <label>Número de Teléfono Sesión</label>
        <input type="text" id="admin-phone" value="5213312345678" onchange="updateSession()">
      </div>

      <div class="toggle-container" style="border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
        <div>
          <label style="margin-bottom: 0.25rem;">Auto Webhook</label>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Simula entregado y leído en DB automáticamente.</span>
        </div>
        <label class="switch">
          <input type="checkbox" id="auto-webhook" checked onchange="toggleAutoWebhook(this.checked)">
          <span class="slider"></span>
        </label>
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: 1.25rem; font-size: 0.8rem; color: var(--text-muted);">
        <p style="margin-bottom: 0.5rem; font-weight: 500;">Guía rápida:</p>
        <ul style="list-style-position: inside; display: flex; flex-direction: column; gap: 0.25rem;">
          <li>Asegúrate que el Backend esté corriendo en <code style="color:var(--text-main)">:${backendPort}</code></li>
          <li>Los mensajes enviados desde el Backend aparecerán aquí en tiempo real.</li>
          <li>Usa los botones en las tarjetas para simular eventos de entrega (webhooks).</li>
        </ul>
      </div>
    </aside>

    <!-- Main Content: Message Log -->
    <main>
      <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 1.1rem; font-weight: 600;">Historial de Mensajes Recibidos</h2>
        <span id="counter" class="status-badge" style="background: rgba(255,255,255,0.04); color: var(--text-muted);">0 mensajes</span>
      </div>

      <div id="messages-list" class="messages-container">
        <!-- Empty State -->
        <div class="panel empty-state" id="empty-state">
          <svg viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
          </svg>
          <p style="font-size: 1rem; font-weight: 500; margin-bottom: 0.25rem; color: var(--text-main);">Sin mensajes aún</p>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Los mensajes enviados por la API Express del backend se mostrarán aquí.</p>
        </div>
      </div>
    </main>
  </div>

  <script>
    let messages = [];

    // Connect to Server-Sent Events for real-time updates
    const eventSource = new EventSource('/api/events');
    
    eventSource.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      messages.unshift(message);
      renderMessages();
    });

    eventSource.addEventListener('status', (event) => {
      const data = JSON.parse(event.data);
      const msg = messages.find(m => m.id === data.id);
      if (msg) {
        msg.status = data.status;
        renderMessages();
      }
    });

    eventSource.addEventListener('session', (event) => {
      const session = JSON.parse(event.data);
      document.getElementById('session-status').value = session.status;
      document.getElementById('admin-name').value = session.pushName;
      document.getElementById('admin-phone').value = session.phone;
      updateBadge(session.status);
    });

    eventSource.addEventListener('clear', () => {
      messages = [];
      renderMessages();
    });

    function updateBadge(status) {
      const badge = document.getElementById('session-badge');
      badge.className = 'status-badge';
      if (status === 'ready') {
        badge.classList.add('status-ready');
        badge.innerText = 'Listo';
      } else if (status === 'loading') {
        badge.classList.add('status-loading');
        badge.innerText = 'Cargando';
      } else {
        badge.classList.add('status-disconnected');
        badge.innerText = 'Desconectado';
      }
    }

    async function updateSession() {
      const status = document.getElementById('session-status').value;
      const pushName = document.getElementById('admin-name').value;
      const phone = document.getElementById('admin-phone').value;
      
      await fetch('/api/control/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, pushName, phone })
      });
      updateBadge(status);
    }

    async function toggleAutoWebhook(enabled) {
      await fetch('/api/control/webhook-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
    }

    async function sendWebhook(messageId, status) {
      await fetch('/api/control/trigger-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, status })
      });
    }

    async function clearMessages() {
      await fetch('/api/control/clear', { method: 'POST' });
    }

    function renderMessages() {
      const container = document.getElementById('messages-list');
      const counter = document.getElementById('counter');
      
      if (messages.length === 0) {
        container.innerHTML = \`
          <div class="panel empty-state" id="empty-state">
            <svg viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
            </svg>
            <p style="font-size: 1rem; font-weight: 500; margin-bottom: 0.25rem; color: var(--text-main);">Sin mensajes aún</p>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Los mensajes enviados por la API Express del backend se mostrarán aquí.</p>
          </div>
        \`;
        counter.innerText = '0 mensajes';
        return;
      }

      counter.innerText = \`\${messages.length} mensaje\${messages.length > 1 ? 's' : ''}\`;
      container.innerHTML = '';

      messages.forEach(msg => {
        const card = document.createElement('div');
        card.className = \`message-card status-\${msg.status}-border\`;
        
        const dateStr = new Date(msg.timestamp).toLocaleTimeString();
        
        let mediaHtml = '';
        if (msg.type !== 'text') {
          mediaHtml = \`
            <div class="media-info" style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <svg viewBox="0 0 24 24" style="width: 1rem; height: 1rem; fill: currentColor; flex-shrink: 0;">
                  <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                </svg>
                <span>\${msg.filename || 'Archivo de Media'} (\${msg.type})</span>
              </div>
              <a href="\${msg.mediaUrl}" download="\${msg.filename || 'archivo.png'}" target="_blank" style="color: #38bdf8; text-decoration: none; font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">
                Abrir / Descargar ↗
              </a>
            </div>
          \`;
          if (msg.type === 'image' && msg.mediaUrl) {
            mediaHtml += \`<img src="\${msg.mediaUrl}" class="media-preview-img" style="max-height: 320px; object-fit: contain; width: auto; max-width: 100%; border-radius: 8px; margin-top: 0.75rem; border: 1px solid var(--border-color); display: block;" alt="Vista previa">\`;
          }
        }

        const badgeClass = \`badge badge-\${msg.type}\`;
        
        card.innerHTML = \`
          <div class="message-header">
            <div class="recipient">
              <span class="\${badgeClass}">\${msg.type}</span>
              <span>Para: \${msg.phone}</span>
            </div>
            <span class="timestamp">\${dateStr}</span>
          </div>
          \${mediaHtml}
          <div class="message-body">\${escapeHtml(msg.text)}</div>
          <div class="message-actions">
            <button class="action-btn \${msg.status === 'delivered' ? 'active-delivered' : ''}" onclick="sendWebhook('\${msg.id}', 'delivered')">📬 Entregado</button>
            <button class="action-btn \${msg.status === 'read' ? 'active-read' : ''}" onclick="sendWebhook('\${msg.id}', 'read')">👁️ Leído</button>
            <button class="action-btn \${msg.status === 'failed' ? 'active-failed' : ''}" onclick="sendWebhook('\${msg.id}', 'failed')">❌ Fallido</button>
            <span style="margin-left: auto; font-size: 0.75rem; color: var(--text-muted); align-self: center;">
              Estado actual: <strong style="color: var(--text-main); text-transform: uppercase;">\${msg.status}</strong>
            </span>
          </div>
        \`;
        container.appendChild(card);
      });
    }

    function escapeHtml(str) {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  </script>
</body>
</html>
  `);
});

app.listen(mockPort, () => {
  console.log(`==================================================`);
  console.log(`🟢 [Mock WhatsApp] OpenWA Mock Server running!`);
  console.log(`🔗 Dashboard: http://localhost:${mockPort}`);
  console.log(`📡 Sending Webhooks to: ${backendWebhookUrl}`);
  console.log(`==================================================`);
});
