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
  - Password reset real con token hasheado, expiracion y envio por Nodemailer SMTP.
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
  - Soporta `accessMode`: `open` para RSVP libre y `guest_list` para RSVP restringido a invitados.
- Invitados:
  - Listar invitados por evento.
  - Crear invitado.
  - Importar invitados desde CSV/XLSX.
- RSVP:
  - Enviar RSVP publico por slug con DTO validado.
  - Si el RSVP publico incluye `guest`, valida que el invitado pertenezca al mismo evento de la invitacion publicada antes de actualizar su estado.
  - Si la invitacion usa `guest_list`, exige invitado registrado por `guest` o email y rechaza no autorizados con `403`.
  - Soporta respuestas `confirmed`, `declined` y `maybe`.
  - Evita respuestas duplicadas por invitado o email normalizado; actualiza la respuesta existente si la configuracion lo permite.
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
POST   /api/invitations/public/:slug/guest-access

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
- `accessMode` controla RSVP publico:
  - `open`: cualquiera con link puede responder; si el email coincide con un invitado, se vincula.
  - `guest_list`: solo invitados del evento pueden responder; se valida por `guest` o email.
- `rsvpSettings` controla fecha limite, cambios, opcion `maybe`, confirmacion al declinar y dias antes para recordatorio.

## Que sigue parcial o inicial

- Emails transaccionales: ya usan Nodemailer SMTP; siguen siendo best-effort y con contenido simple.
- S3: ya genera presigned URL y el frontend persiste URLs en `Invitation.content`; falta metadata formal de assets, limites por plan y borrado.
- Invitaciones antiguas sin `accessMode` se tratan como `open` para no romper links existentes; el frontend crea nuevas invitaciones como `guest_list`.
- Stripe: checkout y webhook son iniciales; falta robustecer ownership, estados, idempotencia y desbloqueo granular de features premium.
- Dashboard: metricas basicas, sin series temporales, filtros por evento ni analitica avanzada.
- Plantillas: modelo, endpoint y seed inicial existen; falta versionado de configuraciones.
- WhatsApp Business API: esta fuera del MVP actual.

## Que falta

- Cerrar permisos y ownership:
  - Verificar que checkout no acepte invitaciones ajenas.
  - Verificar ownership en importacion/listado de invitados por evento.
- Reemplazar updates con `req.body` directo por allowlists/DTOs en los modulos restantes.
- Aplicar validacion Zod a todos los endpoints mutantes.
- Implementar delete/archivar donde aplique.
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
4. Completar metadata/limpieza de assets S3 si se requiere administrarlos.
5. Robustecer Stripe y control de premium.
6. Preparar despliegue beta con variables seguras, Mongo administrado y CORS/SMTP/S3 documentados.

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

## Actualizacion 2026-06-06 - Password reset real y emails transaccionales

- Password reset dejo de ser simulado:
  - `POST /api/auth/password-reset` valida `{ email }`, genera token seguro, guarda hash SHA-256 y expiracion de 1 hora en `User`.
  - `POST /api/auth/password-reset/confirm` valida `{ token, password }`, actualiza `passwordHash` y limpia los campos de reset.
  - La solicitud responde siempre `Si el email existe, se enviara un enlace de recuperacion.` para no enumerar usuarios.
- `User` ahora incluye `passwordResetTokenHash` y `passwordResetExpiresAt`.
- Se agrego `FRONTEND_URL` para construir links de recuperacion hacia `/password-reset/confirm?token=...`; si no existe, usa `CLIENT_URL` y luego `http://localhost:4200`.
- `emailService` ahora tambien envia:
  - email de recuperacion de password,
  - notificacion al owner cuando llega un RSVP publico,
  - aviso al owner cuando una invitacion se publica.
- Los emails de RSVP/publicacion son best-effort: si SMTP falla o no esta configurado, solo se registra `console.warn` y no se rompe la accion principal.
- `sendMail` ya no requiere `EMAIL_TO` cuando se pasa un destinatario explicito; contacto sigue requiriendo destinatario por default.

Siguientes pasos:

1. Probar reset completo con SMTP real: solicitar, abrir enlace, confirmar password nuevo y login.
2. Probar RSVP/publicacion con SMTP real y revisar que no se expongan secretos en logs.

## Actualizacion 2026-06-06 - QA beta RSVP, SMTP y S3

- RSVP publico ahora intenta vincular automaticamente por email si el payload no trae `guest`:
  - busca `Guest` del mismo evento con el email enviado,
  - guarda `rsvp.guest` cuando hay match,
  - actualiza `Guest.status` a `confirmed` o `declined`.
- La creacion de `Rsvp` se mantiene siempre para conservar `companions`, `mealPreference` y `message`.
- Password reset mantiene respuesta generica publica, pero el backend ahora registra detalles SMTP utiles sin secretos: email destino, code, command, responseCode y message.
- Se agrego `npm run test:smtp` para probar Nodemailer con la misma configuracion SMTP. Usa `SMTP_TEST_TO`, `EMAIL_TO` o `SMTP_USER` como destinatario.
- Assets S3 ahora registran fallos al generar presigned URL con bucket/region/codigo sin exponer credenciales y devuelven mensaje claro si falla firma/configuracion.

Notas QA:

- Si `POST /api/assets/upload-url` responde OK pero el `PUT` a S3 falla desde frontend, revisar CORS del bucket y permisos `s3:PutObject`.
- Si password reset responde generico pero no llega correo, correr `npm run test:smtp` y revisar logs del backend.

## Actualizacion 2026-06-06 - Reglas RSVP y respuesta unica

- `Invitation` ahora incluye `rsvpSettings`:
  - `deadline`,
  - `allowMaybe`,
  - `allowChangesUntilDeadline`,
  - `declineRequiresConfirmation`,
  - `reminderDaysBeforeDeadline`.
- `Rsvp.response` acepta `confirmed`, `declined` y `maybe`.
- `Rsvp` guarda `emailNormalized` para deduplicar respuestas abiertas por email.
- `POST /api/rsvps/public/:slug`:
  - exige email en modo `open`,
  - busca respuesta existente por `guest` o `emailNormalized`,
  - actualiza la misma respuesta si cambios estan permitidos y no vencio deadline,
  - responde `409` si ya existe respuesta y no puede cambiarse,
  - guarda `companions=0` y limpia comida para `declined`/`maybe`,
  - mantiene `Guest.status=pending` cuando la respuesta es `maybe`.
- Se agrego `npm run reminders:rsvp` para enviar recordatorios SMTP a invitados pendientes y RSVPs `maybe` dentro de la ventana previa al deadline.

## Actualizacion 2026-06-06 - Telefono internacional para RSVP

- `Rsvp` ahora guarda telefono opcional preparado para WhatsApp:
  - `phoneCountryCode` como `+52`,
  - `phoneNationalNumber`,
  - `phoneE164`,
  - `phoneVerified`,
  - `phoneVerificationStatus`.
- `POST /api/rsvps/public/:slug` valida codigo de pais con `+` y 1-4 digitos, y numero nacional solo numerico.
- Si se envia telefono, backend normaliza `phoneE164 = phoneCountryCode + phoneNationalNumber`.
- Se agrego modelo `RsvpActivity` para historial inicial de actividades RSVP, incluyendo snapshots con telefono.
- Todavia no se envia WhatsApp; solo queda preparada la data para integrarlo despues.

## Actualizacion 2026-06-07 - Duplicados y edicion de invitados

- `Guest` ahora valida duplicados por `email` o `phone` dentro del mismo evento/owner.
- `POST /api/guests` responde `409` con `details.field`, `details.guestId` y `details.guestName` si el contacto ya existe.
- Se agrego `PATCH /api/guests/:id` para editar nombre, email, telefono, grupo y acompanantes sin permitir duplicados contra otros invitados del evento.
- Importacion CSV/XLSX ahora importa filas validas y omite duplicadas; responde `duplicateRows` y `duplicates` con fila, campo, valor y nombre del invitado existente.
