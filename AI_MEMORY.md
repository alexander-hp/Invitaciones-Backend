# AI Memory - Invitaciones Backend Express

## Objetivo del producto

Construir el backend de un SaaS de invitaciones digitales interactivas. El producto no debe competir solo como editor visual tipo Canva; debe ofrecer una experiencia completa para eventos: invitacion publica, RSVP, gestion de invitados, mapa, musica, galeria, QR, estadisticas, pagos y funciones premium.

El mercado inicial son usuarios finales y pequenos organizadores/event planners. El MVP es web responsive, con backend API separado del frontend Angular.

## Stack actual

- Runtime: Node.js.
- Framework API: Express.
- Base de datos: MongoDB con Mongoose.
- Auth: JWT y bcryptjs.
- Seguridad base: Helmet, CORS, rate limit.
- Archivos: AWS S3 con presigned URLs.
- Pagos: Stripe Checkout y webhook inicial.
- Importacion: CSV con `csv-parse`, XLSX con `read-excel-file`.
- Validacion: Zod existe en utilidades, aplicado parcialmente.
- Dev local: Docker Compose levanta MongoDB en `localhost:27017`.
- Scripts: `npm run dev`, `npm run start`, `npm run check`.

## Que hace ahora

La API carga en `http://localhost:4000` y expone health check en:

```txt
GET /health
```

Modulos y comportamiento implementados:

- Auth:
  - Registro con nombre, email, password y rol opcional.
  - Login con JWT.
  - Endpoint `me` protegido.
  - Password reset solo responde mensaje simulado.
- Eventos:
  - Listar eventos del usuario.
  - Crear evento.
  - Obtener evento por id si pertenece al usuario.
  - Actualizar evento con DTO validado y allowlist.
- Invitaciones:
  - Listar invitaciones del usuario.
  - Crear invitacion asociada a evento propio con DTO validado y allowlist.
  - Generar slug unico.
  - Editar invitacion con DTO validado y allowlist.
  - Publicar y despublicar.
  - Obtener invitacion publica por slug si esta publicada.
- Invitados:
  - Listar invitados por evento.
  - Crear invitado.
  - Importar invitados desde CSV/XLSX.
- RSVP:
  - Enviar RSVP publico por slug con DTO validado.
  - Si el RSVP publico incluye `guest`, valida que el invitado pertenezca al mismo evento de la invitacion publicada antes de actualizar su estado.
  - Listar RSVPs por evento con JWT y ownership del evento.
- Plantillas:
  - Listar plantillas activas.
  - Crear plantillas solo con rol admin.
- Dashboard:
  - Devuelve resumen basico de eventos, invitaciones, invitados, confirmados, rechazados, pendientes y acompanantes.
- Assets:
  - Genera URL presignada para subir a S3 si `AWS_S3_BUCKET` esta configurado.
- Pagos:
  - Crea Stripe Checkout para paquetes `basic`, `premium` y `organizer`.
  - Webhook inicial marca pago como `paid` y actualiza plan del usuario.

Endpoints principales:

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/password-reset

GET    /api/events
POST   /api/events
GET    /api/events/:id
PATCH  /api/events/:id

GET    /api/invitations
POST   /api/invitations
PATCH  /api/invitations/:id
POST   /api/invitations/:id/publish
POST   /api/invitations/:id/unpublish
GET    /api/invitations/public/:slug

GET  /api/guests/event/:eventId
POST /api/guests
POST /api/guests/import

POST /api/rsvps/public/:slug
GET  /api/rsvps/event/:eventId

GET  /api/templates
POST /api/templates

GET  /api/dashboard/summary
POST /api/assets/upload-url
POST /api/payments/checkout
POST /api/payments/webhook
```

## Contrato MVP conectado con frontend Angular

Acuerdo cerrado el 2026-06-06 para el flujo Auth + MVP conectado:

- Base local frontend: `http://localhost:4200`.
- Base local API: `http://localhost:4000/api`.
- Auth privada: header `Authorization: Bearer <token>`.
- El frontend guarda el token en `localStorage` con la key `invitaciones_token`.
- Respuestas que consume frontend se mantienen envueltas:
  - Auth: `{ token, user }`.
  - Dashboard: `{ metrics }`.
  - Eventos: `{ events }` y `{ event }`.
  - Invitaciones: `{ invitations }` y `{ invitation, publicUrl }`.
  - Invitacion publica: `{ invitation }`.
  - RSVP publico: `{ rsvp }`.
- El frontend normaliza ids Mongo como `_id` o `id`.
- `invitation.event` puede venir poblado o como string; el frontend soporta ambos.
- Payloads con campos fuera de DTO responden `400` con `{ message: 'Datos invalidos', details }`.
- `POST /api/invitations` y `PATCH /api/invitations/:id` no aceptan `owner`, `status`, `publishedAt` ni `premiumLocked`; esos campos los controla backend.
- `PATCH /api/events/:id` usa allowlist validada.
- `GET /api/rsvps/event/:eventId` responde `404 Evento no encontrado` si el evento no existe o no pertenece al usuario autenticado.
- `POST /api/rsvps/public/:slug` responde `400 Invitado no pertenece a esta invitacion` si `guest` no pertenece al evento de la invitacion publicada.
- `POST /api/rsvps/public/:slug` responde `400 El numero de acompanantes excede lo permitido` si `companions` supera `Guest.allowedCompanions`.

## Que esta simulado

- Recuperacion de password: no genera token, no guarda reset token y no envia email.
- Emails transaccionales: Resend esta instalado/configurado como dependencia, pero no hay servicio real de envio.
- S3: solo genera presigned URL; no hay persistencia formal de assets, validacion de tipos, limites por plan ni borrado.
- Stripe: checkout y webhook son iniciales; falta robustecer ownership, estados, idempotencia y desbloqueo granular de features premium.
- Dashboard: metricas basicas, sin series temporales, filtros por evento ni analitica avanzada.
- Plantillas: modelo y endpoint existen, pero no hay seed ni versionado de configuraciones.
- WhatsApp Business API: esta fuera del MVP actual.

## Que falta

- Cerrar permisos y ownership:
  - Verificar que checkout no acepte invitaciones ajenas.
  - Verificar ownership en importacion/listado de invitados por evento.
- Reemplazar updates con `req.body` directo por allowlists/DTOs en los modulos restantes.
- Aplicar validacion Zod a todos los endpoints mutantes.
- Implementar delete/archivar donde aplique.
- Implementar password reset real.
- Implementar servicio de email con Resend.
- Crear seed de plantillas gratuitas y premium.
- Guardar metadata de assets subidos.
- Implementar control real de planes premium.
- Agregar tests de integracion para auth, eventos, invitaciones, RSVP, guests y pagos.
- Agregar logs estructurados y manejo de errores mas seguro para produccion.
- Preparar despliegue a AWS EC2/ECS/Fargate.

## Riesgos tecnicos conocidos

- Algunas rutas protegidas filtran por `owner`, pero no todas validan ownership de forma completa.
- Eventos, invitaciones y RSVP publico ya tienen DTO/allowlist en el flujo MVP; aun faltan otros modulos mutantes.
- `JWT_SECRET` en `.env.example` es solo placeholder; produccion requiere secreto fuerte.
- El webhook de Stripe debe recibir raw body. La app monta `express.raw` antes de `express.json`, pero se debe validar cuidadosamente al integrar con Stripe real.
- El warning del AWS SDK indica que versiones publicadas despues de enero de 2027 requeriran Node >= 22. Hoy no bloquea Node 20.
- Docker Compose tiene MongoDB sin auth para desarrollo local. No usar asi en produccion.
- No hay repos Git inicializados aun en estos proyectos al momento de crear esta memoria.

## Proximos pasos recomendados

1. Corregir ownership y validaciones del backend antes de conectar mas pantallas.
2. Agregar DTOs/allowlists por modulo.
3. Crear tests de integracion con base de datos de prueba.
4. Crear seed inicial de plantillas.
5. Conectar frontend a flujo real: registro/login, crear evento, crear invitacion, publicar y RSVP.
6. Implementar emails transaccionales.
7. Integrar S3 real con validacion de tipo/tamano.
8. Robustecer Stripe y control de premium.

## Comandos utiles

Instalar dependencias:

```bash
npm install
```

Levantar MongoDB local con Docker:

```bash
docker compose up -d mongo
```

Arrancar API:

```bash
npm run start
```

Arrancar API en desarrollo:

```bash
npm run dev
```

Validar sintaxis entrypoints:

```bash
npm run check
```

Health check:

```bash
curl http://localhost:4000/health
```

## Reglas para futuras IAs

- No asumir que todo el MVP esta integrado; muchas piezas son scaffold funcional.
- Antes de agregar features nuevas, revisar ownership, validacion y seguridad de los endpoints existentes.
- Mantener backend Express puro; el usuario corrigio explicitamente que no quiere NestJS para este backend.
- No meter Kubernetes en esta etapa.
- No guardar secretos reales en el repo.
- No cambiar el stack principal sin confirmacion: Node + Express + MongoDB + Angular separado.
- Documentar toda deuda nueva en este archivo si se agrega comportamiento parcial.
- Si se modifica una API usada por el frontend, actualizar tambien `AI_MEMORY.md` del frontend.

## Actualizacion 2026-06-06 - Beta guests/templates/assets/payments

- Invitados ahora tienen DTO/allowlist en alta manual e importacion.
- `GET /api/guests/event/:eventId` verifica ownership del evento antes de listar.
- Importacion CSV/XLSX valida evento propio, extension soportada y devuelve `{ imported, invalidRows, guests }`.
- Templates tienen DTO en creacion admin y seed inicial con `npm run seed:templates`.
- Assets validan `fileName`, `contentType`, `folder` y `size`; si S3 no esta configurado responden `501 AWS_S3_BUCKET no configurado`.
- Checkout valida DTO y ownership de invitacion antes de crear sesion; webhook evita reprocesar pagos ya `paid`.

## Actualizacion 2026-06-06 - Nodemailer SMTP

- Se eligio Nodemailer SMTP para emails transaccionales por ahora, en lugar de Resend, para reutilizar el enfoque conocido de AllFitness y evitar crear otra cuenta.
- `nodemailer` quedo instalado como dependencia.
- Se agrego `src/services/emailService.js` como servicio central de correo.
- Se agrego `POST /api/contact` con validacion Zod para `{ name, email, message }`.
- El correo usa `EMAIL_FROM` como remitente del sistema y `replyTo` con el email del visitante. No usar `from: email` del visitante para evitar spoofing/rechazos SMTP.
- Variables soportadas: `SMTP_SERVICE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `EMAIL_TO`.
- Tambien se soportan aliases legacy de AllFitness: `emailAddress` y `emailPssw`.
- Si SMTP no esta configurado, el servicio responde `501 SMTP no configurado`.
- `RESEND_API_KEY` queda como legado opcional; no se usa en el flujo activo.

Siguientes pasos de email:

1. Probar `POST /api/contact` con las credenciales SMTP reales.
2. Implementar password reset real con token y email.
3. Agregar emails de RSVP/publicacion cuando el flujo de invitaciones este mas cerrado.
