const fs = require('fs');
const path = require('path');

const frontendRoot = path.resolve(__dirname, '../../Invitaciones-Frontend');

if (!fs.existsSync(frontendRoot)) {
  console.error('Frontend directory not found at:', frontendRoot);
  process.exit(1);
}

// 1. Update UnauthorizedComponent CSS
const unauthDir = path.join(frontendRoot, 'src/app/features/unauthorized');
if (!fs.existsSync(unauthDir)) {
  fs.mkdirSync(unauthDir, { recursive: true });
}

const unauthHtmlPath = path.join(unauthDir, 'unauthorized.component.html');
const unauthHtmlContent = `<div class="unauth-container">
  <div class="unauth-card">
    <div class="unauth-badge">
      <span class="unauth-code">403</span>
      <span class="unauth-pill">Acceso Restringido</span>
    </div>

    <div class="unauth-icon-wrapper">
      <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        <line x1="12" y1="15" x2="12" y2="17"></line>
      </svg>
    </div>

    <h1 class="unauth-title">Acceso No Autorizado</h1>
    <p class="unauth-description">
      Esta sección contiene herramientas exclusivas para cuentas con rol de <strong>Administrador</strong>. Tu cuenta actual no cuenta con los permisos necesarios para visualizar este módulo.
    </p>

    <div class="unauth-account-info" *ngIf="auth.user$ | async as user">
      <div class="unauth-info-label">Sesión actual</div>
      <div class="unauth-info-email">{{ user.email }}</div>
      <div class="unauth-role-tag">
        <span>Rol actual:</span>
        <span class="unauth-role-badge">{{ user.role }}</span>
      </div>
    </div>

    <div class="unauth-actions">
      <a routerLink="/new/dashboard" class="unauth-btn unauth-btn-primary">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span>Volver al Dashboard</span>
      </a>

      <button type="button" (click)="auth.logout()" class="unauth-btn unauth-btn-secondary">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
        <span>Cambiar de Cuenta</span>
      </button>
    </div>
  </div>
</div>
`;
fs.writeFileSync(unauthHtmlPath, unauthHtmlContent, 'utf8');
console.log('✅ Updated HTML:', unauthHtmlPath);

const unauthCssPath = path.join(unauthDir, 'unauthorized.component.css');
const unauthCssContent = `.unauth-container {
  min-height: calc(100vh - 100px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: var(--nw-bg, #faf7f2);
}

.unauth-card {
  max-width: 500px;
  width: 100%;
  background: #ffffff;
  border: 1px solid var(--nw-border, #eadecc);
  border-radius: 24px;
  padding: 40px 32px;
  text-align: center;
  box-shadow: 0 14px 36px rgba(46, 37, 33, 0.08), 0 2px 8px rgba(46, 37, 33, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.unauth-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 5px 14px;
  border-radius: 999px;
  margin-bottom: 22px;
}

.unauth-code {
  font-family: var(--nw-font-display, 'Outfit', sans-serif);
  font-weight: 900;
  font-size: 12px;
  color: #dc2626;
  background: #fee2e2;
  padding: 2px 7px;
  border-radius: 999px;
}

.unauth-pill {
  font-size: 11px;
  font-weight: 800;
  color: #991b1b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.unauth-icon-wrapper {
  width: 76px;
  height: 76px;
  border-radius: 22px;
  background: #fef2f2;
  border: 1.5px solid #fecaca;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #dc2626;
  margin-bottom: 20px;
  box-shadow: 0 8px 20px rgba(220, 38, 38, 0.12);
}

.unauth-title {
  font-family: var(--nw-font-display, 'Outfit', sans-serif);
  font-size: 24px;
  font-weight: 800;
  color: #1e1b18;
  margin: 0 0 12px 0;
  line-height: 1.25;
}

.unauth-description {
  font-size: 14px;
  line-height: 1.6;
  color: #5c5248;
  margin: 0 0 24px 0;
}

.unauth-description strong {
  color: #dc2626;
  font-weight: 700;
}

.unauth-account-info {
  width: 100%;
  background: #fbf9f6;
  border: 1px solid #eadecc;
  border-radius: 16px;
  padding: 16px 18px;
  margin-bottom: 28px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.unauth-info-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8c7e72;
  font-weight: 700;
}

.unauth-info-email {
  font-size: 15px;
  font-weight: 700;
  color: #1e1b18;
  margin: 2px 0;
  word-break: break-all;
}

.unauth-role-tag {
  font-size: 12px;
  color: #6e6157;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.unauth-role-badge {
  font-weight: 800;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fde68a;
  padding: 2px 10px;
  border-radius: 6px;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.04em;
}

.unauth-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
  justify-content: center;
}

.unauth-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 46px;
  padding: 0 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s ease;
  flex: 1;
  min-width: 180px;
}

.unauth-btn-primary {
  background: var(--nw-accent, #c09c78);
  color: #ffffff;
  border: none;
  box-shadow: 0 4px 12px rgba(192, 156, 120, 0.28);
}

.unauth-btn-primary:hover {
  background: #ad8a66;
  box-shadow: 0 6px 16px rgba(192, 156, 120, 0.4);
  transform: translateY(-1px);
}

.unauth-btn-secondary {
  background: #ffffff;
  color: #2e2621;
  border: 1.5px solid #dcd2c4;
}

.unauth-btn-secondary:hover {
  background: #f5f1ea;
  border-color: #bfaea0;
  transform: translateY(-1px);
}
`;
fs.writeFileSync(unauthCssPath, unauthCssContent, 'utf8');
console.log('✅ Updated CSS:', unauthCssPath);

// 2. Also improve documentacion-backend-api.html overlay colors
const htmlDocsPath = path.join(frontendRoot, 'src/assets/documentacion-backend-api.html');
if (fs.existsSync(htmlDocsPath)) {
  let htmlDocs = fs.readFileSync(htmlDocsPath, 'utf8');
  
  // Replace unauthBox styling in HTML docs if present
  const updatedDocsStyle = `
  <!-- 🛡️ ADMIN GUARD OVERLAY & SCRIPT 🛡️ -->
  <style>
    #unauthOverlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: #faf7f2;
      color: #2e2621;
      font-family: 'Inter', system-ui, sans-serif;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    #unauthOverlay.visible {
      display: flex;
    }
    .unauth-box {
      max-width: 480px;
      width: 100%;
      background: #ffffff;
      border: 1px solid #eadecc;
      border-radius: 24px;
      padding: 38px 30px;
      text-align: center;
      box-shadow: 0 16px 40px rgba(46, 37, 33, 0.08);
    }
    .unauth-box-code {
      display: inline-block;
      font-size: 12px;
      font-weight: 800;
      color: #dc2626;
      background: #fee2e2;
      border: 1px solid #fecaca;
      padding: 4px 14px;
      border-radius: 999px;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .unauth-box-title {
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 800;
      color: #1e1b18;
      margin: 0 0 10px;
    }
    .unauth-box-text {
      font-size: 14px;
      line-height: 1.6;
      color: #5c5248;
      margin-bottom: 24px;
    }
    .unauth-box-text strong {
      color: #dc2626;
    }
    .unauth-box-text code {
      background: #fef3c7;
      color: #92400e;
      padding: 2px 6px;
      border-radius: 5px;
      font-weight: 700;
    }
    .unauth-box-btns {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .unauth-box-btn {
      padding: 11px 22px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s;
    }
    .unauth-box-btn.primary {
      background: #c09c78;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(192, 156, 120, 0.28);
    }
    .unauth-box-btn.primary:hover {
      background: #ad8a66;
    }
    .unauth-box-btn.secondary {
      background: #ffffff;
      color: #2e2621;
      border: 1.5px solid #dcd2c4;
    }
    .unauth-box-btn.secondary:hover {
      background: #f5f1ea;
    }
  </style>`;

  if (htmlDocs.includes('<!-- 🛡️ ADMIN GUARD OVERLAY & SCRIPT 🛡️ -->')) {
    htmlDocs = htmlDocs.replace(/<!-- 🛡️ ADMIN GUARD OVERLAY & SCRIPT 🛡️ -->[\s\S]*?<\/style>/, updatedDocsStyle.trim());
    fs.writeFileSync(htmlDocsPath, htmlDocs, 'utf8');
    console.log('✅ Updated HTML Docs Style:', htmlDocsPath);
  }
}

console.log('🎉 Colors & Theme update completed.');
