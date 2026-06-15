# Demo Dashboard Externo KyndraSoft

## Comando

```powershell
npm run demo:external
```

El script usa `DEMO_API_URL` y `DEMO_CLIENT_URL` si estan definidos. Defaults:

- API: `http://localhost:4000/api`
- Frontend: `http://localhost:4200`

## Credenciales demo

- Email: `external.demo@kyndrasoft.local`
- Password: `KyndraDemo2026!`

## Invitado demo

- Email: `hdezppalex@gmail.com`
- Telefono: `2727088143`
- Acompanantes: `2`
- Roles: `vip`, `familia`

## Flujo que prueba

1. Crea o actualiza el usuario demo.
2. Crea o reutiliza el evento `KyndraSoft Demo Dashboard Externo`.
3. Activa `external_dashboard_12m` por 12 meses.
4. Sube imagenes y audio con:
   - `POST /api/assets/upload-url`
   - `PUT uploadUrl`
5. Guarda las URLs publicas en `Event.externalContent`.
6. Crea o actualiza el invitado demo.
7. Imprime:
   - URL dashboard del evento.
   - URL portal KyndraSoft.
   - URL demo widgets.
   - URL demo API directa.
   - URLs API `config` y `assets`.

## Paginas de prueba

- Widgets iframe:
  `http://localhost:4200/assets/external-demo-widgets.html?portal=<portalSlug>`

- API directa:
  `http://localhost:4200/assets/external-demo-api.html?portal=<portalSlug>`

## Pruebas manuales esperadas

- En widgets, confirmar que se ven imagenes subidas, audio y iframes de RSVP, pase, album, DJ y portal completo.
- En API directa, identificar al invitado `hdezppalex@gmail.com`.
- Enviar RSVP `confirmed` con 2 acompanantes.
- Solicitar cancion al DJ.
- Subir una foto al album.
- Revisar en dashboard que RSVP, cancion y album se reflejan.
