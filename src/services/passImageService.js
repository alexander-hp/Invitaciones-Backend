const url = require('url');
const path = require('path');
const QRCode = require('qrcode');

// Dynamically import puppeteer using pathToFileURL to support CommonJS and ES Module on Windows/Linux
async function getPuppeteer() {
  const puppeteerPath = require.resolve('puppeteer');
  const puppeteerFileUrl = url.pathToFileURL(puppeteerPath).href;
  const puppeteerModule = await import(puppeteerFileUrl);
  const puppeteer = puppeteerModule.default || puppeteerModule;
  return puppeteer.puppeteer || puppeteer;
}

// ═══ SINGLETON BROWSER INSTANCE POOL ═══
let browserPromise = null;
let idleTimer = null;
const IDLE_TIMEOUT_MS = 60000; // Auto-close browser after 60s of inactivity

function resetIdleTimer(browser) {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    try {
      if (browser && browser.connected) {
        await browser.close();
      }
    } catch (err) {
      // Ignore cleanup error
    } finally {
      browserPromise = null;
    }
  }, IDLE_TIMEOUT_MS);
}

async function getOrCreateBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      if (browser && browser.connected) {
        resetIdleTimer(browser);
        return browser;
      }
    } catch (err) {
      browserPromise = null;
    }
  }

  browserPromise = (async () => {
    const puppeteer = await getPuppeteer();
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-position=-32000,-32000',
        '--window-size=640,900',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    browser.on('disconnected', () => {
      browserPromise = null;
      if (idleTimer) clearTimeout(idleTimer);
    });

    resetIdleTimer(browser);
    return browser;
  })();

  return browserPromise;
}

/**
 * Ensures QR Code is generated locally in memory to eliminate external network requests.
 */
async function ensureLocalQrCode(data) {
  if (!data) return;
  const code = data.checkInCode || 'VIP';
  if (!data.qrCodeUrl || data.qrCodeUrl.startsWith('http')) {
    try {
      data.qrCodeUrl = await QRCode.toDataURL(code, {
        width: 250,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
    } catch (e) {
      // Fallback to default
    }
  }
}

/**
 * Resolves models data into a structured payload for the guest pass.
 */
function generatePassDataForGuest({ guest, event, invitation }) {
  const styles = invitation?.content || {};
  const palette = styles.palette || {};

  // Formatter Date
  let eventDateFormatted = '';
  if (event?.date) {
    const d = new Date(event.date);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = d.toLocaleDateString('es-ES', options);
    eventDateFormatted = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  }

  // Resolve subheadline (Invitation subtitle)
  const subheadline = styles.subheadline || 'Queremos compartir este día contigo';

  const checkInCode = guest.checkInCode || 'VIP';

  // QR Code URL (QR Server API - high resolution fallback)
  const qrCodeUrl = guest.checkInCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(guest.checkInCode)}`
    : 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VIP';

  // Resolve locationAddress (first location from invitation content, falling back to event venue)
  const firstLocation = invitation?.content?.locations?.[0];
  const locationAddress = firstLocation?.address || firstLocation?.name || event?.venue?.address || event?.venue?.name || '';

  return {
    guestName: guest.name || 'Invitado',
    tableName: guest.tableName || '',
    seatLabel: guest.seatLabel || '',
    allowedCompanions: guest.allowedCompanions || 1,
    checkInCode,
    qrCodeUrl,
    headline: event?.title || styles.headline || 'Nuestro Evento',
    subheadline,
    eventDateFormatted,
    locationAddress,
    dressCode: event?.dressCode || styles.dressCode || '',
    brandLogoUrl: styles.brandLogoUrl || '',
    coverImageUrl: styles.coverImageUrl || '',
    primaryColor: palette.primary || '#0b1426',
    accentColor: palette.accent || '#c9a87c'
  };
}

/**
 * Generates the card-only HTML snippet for a pass.
 */
function generatePassCardInnerHtml(data) {
  const primary = data.primaryColor || '#0b1426';
  const accent = data.accentColor || '#c9a87c';

  return `
    <div class="pass-container">
      <!-- ═══ HEADER ═══ -->
      <div class="pass-header" style="${data.coverImageUrl ? `background-image: url('${data.coverImageUrl}')` : `background: linear-gradient(135deg, ${primary} 0%, #1a2744 100%)`}">
        <div class="pass-header-overlay"></div>
        <div class="pass-header-content">
          <span class="pass-badge">
            <svg viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
            PASE CONFIRMADO
          </span>
          ${data.brandLogoUrl ? `<img src="${data.brandLogoUrl}" alt="Logo" class="pass-brand-logo">` : ''}
          ${data.subheadline ? `<div class="pass-subheadline">${data.subheadline}</div>` : ''}
          <h1 class="pass-headline">${data.headline}</h1>
        </div>
      </div>

      <!-- ═══ BODY ═══ -->
      <div class="pass-body">
        ${data.eventDateFormatted ? `
          <div class="pass-date-bar">
            <svg viewBox="0 0 24 24"><path d="M19 3H18V1H16V3H8V1H6V3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19Z"/></svg>
            <span>${data.eventDateFormatted}</span>
          </div>
        ` : ''}

        <div class="pass-grid">
          <div class="pass-qr">
            <div class="pass-qr-frame">
              <img src="${data.qrCodeUrl}" alt="Código QR">
            </div>
            <div class="pass-qr-label">ESCANEA PARA ACCEDER</div>
          </div>

          <div class="pass-details">
            <div class="pass-guest-header">
              <span class="pass-guest-name">${data.guestName}</span>
              <span class="pass-vip-badge">VIP</span>
            </div>

            <div class="pass-info-item">
              <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              <span>Mesa: <strong>${data.tableName || 'Asignada en recepción'}</strong>${data.seatLabel ? ` · Asiento: <strong>${data.seatLabel}</strong>` : ''}</span>
            </div>

            <div class="pass-info-item">
              <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              <span>Acompañantes: <strong>${data.allowedCompanions || 1}</strong> <span class="pass-meta">personas autorizadas</span></span>
            </div>

            ${data.locationAddress ? `
              <div class="pass-info-item">
                <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                <span><strong>${data.locationAddress}</strong></span>
              </div>
            ` : ''}

            ${data.dressCode ? `
              <div class="pass-info-badge">
                <svg viewBox="0 0 24 24"><path d="M20 6H4V4H20V6ZM4 10H20V8H4V10ZM4 14H20V12H4V14ZM4 18H20V16H4V18Z"/></svg>
                <span>Dress Code: <strong>${data.dressCode}</strong></span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Divisor con efecto de perforación -->
        <div class="pass-divider">
          <div class="pass-divider-circle-left"></div>
          <div class="pass-divider-line"></div>
          <span class="pass-divider-icon">✦</span>
          <div class="pass-divider-line"></div>
          <div class="pass-divider-circle-right"></div>
        </div>

        <!-- Footer -->
        <div class="pass-footer">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM12 20C7.58 20 4 16.42 4 12S7.58 4 12 4 20 7.58 20 12 16.42 20 12 20ZM13 12V8H11V13L14.5 15.5L15.5 14L13 12Z"/></svg>
          Presenta este pase (digital o impreso) con tu código QR en el acceso.
        </div>
      </div>
    </div>
  `;
}

function getPassCommonCss(primary = '#0b1426', accent = '#c9a87c') {
  const accentLight = accent ? `${accent}33` : '#c9a87c33';
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&family=Playfair+Display:ital,wght@0,600;0,700;1,500;1,600&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #e8e2da;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .pass-container {
      width: 100%;
      max-width: 640px;
      border-radius: 40px;
      background: #ffffff;
      box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(201, 168, 124, 0.2);
      overflow: hidden;
      position: relative;
    }

    .pass-container::before {
      content: '';
      position: absolute;
      inset: 12px;
      border-radius: 28px;
      border: 1px solid rgba(201, 168, 124, 0.25);
      pointer-events: none;
      z-index: 10;
    }

    .pass-header {
      position: relative;
      min-height: 200px;
      background-color: ${primary};
      background-size: cover;
      background-position: center 30%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 28px 28px;
      text-align: center;
      overflow: hidden;
    }

    .pass-header-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(11, 20, 38, 0.35) 0%, rgba(11, 20, 38, 0.85) 100%);
      z-index: 1;
    }

    .pass-header-content {
      position: relative;
      z-index: 2;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .pass-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(201, 168, 124, 0.18);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(201, 168, 124, 0.30);
      padding: 5px 18px 5px 14px;
      border-radius: 100px;
      font-size: 0.70rem;
      font-weight: 700;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: ${accent};
      margin-bottom: 4px;
    }

    .pass-badge svg { width: 14px; height: 14px; fill: ${accent}; }

    .pass-brand-logo {
      max-height: 48px;
      max-width: 200px;
      object-fit: contain;
      margin-bottom: 4px;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.30));
    }

    .pass-subheadline {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: rgba(255, 255, 255, 0.80);
      font-weight: 600;
      margin-bottom: 2px;
    }

    .pass-headline {
      font-family: 'Playfair Display', serif;
      font-weight: 700;
      font-size: 2.1rem;
      line-height: 1.2;
      color: #ffffff;
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.50);
    }

    .pass-body {
      padding: 30px 32px 28px;
      background: #ffffff;
      position: relative;
    }

    .pass-body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 32px;
      right: 32px;
      height: 2px;
      background: linear-gradient(90deg, transparent, ${accentLight}, ${accent}, ${accentLight}, transparent);
    }

    .pass-date-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: #f8f5f0;
      border-radius: 14px;
      padding: 10px 18px;
      margin-bottom: 26px;
      font-weight: 700;
      font-size: 0.95rem;
      color: ${primary};
      border: 1px solid rgba(201, 168, 124, 0.18);
    }

    .pass-date-bar svg { width: 18px; height: 18px; fill: ${accent}; flex-shrink: 0; }

    .pass-grid {
      display: flex;
      gap: 28px;
      align-items: stretch;
    }

    .pass-qr {
      flex: 0 0 144px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .pass-qr-frame {
      background: #ffffff;
      border-radius: 20px;
      padding: 10px;
      box-shadow: 0 8px 28px rgba(201, 168, 124, 0.18), 0 0 0 1px rgba(201, 168, 124, 0.15);
    }

    .pass-qr-frame img {
      width: 124px;
      height: 124px;
      display: block;
      border-radius: 12px;
    }

    .pass-qr-label {
      font-size: 0.62rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #94a3b8;
      margin-top: 4px;
      text-align: center;
    }

    .pass-details {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
    }

    .pass-guest-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .pass-guest-name {
      font-size: 1.65rem;
      font-weight: 800;
      color: ${primary};
      line-height: 1.1;
      letter-spacing: -0.02em;
    }

    .pass-vip-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .pass-info-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.90rem;
      color: #334155;
      padding: 6px 0;
      border-bottom: 1px solid #f1f0ed;
    }

    .pass-info-item span {
      flex: 1;
      word-break: break-word;
      overflow-wrap: break-word;
      line-height: 1.35;
    }

    .pass-info-item svg { width: 18px; height: 18px; fill: ${accent}; flex-shrink: 0; margin-top: 1px; }
    .pass-info-item strong { color: ${primary}; font-weight: 700; }
    .pass-info-item .pass-meta { color: #64748b; font-weight: 400; }

    .pass-info-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fbf8f3;
      color: ${primary};
      padding: 6px 14px;
      border-radius: 100px;
      font-size: 0.82rem;
      font-weight: 600;
      margin-top: 8px;
      border: 1px solid rgba(201, 168, 124, 0.25);
    }

    .pass-info-badge svg { width: 16px; height: 16px; fill: ${accent}; }

    .pass-divider {
      position: relative;
      margin: 26px 0 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .pass-divider-line {
      flex: 1;
      height: 2px;
      background: repeating-linear-gradient(90deg, #d4cfc8 0px, #d4cfc8 6px, transparent 6px, transparent 12px);
    }

    .pass-divider-icon {
      flex-shrink: 0;
      color: #b9b1a6;
      font-size: 1.2rem;
      line-height: 1;
    }

    .pass-divider-circle-left, .pass-divider-circle-right {
      position: absolute;
      top: 50%;
      width: 20px;
      height: 20px;
      background: #e8e2da;
      border-radius: 50%;
      transform: translateY(-50%);
    }

    .pass-divider-circle-left { left: -32px; }
    .pass-divider-circle-right { right: -32px; }

    .pass-footer {
      text-align: center;
      font-size: 0.76rem;
      color: #94a3b8;
      line-height: 1.5;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .pass-footer svg { width: 14px; height: 14px; fill: ${accent}; flex-shrink: 0; }
  `;
}

/**
 * Generates the full Guest Pass HTML page.
 */
function generateGuestPassHtml(data) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pase VIP · ${data.guestName}</title>
      <style>
        ${getPassCommonCss(data.primaryColor, data.accentColor)}
      </style>
    </head>
    <body>
      ${generatePassCardInnerHtml(data)}
    </body>
    </html>
  `;
}

/**
 * Uses high-performance headless Puppeteer instance pool to capture pixel-perfect PNG of the card.
 */
async function generatePassImageBuffer(dataOrHtml) {
  let html;
  if (typeof dataOrHtml === 'object' && dataOrHtml !== null) {
    await ensureLocalQrCode(dataOrHtml);
    html = generateGuestPassHtml(dataOrHtml);
  } else {
    html = dataOrHtml;
  }

  const browser = await getOrCreateBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 640, height: 900, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load', timeout: 15000 });

    const element = await page.$('.pass-container');
    if (element) {
      return await element.screenshot({ type: 'png' });
    } else {
      return await page.screenshot({ type: 'png', fullPage: true });
    }
  } finally {
    await page.close();
    resetIdleTimer(browser);
  }
}

/**
 * Returns the PNG pass as a Base64 string (for WhatsApp media / Email attachments).
 */
async function generatePassImageBase64(dataOrHtml) {
  const buffer = await generatePassImageBuffer(dataOrHtml);
  return buffer.toString('base64');
}

/**
 * High-performance batch pass generator.
 * Items is an array of { filename, data }.
 * Uses chunked in-DOM rendering to screenshot multiple cards in parallel without page reloads.
 */
async function generateBatchPassImages(items) {
  if (!items || !items.length) return [];

  // Generate local QR codes in parallel to eliminate network latency
  await Promise.all(
    items.map(async (item) => {
      if (item.data) await ensureLocalQrCode(item.data);
    })
  );

  const browser = await getOrCreateBrowser();
  const results = [];
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 640, height: 900, deviceScaleFactor: 2 });

    const chunkSize = 20;
    for (let c = 0; c < items.length; c += chunkSize) {
      const chunk = items.slice(c, c + chunkSize);
      const firstData = chunk[0].data || {};

      const batchDoc = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="utf-8">
          <style>
            ${getPassCommonCss(firstData.primaryColor, firstData.accentColor)}
            body {
              background: #e8e2da;
              padding: 30px 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 30px;
              margin: 0;
            }
          </style>
        </head>
        <body>
          ${chunk.map(item => generatePassCardInnerHtml(item.data)).join('\n')}
        </body>
        </html>
      `;

      await page.setContent(batchDoc, { waitUntil: 'load', timeout: 30000 });

      // Wait for images to be loaded
      await page.evaluate(async () => {
        const images = Array.from(document.querySelectorAll('img'));
        await Promise.all(
          images.map(img => {
            if (img.complete) return;
            return new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
              setTimeout(resolve, 2500);
            });
          })
        );
      });

      const cards = await page.$$('.pass-container');
      for (let i = 0; i < cards.length; i++) {
        const buffer = await cards[i].screenshot({ type: 'png' });
        results.push({
          filename: chunk[i].filename,
          buffer
        });
      }
    }
    return results;
  } finally {
    await page.close();
    resetIdleTimer(browser);
  }
}

module.exports = {
  generatePassDataForGuest,
  generateGuestPassHtml,
  generatePassCardInnerHtml,
  generatePassImageBase64,
  generatePassImageBuffer,
  generateBatchPassImages
};
