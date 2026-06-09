# Invitaciones Backend Express

API Node.js + Express para invitaciones digitales interactivas.

## Inicio
```bash
npm install
copy .env.example .env
npm run dev
```

API: `http://localhost:4000/api`
Health: `http://localhost:4000/health`

## Variables principales
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL`
- `PUBLIC_BASE_URL`
- `AWS_S3_BUCKET`, `AWS_REGION`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- WhatsApp:
  - `WHATSAPP_PROVIDER=openwa`
  - `WHATSAPP_FALLBACK_PROVIDER=meta`
  - `WHATSAPP_OPENWA_TIMEOUT_MS`
  - `OPENWA_BASE_URL`, `OPENWA_API_KEY`, `OPENWA_SESSION_ID`
  - `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`
- SMTP/Nodemailer:
  - `EMAIL_FROM`
  - `EMAIL_TO`
  - `SMTP_SERVICE` o `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_SECURE`
  - `SMTP_USER`
  - `SMTP_PASS`

Para Gmail usa app password, no la contraseña normal. El backend tambien soporta los alias legacy `emailAddress` y `emailPssw`.

## Endpoints MVP
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET/POST/PATCH /api/events`
- `GET/POST/PATCH /api/invitations`
- `GET /api/invitations/public/:slug`
- `POST /api/rsvps/public/:slug`
- `GET/POST /api/guests`
- `POST /api/guests/import`
- `GET /api/dashboard/summary`
- `POST /api/assets/upload-url`
- `POST /api/payments/checkout`
- `POST /api/contact`

## Docker local
```bash
docker compose up --build
```
