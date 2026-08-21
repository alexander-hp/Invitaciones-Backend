export interface GuestPassData {
  guestName: string;
  tableName?: string;
  seatLabel?: string;
  allowedCompanions: number;
  qrCodeUrl: string;
  headline: string;
  subheadline?: string;
  eventDateFormatted?: string;
  locationAddress?: string;
  dressCode?: string;
  brandLogoUrl?: string;
  coverImageUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}

export function generateGuestPassHtml(data: GuestPassData): string {
  const primary = data.primaryColor || '#0b1426';
  const accent = data.accentColor || '#c9a87c';
  const accentLight = data.accentColor ? `${data.accentColor}33` : '#c9a87c33';
  const accentDark = data.accentColor ? `${data.accentColor}cc` : '#c9a87ccc';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pase VIP · ${data.guestName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&family=Playfair+Display:ital,wght@0,600;0,700;1,500;1,600&display=swap');

        @page {
          size: portrait;
          margin: 0;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

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

        /* ── Contenedor principal ── */
        .pass-container {
          width: 100%;
          max-width: 640px;
          border-radius: 40px;
          background: #ffffff;
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(201, 168, 124, 0.2);
          overflow: hidden;
          position: relative;
          transition: transform 0.2s;
        }

        /* ── Borde decorativo interno ── */
        .pass-container::before {
          content: '';
          position: absolute;
          inset: 12px;
          border-radius: 28px;
          border: 1px solid rgba(201, 168, 124, 0.25);
          pointer-events: none;
          z-index: 10;
        }

        /* ── Cabecera con imagen de portada ── */
        .pass-header {
          position: relative;
          height: 200px;
          background-color: ${primary};
          background-image: ${data.coverImageUrl ? `url('${data.coverImageUrl}')` : `linear-gradient(135deg, ${primary} 0%, #1a2744 100%)`};
          background-size: cover;
          background-position: center 30%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 28px;
          text-align: center;
          overflow: hidden;
        }

        .pass-header-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(11, 20, 38, 0.30) 0%, rgba(11, 20, 38, 0.80) 100%);
          z-index: 1;
        }

        /* Efecto de luz superior */
        .pass-header::after {
          content: '';
          position: absolute;
          top: -60%;
          left: -20%;
          width: 140%;
          height: 140%;
          background: radial-gradient(ellipse at 30% 20%, rgba(201, 168, 124, 0.15) 0%, transparent 70%);
          z-index: 0;
          pointer-events: none;
        }

        .pass-header-content {
          position: relative;
          z-index: 2;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .pass-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(201, 168, 124, 0.18);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(201, 168, 124, 0.30);
          padding: 4px 18px 4px 14px;
          border-radius: 100px;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: ${accent};
          margin-bottom: 6px;
        }

        .pass-badge svg {
          width: 14px;
          height: 14px;
          fill: ${accent};
        }

        .pass-brand-logo {
          max-height: 48px;
          max-width: 200px;
          object-fit: contain;
          margin-bottom: 4px;
          filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.30));
        }

        .pass-subheadline {
          font-size: 0.70rem;
          text-transform: uppercase;
          letter-spacing: 3px;
          color: rgba(255, 255, 255, 0.70);
          font-weight: 500;
          margin-bottom: 2px;
        }

        .pass-headline {
          font-family: 'Playfair Display', serif;
          font-weight: 700;
          font-size: 2.0rem;
          line-height: 1.15;
          color: #ffffff;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.40);
          letter-spacing: -0.01em;
        }

        /* ── Cuerpo del pase ── */
        .pass-body {
          padding: 32px 32px 28px;
          background: #ffffff;
          position: relative;
        }

        /* Línea decorativa superior */
        .pass-body::before {
          content: '';
          position: absolute;
          top: 0;
          left: 32px;
          right: 32px;
          height: 2px;
          background: linear-gradient(90deg, transparent, ${accentLight}, ${accent}, ${accentLight}, transparent);
        }

        /* ── Barra de fecha ── */
        .pass-date-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: #f8f5f0;
          border-radius: 14px;
          padding: 10px 18px;
          margin-bottom: 28px;
          font-weight: 600;
          font-size: 0.88rem;
          color: ${primary};
          border: 1px solid rgba(201, 168, 124, 0.15);
        }

        .pass-date-bar svg {
          width: 18px;
          height: 18px;
          fill: ${accent};
          flex-shrink: 0;
        }

        /* ── Grid principal ── */
        .pass-grid {
          display: flex;
          gap: 28px;
          align-items: stretch;
        }

        /* ── QR ── */
        .pass-qr {
          flex: 0 0 140px;
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
          transition: box-shadow 0.2s;
        }

        .pass-qr-frame img {
          width: 120px;
          height: 120px;
          display: block;
          border-radius: 12px;
        }

        .pass-qr-label {
          font-size: 0.60rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #94a3b8;
          margin-top: 2px;
        }

        /* ── Detalles del invitado ── */
        .pass-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .pass-guest-name {
          font-size: 1.55rem;
          font-weight: 800;
          color: ${primary};
          line-height: 1.2;
          margin-bottom: 10px;
          letter-spacing: -0.02em;
        }

        .pass-guest-name small {
          font-weight: 400;
          font-size: 0.85rem;
          color: #64748b;
          margin-left: 6px;
        }

        .pass-info-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.88rem;
          color: #334155;
          padding: 6px 0;
          border-bottom: 1px solid #f1f0ed;
        }

        .pass-info-item:last-of-type {
          border-bottom: 0;
        }

        .pass-info-item svg {
          width: 18px;
          height: 18px;
          fill: ${accent};
          flex-shrink: 0;
        }

        .pass-info-item strong {
          color: ${primary};
          font-weight: 700;
        }

        .pass-info-item .pass-meta {
          color: #64748b;
          font-weight: 400;
        }

        .pass-info-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: ${accentLight};
          color: ${primary};
          padding: 4px 14px 4px 10px;
          border-radius: 100px;
          font-size: 0.78rem;
          font-weight: 600;
          margin-top: 4px;
          border: 1px solid rgba(201, 168, 124, 0.15);
        }

        .pass-info-badge svg {
          width: 16px;
          height: 16px;
          fill: ${accent};
        }

        /* ── Separador con perforación ── */
        .pass-divider {
          position: relative;
          margin: 24px 0 20px;
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

        .pass-divider-circle-left,
        .pass-divider-circle-right {
          position: absolute;
          top: 50%;
          width: 20px;
          height: 20px;
          background: #e8e2da;
          border-radius: 50%;
          transform: translateY(-50%);
        }

        .pass-divider-circle-left {
          left: -32px;
        }
        .pass-divider-circle-right {
          right: -32px;
        }

        /* ── Footer ── */
        .pass-footer {
          text-align: center;
          font-size: 0.75rem;
          color: #94a3b8;
          line-height: 1.5;
          letter-spacing: 0.3px;
          padding-top: 4px;
        }

        .pass-footer svg {
          display: inline-block;
          width: 14px;
          height: 14px;
          fill: ${accent};
          vertical-align: middle;
          margin: 0 4px;
        }

        /* ── Responsive ── */
        @media (max-width: 550px) {
          body {
            padding: 16px 12px;
          }
          .pass-container {
            border-radius: 28px;
          }
          .pass-container::before {
            inset: 8px;
            border-radius: 20px;
          }
          .pass-header {
            height: 160px;
            padding: 20px;
          }
          .pass-headline {
            font-size: 1.5rem;
          }
          .pass-body {
            padding: 22px 18px 20px;
          }
          .pass-grid {
            flex-direction: column;
            align-items: center;
            gap: 18px;
          }
          .pass-qr {
            flex: 0 0 auto;
            flex-direction: row;
            gap: 16px;
            width: 100%;
            justify-content: center;
          }
          .pass-qr-frame img {
            width: 100px;
            height: 100px;
          }
          .pass-details {
            width: 100%;
          }
          .pass-guest-name {
            font-size: 1.3rem;
            text-align: center;
          }
          .pass-info-item {
            font-size: 0.82rem;
            padding: 5px 0;
          }
          .pass-divider-circle-left,
          .pass-divider-circle-right {
            display: none;
          }
          .pass-date-bar {
            font-size: 0.78rem;
            padding: 8px 14px;
          }
        }

        /* ── Impresión ── */
        @media print {
          body {
            background: #ffffff;
            padding: 0;
            margin: 0;
          }
          .pass-container {
            box-shadow: none;
            border-radius: 0;
            max-width: 100%;
          }
          .pass-container::before {
            display: none;
          }
          .pass-divider-circle-left,
          .pass-divider-circle-right {
            display: none;
          }
          .pass-header {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .pass-badge {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .pass-qr-frame {
            box-shadow: 0 0 0 1px rgba(201, 168, 124, 0.3);
          }
          .pass-info-badge {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>

      <div class="pass-container">

        <!-- ═══ HEADER ═══ -->
        <div class="pass-header">
          <div class="pass-header-overlay"></div>
          <div class="pass-header-content">

            <span class="pass-badge">
              <svg viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
              Pase Confirmado
            </span>

            ${data.brandLogoUrl ? `<img src="${data.brandLogoUrl}" alt="Logo" class="pass-brand-logo">` : ''}

            ${data.subheadline ? `<div class="pass-subheadline">${data.subheadline}</div>` : ''}

            <h1 class="pass-headline">${data.headline}</h1>

          </div>
        </div>

        <!-- ═══ BODY ═══ -->
        <div class="pass-body">

          <!-- Fecha -->
          ${data.eventDateFormatted ? `
            <div class="pass-date-bar">
              <svg viewBox="0 0 24 24"><path d="M19 3H18V1H16V3H8V1H6V3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19Z"/></svg>
              <span>${data.eventDateFormatted}</span>
            </div>
          ` : ''}

          <!-- Grid principal -->
          <div class="pass-grid">

            <!-- QR -->
            ${data.qrCodeUrl ? `
              <div class="pass-qr">
                <div class="pass-qr-frame">
                  <img src="${data.qrCodeUrl}" alt="Código QR de acceso">
                </div>
                <div class="pass-qr-label">Escanea para acceder</div>
              </div>
            ` : ''}

            <!-- Detalles -->
            <div class="pass-details">

              <div class="pass-guest-name">
                ${data.guestName}
                <small>VIP</small>
              </div>

              <div class="pass-info-item">
                <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9C5 13.25 12 22 12 22S19 13.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5Z"/></svg>
                <span>
                  Mesa: <strong>${data.tableName || 'Asignada en recepción'}</strong>
                  ${data.seatLabel ? `&nbsp;·&nbsp; Asiento: <strong>${data.seatLabel}</strong>` : ''}
                </span>
              </div>

              <div class="pass-info-item">
                <svg viewBox="0 0 24 24"><path d="M16 11C17.66 11 19 9.66 19 8S17.66 5 16 5 13 6.34 13 8 14.34 11 16 11ZM8 11C9.66 11 11 9.66 11 8S9.66 5 8 5 5 6.34 5 8 6.34 11 8 11ZM8 13C5.79 13 2 14.79 2 17V19H14V17C14 14.79 10.21 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V19H22V17C22 14.79 18.21 13 16 13Z"/></svg>
                <span>Acompañantes: <strong>${data.allowedCompanions || 1}</strong> <span class="pass-meta">personas autorizadas</span></span>
              </div>

              ${data.locationAddress ? `
                <div class="pass-info-item">
                  <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9C5 13.25 12 22 12 22S19 13.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5Z"/></svg>
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
        <!-- /pass-body -->

      </div>
      <!-- /pass-container -->

      <script>
        window.onload = function () {
          setTimeout(function () {
            window.print();
          }, 500);
        };
      </script>

    </body>
    </html>
  `;
}