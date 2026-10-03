# Runbook: WhatsApp con pase PNG por OpenWA

## Resultado validado

- Número autorizado para pruebas: `2727088143` (normalizado como `522727088143`).
- Invitado usado: `6abef2f8431aaaa5eb03307b`.
- El pase enviado es el mismo PNG generado por la acción **Descargar pase**.
- Envío real confirmado por OpenWA con `messageId`:
  `true_78335992406143@lid_3EB08077A2911433C0713E`.
- Tamaño validado de la imagen: `272665` bytes.
- Log confirmado: `6abffe930a904f0024a9cd4e`.

## Causa del error 500

La versión instalada de `whatsapp-web.js` tenía dos incompatibilidades con WhatsApp Web:

1. `MediaData.__x_id` podía sobrescribir el identificador de salida del mensaje multimedia.
2. Algunos identificadores serializados cambiaron de `_serialized` a `$1`.

OpenWA incluye un parche de build que conserva el ID del mensaje y acepta ambos nombres. El adaptador exige un `messageId` real; una respuesta HTTP exitosa sin ID no se registra como envío confirmado.

Archivos relevantes del repositorio OpenWA:

- `scripts/patch-whatsapp-webjs-media-id.js`
- `scripts/docker-entrypoint.sh`
- `src/engine/adapters/whatsapp-web-js.adapter.ts`
- `Dockerfile`

## Comandos de recuperación y prueba

```powershell
# En OpenWA
docker compose up -d --build

# En Invitaciones-BackendExpress: prueba segura/idempotente
npm run test:whatsapp-pass:live -- --guest=6abef2f8431aaaa5eb03307b --send

# Reenvío real intencional
npm run test:whatsapp-pass:live -- --guest=6abef2f8431aaaa5eb03307b --send --resend
```

Sin `--resend`, el test reutiliza el log confirmado, sincroniza el estado del invitado y no manda una segunda copia.

## Comportamiento esperado en frontend

- Estado del proveedor: `WhatsApp OpenWA: listo`.
- Acción automática: **Auto + pase**.
- Alternativa manual: **Abrir WA** (solo texto y enlace).
- El switch **Adjuntar Pase VIP** persiste por evento en el navegador.
- Los envíos confirmados muestran **Aceptado por OpenWA** y no se seleccionan otra vez automáticamente.
- **Reenviar pase** permite una nueva copia de forma explícita.
- Límite operativo: 30 destinatarios con imagen por lote.

## Verificación mínima

```powershell
npm run check
npm run test:whatsapp-pass
npm run test:whatsapp
```

En frontend:

```powershell
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```
