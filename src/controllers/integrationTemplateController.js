const IntegrationTemplate = require('../models/IntegrationTemplate');
const asyncHandler = require('../utils/asyncHandler');
const { requireEventAccess } = require('../utils/eventAccess');
const env = require('../config/env');

const MODULE_GUIDES = {
  event: { label: 'datos y contenido del evento', endpoint: 'GET /config', widget: 'full-details' },
  rsvp: { label: 'identificación de invitado y confirmación RSVP', endpoint: 'POST /guest/identify, GET /my-status y POST /rsvp', widget: 'rsvp' },
  guestPass: { label: 'pase personalizado y código QR', endpoint: 'POST /guest/identify y GET /my-status', widget: 'guest-pass' },
  gallery: { label: 'galería pública aprobada', endpoint: 'GET /album', widget: 'gallery' },
  album: { label: 'álbum colaborativo y subida de fotografías', endpoint: 'GET /album y POST /album (multipart/form-data)', widget: 'album' },
  map: { label: 'ubicaciones, mapas y cómo llegar', endpoint: 'GET /config', widget: 'map' },
  songRequests: { label: 'búsqueda y solicitudes de canciones al DJ', endpoint: 'POST /song-lookup y POST /song-requests', widget: 'song-requests' },
  gifts: { label: 'mesa de regalos y sobre digital', endpoint: 'GET /gifts', widget: 'gifts' },
  dedications: { label: 'muro y envío de dedicatorias', endpoint: 'GET /dedications y POST /dedications', widget: 'dedications' }
};

function serialize(template) {
  return {
    id: template._id,
    name: template.name,
    description: template.description || '',
    mode: template.mode,
    stack: template.stack,
    modules: template.modules || [],
    instructions: template.instructions || '',
    version: template.version || 1,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt
  };
}

function cleanConfiguration(body) {
  return {
    mode: body.mode || 'mixed',
    stack: body.stack || 'html',
    modules: Array.from(new Set(body.modules?.length ? body.modules : ['event', 'rsvp'])),
    instructions: String(body.instructions || '').trim()
  };
}

function buildPrompt({ event, configuration, apiBaseUrl, frontendBaseUrl }) {
  const slug = event.externalPortalSlug;
  const eventApi = `${apiBaseUrl.replace(/\/$/, '')}/external/${slug}`;
  const frontend = frontendBaseUrl.replace(/\/$/, '');
  const portalUrl = `${frontend}/new/e/${slug}`;
  const modeLabel = {
    widgets: 'widgets iframe de KyndraSoft',
    api: 'API REST directa con una interfaz completamente personalizada',
    mixed: 'una integración mixta: API REST para contenido y widgets para formularios complejos'
  }[configuration.mode];
  const stackLabel = {
    html: 'HTML, CSS y JavaScript',
    react: 'React',
    next: 'Next.js',
    angular: 'Angular',
    vue: 'Vue',
    wordpress: 'WordPress',
    webflow: 'Webflow',
    other: 'la tecnología existente del proyecto'
  }[configuration.stack];
  const moduleLines = configuration.modules.map((key) => {
    const item = MODULE_GUIDES[key];
    return item
      ? `- ${item.label}: ${item.endpoint}. Widget disponible: ${frontend}/new/embed/${slug}/${item.widget}`
      : '';
  }).filter(Boolean);
  const tokenInstructions = configuration.mode === 'widgets'
    ? 'Los widgets no requieren incluir un token administrativo en el navegador.'
    : 'Los endpoints públicos sanitizados se consumen sin token. Usa KYNDRASOFT_INTEGRATION_TOKEN solo en operaciones servidor a servidor; nunca lo envíes al navegador ni lo escribas en HTML, JavaScript público o repositorios.';

  return `Actúa como desarrollador senior e integra KyndraSoft en la página externa de este evento.

CONTEXTO REAL
- Evento: ${event.title}
- Tipo: ${event.type}
- Portal slug: ${slug}
- API base del evento: ${eventApi}
- Portal KyndraSoft de respaldo: ${portalUrl}
- Tecnología: ${stackLabel}
- Modalidad: ${modeLabel}

OBJETIVO
Construye una experiencia responsiva, accesible y lista para producción. Conserva el diseño visual de la página del cliente y usa KyndraSoft como backend operativo. No inventes endpoints, campos ni estados.

MÓDULOS SOLICITADOS
${moduleLines.join('\n')}

FLUJO OBLIGATORIO
1. Carga GET ${eventApi}/config y renderiza solamente las secciones y funciones habilitadas en la respuesta.
2. Para acciones personalizadas del invitado, solicita email o teléfono y llama POST ${eventApi}/guest/identify.
3. Guarda guestSessionToken durante la sesión y envíalo como Authorization: Bearer <guestSessionToken> en /my-status y en las operaciones que lo requieran.
4. Refresca /my-status periódicamente cuando muestres estados de RSVP, fotos, canciones o dedicatorias.
5. Implementa estados visibles de carga, vacío, éxito, validación y error.
6. Valida límites de acompañantes, tipos y tamaños de archivo antes de enviar.
7. No expongas owner, pagos, datos de otros invitados, tokens de terceros ni credenciales administrativas.
8. Usa variables de entorno para URLs y credenciales. ${tokenInstructions}
9. Prueba el resultado en móvil, tablet y escritorio.

MANIFIESTO Y CONTRATOS
- Widgets y snippets: GET ${eventApi}/embed-manifest
- Configuración pública: GET ${eventApi}/config
- Recursos multimedia: GET ${eventApi}/assets?type=all
- Verificación opcional del token de integración: GET ${eventApi}/integration-token/status
- Header alternativo permitido: X-Kyndra-Access-Token: <token>

INSTRUCCIONES ADICIONALES DEL CLIENTE
${configuration.instructions || 'No hay instrucciones adicionales.'}

ENTREGA ESPERADA
- Código completo por archivos, sin pseudocódigo.
- Una lista breve de variables de entorno necesarias.
- Instrucciones para ejecutar y probar.
- Manejo de CORS y errores HTTP.
- No continúes con supuestos si el contrato real de /config contradice este texto; usa siempre la respuesta real de la API.`;
}

exports.list = asyncHandler(async (req, res) => {
  const templates = await IntegrationTemplate.find({ owner: req.user._id }).sort('-updatedAt');
  res.json({ templates: templates.map(serialize) });
});

exports.create = asyncHandler(async (req, res) => {
  const configuration = cleanConfiguration(req.validated.body);
  const template = await IntegrationTemplate.create({
    owner: req.user._id,
    name: req.validated.body.name,
    description: req.validated.body.description || '',
    ...configuration
  });
  res.status(201).json({ template: serialize(template) });
});

exports.update = asyncHandler(async (req, res) => {
  const template = await IntegrationTemplate.findOne({ _id: req.params.id, owner: req.user._id });
  if (!template) {
    const error = new Error('Plantilla de integración no encontrada');
    error.statusCode = 404;
    throw error;
  }
  Object.assign(template, req.validated.body);
  await template.save();
  res.json({ template: serialize(template) });
});

exports.remove = asyncHandler(async (req, res) => {
  const deleted = await IntegrationTemplate.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!deleted) {
    const error = new Error('Plantilla de integración no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ message: 'Plantilla de integración eliminada' });
});

exports.preview = asyncHandler(async (req, res) => {
  const { event } = await requireEventAccess({
    eventId: req.validated.body.eventId,
    user: req.user,
    permission: 'view_event',
    select: 'title type mode externalPortalSlug externalPortalEnabled'
  });
  if (event.mode !== 'external_dashboard' || !event.externalPortalSlug) {
    const error = new Error('El evento debe estar configurado como dashboard externo y tener un portal activo');
    error.statusCode = 400;
    throw error;
  }

  let source = req.validated.body;
  if (req.validated.body.templateId) {
    const template = await IntegrationTemplate.findOne({ _id: req.validated.body.templateId, owner: req.user._id });
    if (!template) {
      const error = new Error('Plantilla de integración no encontrada');
      error.statusCode = 404;
      throw error;
    }
    source = { ...template.toObject(), ...req.validated.body };
  }

  const configuration = cleanConfiguration(source);
  const apiBaseUrl = env.apiPublicBaseUrl || `${req.protocol}://${req.get('host')}/api`;
  res.json({
    prompt: buildPrompt({ event, configuration, apiBaseUrl, frontendBaseUrl: env.clientUrl }),
    configuration,
    event: { id: event._id, title: event.title, portalSlug: event.externalPortalSlug },
    security: { includesSecrets: false, integrationTokenPlaceholder: 'KYNDRASOFT_INTEGRATION_TOKEN' }
  });
});
