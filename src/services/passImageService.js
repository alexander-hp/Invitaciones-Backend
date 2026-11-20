const fs = require('fs');
const url = require('url');
const path = require('path');
const QRCode = require('qrcode');

let lucideDir = null;
try {
  lucideDir = path.join(path.dirname(require.resolve('lucide-static/package.json')), 'icons');
} catch (e) {
  lucideDir = null;
}

const lucideCache = new Map();

function getLucideSvg(iconName, style = {}) {
  if (!iconName) return '';
  const cleanName = iconName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .trim()
    .replace(/_/g, '-');

  let rawSvg = lucideCache.get(cleanName);
  if (!rawSvg) {
    if (!lucideDir) return '';
    const filePath = path.join(lucideDir, `${cleanName}.svg`);
    if (!fs.existsSync(filePath)) return '';
    rawSvg = fs.readFileSync(filePath, 'utf8');
    lucideCache.set(cleanName, rawSvg);
  }

  const strokeWidth = style.iconStrokeWidth || 2;
  const fill = style.iconFilled ? (style.color || 'currentColor') : 'none';

  return rawSvg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/width="24"/g, 'width="100%"')
    .replace(/height="24"/g, 'height="100%"')
    .replace(/stroke-width="2"/g, `stroke-width="${strokeWidth}"`)
    .replace(/fill="none"/g, `fill="${fill}"`)
    .replace('<svg', '<svg style="display:block; width:100%; height:100%; overflow:visible;"')
    .trim();
}

function shapeClipPath(kind) {
  const shapes = {
    rectangle: 'none',
    rounded: 'inset(0 round 12px)',
    pill: 'inset(0 round 9999px)',
    circle: 'circle(50% at 50% 50%)',
    ellipse: 'ellipse(50% 42% at 50% 50%)',
    arch: 'inset(0 round 50% 50% 0 0)',
    'arch-inverted': 'inset(0 round 0 0 50% 50%)',
    window: 'inset(0 round 48% 48% 6% 6%)',
    triangle: 'polygon(50% 0, 100% 100%, 0 100%)',
    'triangle-down': 'polygon(0 0, 100% 0, 50% 100%)',
    diamond: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
    pentagon: 'polygon(50% 0, 100% 38%, 81% 100%, 19% 100%, 0 38%)',
    hexagon: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)',
    octagon: 'polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)',
    star: 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 93%, 50% 72%, 21% 93%, 32% 57%, 2% 35%, 39% 35%)',
    'star-4': 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)',
    'star-8': 'polygon(50% 0, 65% 20%, 85% 15%, 80% 35%, 100% 50%, 80% 65%, 85% 85%, 65% 80%, 50% 100%, 35% 80%, 15% 85%, 20% 65%, 0 50%, 20% 35%, 15% 15%, 35% 20%)',
    heart: 'polygon(50% 88%, 35% 73%, 20% 58%, 10% 42%, 8% 26%, 16% 12%, 30% 8%, 42% 14%, 50% 26%, 58% 14%, 70% 8%, 84% 12%, 92% 26%, 90% 42%, 80% 58%, 65% 73%)',
    shield: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)'
  };
  return shapes[kind] || 'none';
}

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
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(guest.checkInCode)}`
    : 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=VIP';

  // Resolve locationAddress (first location from invitation content, falling back to event venue)
  const firstLocation = invitation?.content?.locations?.[0];
  const locationAddress = firstLocation?.address || firstLocation?.name || event?.venue?.address || event?.venue?.name || '';
  const eventTime = event?.time || event?.eventTime || styles.eventTime || '';

  const totalPasses = (guest.allowedCompanions !== undefined && guest.allowedCompanions !== null)
    ? (Number(guest.allowedCompanions) + 1)
    : 1;

  const tableName = (guest.tableName && guest.tableName.trim() !== '' && guest.tableName.trim() !== '—')
    ? guest.tableName.trim()
    : 'General';

  const passDesign = invitation?.passDesign || styles.passDesign;
  const passType = invitation?.passType || styles.passType || (invitation?.useCustomPass || styles.useCustomPass ? 'custom' : 'generic');

  return {
    guestId: guest._id,
    guestName: guest.name || 'Invitado',
    tableName,
    seatLabel: guest.seatLabel || '',
    allowedCompanions: totalPasses,
    checkInCode,
    qrCodeUrl,
    headline: event?.title || styles.headline || 'Nuestro Evento',
    subheadline,
    eventDateFormatted,
    locationAddress,
    eventTime,
    dressCode: event?.dressCode || styles.dressCode || '',
    brandLogoUrl: styles.passLogoUrl || styles.brandLogoUrl || '',
    coverImageUrl: styles.coverImageUrl || '',
    primaryColor: palette.primary || '#0b1426',
    accentColor: palette.accent || '#c9a87c',
    passType,
    passDesign
  };
}

/**
 * Generates the card-only HTML snippet for a pass.
 */
function generateCustomPassCardInnerHtml(data) {
  const design = data.passDesign || {};
  const sheet = design.sections?.[0] || {};
  const width = Number(sheet.pluginSettings?.sheetWidth || sheet.width || design.canvasSize?.width || 450);
  const height = Number(sheet.pluginSettings?.sheetHeight || sheet.height || design.canvasSize?.height || 800);
  const bg = sheet.background?.color || sheet.style?.backgroundColor || design.theme?.backgroundColor || '#0b1426';
  const bgImg = sheet.background?.imageUrl ? `background-image: url('${sheet.background.imageUrl}'); background-size: cover; background-position: center;` : '';

  const evalText = (txt) => {
    if (!txt) return '';
    const guestName = data.guestName || 'Invitado VIP';
    const tableName = (data.tableName && data.tableName !== '—' && data.tableName.trim() !== '') ? data.tableName : 'General';
    const seatLabel = data.seatLabel || '';
    const companions = String(data.allowedCompanions !== undefined ? data.allowedCompanions : 1);
    const checkInCode = data.checkInCode || (data.guestId ? String(data.guestId).slice(-6).toUpperCase() : 'VIP-001');
    const headline = data.headline || 'Invitación';
    const subheadline = data.subheadline || '';
    const eventDate = data.eventDateFormatted || '';
    const location = data.locationAddress || '';
    const eventTime = data.eventTime || '';

    return txt
      .replace(/\{\{guest\.name\}\}|\{nombre\}|\{invitado\}/gi, guestName)
      .replace(/\{\{guest\.table\}\}|\{mesa\}/gi, tableName)
      .replace(/\{\{guest\.seat\}\}|\{asiento\}/gi, seatLabel)
      .replace(/\{\{guest\.companions\}\}|\{pases\}|\{acompañantes\}|\{lugares\}/gi, companions)
      .replace(/\{\{guest\.checkInCode\}\}|\{codigo\}|\{checkin\}|\{folio\}/gi, checkInCode)
      .replace(/\{\{event\.title\}\}|\{evento\}/gi, headline)
      .replace(/\{\{event\.date\}\}|\{fecha\}/gi, eventDate)
      .replace(/\{\{event\.venue\}\}|\{lugar\}|\{direccion\}/gi, location)
      .replace(/\{\{event\.time\}\}|\{hora\}/gi, eventTime)
      .replace(/\{\{event\.subheadline\}\}|\{subheadline\}/gi, subheadline);
  };

  const layersHtml = (sheet.layers || []).map(l => {
    const left = l.x || 0;
    const top = l.y || 0;
    const w = l.width || 100;
    const h = l.height || 10;
    const z = l.zIndex || 1;
    const s = l.style || {};
    const isIcon = Boolean(s.iconName || l.iconName);

    let inner = '';
    if (l.type === 'text') {
      if (isIcon) {
        const iconSvg = getLucideSvg(s.iconName || l.iconName, s);
        inner = `<div class="canvas-icon-layer" style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:${s.color || '#c9a87c'}; pointer-events:none;">${iconSvg}</div>`;
      } else {
        const text = evalText(l.text || '');
        const align = s.textAlign || 'center';
        const justify = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
        inner = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:${justify}; text-align:${align}; color:${s.color || '#2E2621'}; font-size:${s.fontSize || 14}px; font-weight:${s.fontWeight || '400'}; font-family:${s.fontFamily || "'Playfair Display', serif"}; letter-spacing:${s.letterSpacing || 0}px; line-height:${s.lineHeight || 1.3}; font-style:${s.fontStyle || 'normal'}; text-transform:${s.textTransform || 'none'}; text-decoration:${s.textDecoration || 'none'}; text-shadow:${s.textShadow || 'none'}; white-space:pre-wrap; word-break:break-word;">${text}</div>`;
      }
    } else if (l.type === 'image') {
      const isQr = l.binding === 'pass.qrCode' || l.binding === 'guest.qrCode' || (l.text && l.text.toLowerCase().includes('qr')) || (l.url && l.url.includes('qr'));
      const src = isQr ? data.qrCodeUrl : (l.url || '');
      inner = `<img src="${src}" alt="Elemento" style="width:100%; height:100%; object-fit:${s.objectFit || 'contain'}; border-radius:${s.borderRadius || 0}px; display:block;" />`;
    } else if (l.type === 'shape') {
      const shapeBg = s.gradientEnabled
        ? `linear-gradient(${Number(s.gradientAngle || 0)}deg, ${s.gradientStart || '#ffffff'}, ${s.gradientEnd || '#000000'})`
        : (s.backgroundColor || 'transparent');
      const shapeBorder = (s.borderWidth && Number(s.borderWidth) > 0)
        ? `${s.borderWidth}px ${s.borderStyle || 'solid'} ${s.borderColor || 'transparent'}`
        : 'none';
      const clip = shapeClipPath(s.shapeKind || 'rectangle');
      const clipStyle = clip !== 'none' ? `clip-path:${clip}; -webkit-clip-path:${clip};` : '';
      inner = `<div class="shape-content" style="box-sizing:border-box; width:100%; height:100%; background:${shapeBg}; border:${shapeBorder}; border-radius:${s.borderRadius || 0}px; box-shadow:${s.boxShadow || 'none'}; ${clipStyle}"></div>`;
    }

    const outerStyles = [
      `position:absolute`,
      `left:${left}%`,
      `top:${top}%`,
      `width:${w}%`,
      `height:${h}%`,
      `z-index:${z}`,
      `transform:rotate(${l.rotation || 0}deg)`,
      `opacity:${s.opacity !== undefined ? s.opacity : 1}`,
      `pointer-events:none`
    ];

    if (l.type !== 'shape' && !isIcon) {
      if (s.borderRadius) outerStyles.push(`border-radius:${s.borderRadius}px`);
      if (s.borderWidth && Number(s.borderWidth) > 0) outerStyles.push(`border:${s.borderWidth}px ${s.borderStyle || 'solid'} ${s.borderColor || 'transparent'}`);
      if (s.backgroundColor) outerStyles.push(`background-color:${s.backgroundColor}`);
      if (s.boxShadow) outerStyles.push(`box-shadow:${s.boxShadow}`);
      outerStyles.push(`overflow:hidden`);
    }

    return `<div style="${outerStyles.join('; ')}">${inner}</div>`;
  }).join('');

  return `
    <div class="pass-container custom-pass-container" style="width:${width}px; height:${height}px; position:relative; background-color:${bg}; ${bgImg} overflow:hidden; border-radius:20px; box-shadow:0 16px 50px rgba(0,0,0,0.35); margin:0 auto;">
      ${layersHtml}
    </div>
  `;
}

function generatePassCardInnerHtml(data) {
  if (data.passType === 'custom' && data.passDesign && Array.isArray(data.passDesign.sections) && data.passDesign.sections.length > 0) {
    return generateCustomPassCardInnerHtml(data);
  }
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
    @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Alex+Brush&family=Allura&family=Bodoni+Moda:ital,wght@0,400;0,600;0,700;1,400&family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Serif+Display:ital@0;1&family=Dancing+Script:wght@400;500;600;700&family=Great+Vibes&family=Inter:wght@300;400;500;600;700;800&family=Italianno&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Marcellus&family=MonteCarlo&family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Nunito+Sans:opsz,wght@6..12,300;6..12,400;6..12,500;6..12,600;6..12,700&family=Outfit:wght@300;400;500;600;700&family=Pacifico&family=Parisienne&family=Pinyon+Script&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=Poppins:wght@300;400;500;600;700&family=Quicksand:wght@300;400;500;600;700&family=Raleway:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Sacramento&display=swap');

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

    /* El pase personalizado renderiza su propio diseño y bordes de capa */
    .custom-pass-container::before {
      display: none !important;
      content: none !important;
      border: none !important;
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
  let targetWidth = 450;
  let targetHeight = 800;

  if (typeof dataOrHtml === 'object' && dataOrHtml !== null) {
    await ensureLocalQrCode(dataOrHtml);
    if (dataOrHtml.passDesign) {
      const sheet = dataOrHtml.passDesign.sections?.[0] || {};
      targetWidth = Number(sheet.pluginSettings?.sheetWidth || sheet.width || dataOrHtml.passDesign.canvasSize?.width || 450);
      targetHeight = Number(sheet.pluginSettings?.sheetHeight || sheet.height || dataOrHtml.passDesign.canvasSize?.height || 800);
    }
    html = generateGuestPassHtml(dataOrHtml);
  } else {
    html = dataOrHtml;
  }

  const browser = await getOrCreateBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: Math.max(640, targetWidth + 100),
      height: Math.max(900, targetHeight + 100),
      deviceScaleFactor: 2
    });
    await page.setContent(html, { waitUntil: 'load', timeout: 25000 });

    // Wait for web fonts and images to be fully rendered
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const images = Array.from(document.querySelectorAll('img'));
      await Promise.all(
        images.map(img => {
          if (img.complete) return;
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 2000);
          });
        })
      );
    });

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

      await page.setContent(batchDoc, { waitUntil: 'load', timeout: 35000 });

      // Wait for fonts and images to be loaded
      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
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
