const slugify = require('slugify');
const env = require('../config/env');

const GEMINI_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-pro-latest'
];

async function callGeminiApi(prompt, systemInstruction = '') {
  const apiKey = env.geminiApiKey;
  if (!apiKey) {
    throw new Error('La clave GEMINI_API_KEY no está configurada en el servidor.');
  }

  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      };

      if (systemInstruction) {
        body.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Gemini API (${model}) status ${response.status}: ${errorText.slice(0, 150)}`);
        lastError = new Error(`Gemini API (${model}) error: ${response.statusText} (${errorText.slice(0, 120)})`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Gemini API no devolvió texto en candidates.');
      }

      return { text: rawText, modelUsed: model };
    } catch (err) {
      lastError = err;
      console.warn(`Error llamando modelo ${model}: ${err.message}`);
    }
  }

  throw lastError || new Error('No se pudo conectar con los modelos de Gemini.');
}

async function callOpenAiApi(prompt, systemInstruction = '') {
  const apiKey = env.openaiApiKey;
  const model = env.openaiModel || 'gpt-4o';
  if (!apiKey) {
    throw new Error('La clave OPENAI_API_KEY no está configurada.');
  }

  const url = 'https://api.openai.com/v1/chat/completions';
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API (${model}) status ${response.status}: ${errorText.slice(0, 150)}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('OpenAI API no devolvió contenido.');
  }

  return { text: rawText, modelUsed: model };
}

async function callAiApi(prompt, systemInstruction = '') {
  let lastError = null;

  if (env.openaiApiKey) {
    try {
      console.log(`Intentando llamada a OpenAI API (${env.openaiModel || 'gpt-4o'})...`);
      return await callOpenAiApi(prompt, systemInstruction);
    } catch (err) {
      console.warn(`Error llamando OpenAI (${env.openaiModel || 'gpt-4o'}): ${err.message}. Probando fallback a Gemini...`);
      lastError = err;
    }
  }

  if (env.geminiApiKey) {
    try {
      console.log('Intentando llamada a Gemini API...');
      return await callGeminiApi(prompt, systemInstruction);
    } catch (err) {
      console.warn(`Error llamando Gemini API: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('No hay claves de API válidas para OpenAI ni Gemini.');
}

const SYSTEM_INSTRUCTION = `
Desarrolla una página web interactiva completa en HTML5, CSS3 y JavaScript nativo para una invitación digital de evento (Boda, XV Años, Graduación, Aniversario, Bautizo, Cumpleaños).

REGLA FUNDAMENTAL DE MANEJO DE VARIABLES Y ENDPOINTS EN JAVASCRIPT:
- NUNCA insertes texto literal como "\${slug}" sin haber definido previamente la variable en JavaScript.
- En el código JavaScript de la plantilla web generada, DEBES declarar obligatoriamente al inicio la constante EVENT_SLUG usando el slug real provisto en el prompt, con fallback dinámico:
  const EVENT_SLUG = window.EVENT_SLUG || 'SLUG_DEL_EVENTO' || window.location.pathname.split('/').filter(Boolean).pop();
- En todos los llamados fetch() asíncronos a los endpoints del backend, utiliza siempre esa variable EVENT_SLUG.
- URL Base: Usa rutas relativas (ej. \`/api/invitations/public/\${EVENT_SLUG}\`) o \`\${window.location.origin}/api/...\` para compatibilidad local y en producción.

DOCUMENTACIÓN TÉCNICA DEL ENDPOINT PRINCIPAL Y ESPECIFICACIÓN DE DATOS:
La invitación se alimenta y consume la API REST del backend (Invitaciones-Backend) a través del endpoint principal:
- Método: GET /api/invitations/public/\${EVENT_SLUG}

ESTRUCTURA DEL PAYLOAD JSON (GET /api/invitations/public/:slug):
{
  "invitation": {
    "id": "string (ID único en MongoDB)",
    "slug": "string (slug amigable de la invitación)",
    "status": "published",
    "accessMode": "open | guest_list | specific_users",
    "publishedAt": "ISO Date String",
    "event": {
      "id": "string",
      "type": "boda | xv | graduacion | cumpleanos | bautizo",
      "title": "string (Título principal del evento)",
      "hosts": ["string (Nombres de anfitriones o festejados)"],
      "date": "ISO Date String (Fecha y hora oficial de inicio del evento, clave para countdown)",
      "venue": {
        "name": "string (Nombre del lugar)",
        "address": "string (Dirección completa)",
        "coordinates": { "lat": number, "lng": number }
      },
      "agenda": [
        { "time": "HH:MM", "title": "string", "description": "string" }
      ]
    },
    "template": {
      "id": "string",
      "name": "string",
      "eventType": "string",
      "tier": "free | premium",
      "previewImageUrl": "string URL",
      "config": { "primaryFont": "string", "bodyFont": "string" }
    },
    "rsvpSettings": {
      "deadline": "ISO Date String (Fecha límite para confirmar)",
      "allowMaybe": boolean,
      "allowChangesUntilDeadline": boolean,
      "declineRequiresConfirmation": boolean,
      "reminderDaysBeforeDeadline": number,
      "identityMethods": ["email", "phone"],
      "allowCompanionsDefault": boolean,
      "defaultAllowedCompanions": number,
      "maxAttendees": number,
      "customQuestions": [
        { "key": "string", "label": "string", "type": "text | textarea | select | boolean", "required": boolean, "options": ["string"] }
      ]
    },
    "content": {
      "headline": "string (Título de bienvenida / encabezado)",
      "subheadline": "string (Subtítulo o lema)",
      "message": "string (Mensaje emotivo de los anfitriones)",
      "coverImageUrl": "string URL (Banner o foto principal)",
      "palette": { "primary": "hexColor", "secondary": "hexColor", "accent": "hexColor" },
      "musicUrl": "string URL (Audio principal de fondo)",
      "sectionMusic": { "hero": "url", "story": "url", "[sectionKey]": "url" },
      "brandLogoUrl": "string URL",
      "hideBranding": boolean,
      "sectionSettings": {
        "story": boolean,
        "locations": boolean,
        "itinerary": boolean,
        "dressCode": boolean,
        "rsvp": boolean,
        "giftRegistry": boolean,
        "digitalEnvelope": boolean,
        "lodging": boolean,
        "gallery": boolean,
        "guestAlbum": boolean,
        "dedications": boolean
      },
      "gallery": ["string URL (Fotos de galería oficial)"],
      "itinerary": [
        { "time": "HH:MM", "title": "string", "description": "string" }
      ],
      "locations": [
        {
          "type": "string (Ceremonia, Recepción, etc.)",
          "name": "string",
          "address": "string",
          "mapUrl": "string URL (Google Maps)",
          "wazeUrl": "string URL (Waze)",
          "notes": "string"
        }
      ],
      "dressCode": "string (Descripción de etiqueta: Formal, Guayabera, Black Tie, etc.)",
      "giftRegistry": [
        { "store": "string", "title": "string", "label": "string", "url": "string URL", "imageUrl": "string URL", "note": "string", "priority": number }
      ],
      "digitalEnvelope": {
        "bank": "string",
        "account": "string",
        "clabe": "string",
        "holder": "string",
        "note": "string",
        "qrImageUrl": "string URL"
      },
      "giftSettings": {
        "enabled": boolean,
        "showRegistry": boolean,
        "showEnvelope": boolean,
        "introText": "string"
      },
      "lodging": [
        { "name": "string", "description": "string", "url": "string URL" }
      ],
      "dedicationSettings": {
        "enabled": boolean,
        "requireApproval": boolean,
        "introText": "string"
      }
    }
  }
}

ENDPOINTS INTERACTIVOS ADICIONALES DEL SISTEMA (MÓDULOS DE ACCIÓN):
1. Álbum Interactivo de Fotos de Invitados ('guestAlbum'):
   - Consultar fotos aprobadas: GET /api/invitations/public/\${EVENT_SLUG}/album -> Devuelve { "photos": [{ "_id", "photoUrl", "uploaderName", "caption", "createdAt" }] }
   - Subir nueva foto: POST /api/invitations/public/\${EVENT_SLUG}/album-upload -> Enviar multipart/form-data con los campos 'file' (imagen obligatoria), 'uploaderName' (opcional) y 'caption' (opcional).
2. Galería Oficial de Fotos ('gallery'):
   - Fotos destacadas obtenidas del array 'content.gallery' en GET /api/invitations/public/\${EVENT_SLUG}.
3. Dedicatorias y Libro de Firmas Digital ('dedications'):
   - Consultar dedicatorias aprobadas: GET /api/invitations/public/\${EVENT_SLUG}/dedications -> Devuelve { "dedications": [{ "_id", "publicName", "message", "type", "createdAt" }] }
   - Publicar dedicatoria: POST /api/invitations/public/\${EVENT_SLUG}/dedications -> Enviar JSON: { "publicName": string, "email": string (opcional), "message": string, "type": "wish" | "dedication" | "memory" | "toast", "visibility": "public" }.
4. Confirmación de Asistencia ('rsvp'):
   - Consultar configuración RSVP: GET /api/rsvp/public/\${EVENT_SLUG}
   - Enviar confirmación: POST /api/rsvp/public/\${EVENT_SLUG} -> Enviar JSON: { "name": string, "email": string, "phone": string, "status": "confirmed" | "declined" | "maybe", "adults": number, "children": number, "companionNames": [string], "answers": [{ "questionKey": string, "answer": any }], "note": string }.
5. Pedir Canciones al DJ / Música ('songRequests'):
   - Enviar sugerencia de canción: POST /api/external/\${EVENT_SLUG}/song-requests -> Enviar JSON: { "title": string, "artist": string, "dedication": string, "requesterName": string }.
6. Música de Fondo ('backgroundMusic'):
   - Reproductor flotante con botón interactivo (Play / Pausa) y barras de sonido animadas usando 'content.musicUrl'.
7. Cuenta Regresiva ('countdown'):
   - Temporizador dinámico en vivo calculado con JavaScript nativo en base a 'event.date' (Días, Horas, Minutos, Segundos).

REGLAS DE DISEÑO Y ESTRUCTURA:
- Devuelve HTML5 semántico y CSS3 moderno completo, 100% responsive para pantallas de móvil, tablet y desktop.
- Los scripts en JavaScript nativo deben manejar los formularios, las peticiones fetch de forma asíncrona, alertas/retroalimentación visual al usuario y las animaciones interactivas.

FORMATO DE RESPUESTA JSON OBLIGATORIO:
Responde únicamente con un objeto JSON válido estructurado exactamente así:
{
  "name": "Nombre creativo de la plantilla",
  "description": "Descripción de la experiencia digital",
  "html": "<!DOCTYPE html><html lang=\\"es\\">...</html>",
  "css": "/* Código CSS moderno completo */",
  "features": ["Lista de características principales"]
}
`;

function attachModelInfo(templateObj, modelUsed) {
  if (!templateObj || typeof templateObj !== 'object') return templateObj;
  templateObj.modelUsed = modelUsed;

  if (!Array.isArray(templateObj.features)) {
    templateObj.features = [];
  }
  if (!templateObj.features.some(f => typeof f === 'string' && f.toLowerCase().includes('modelo'))) {
    templateObj.features.push(`Modelo IA: ${modelUsed}`);
  }

  if (templateObj.html && typeof templateObj.html === 'string' && !templateObj.html.includes('<!-- Modelo IA:')) {
    templateObj.html += `\n<!-- Modelo IA utilizado: ${modelUsed} -->`;
  }

  return templateObj;
}

exports.getPromptPreview = function ({ event, invitation, style, palette, vibe, sections, customPrompt }) {
  const eventTitle = event?.title || 'Boda Sofía & Alejandro';
  const eventType = event?.type || 'boda';
  const eventDate = event?.date || '2026-11-20T18:00:00.000Z';
  const eventVenue = event?.venue?.name || event?.venue?.address || 'Hacienda Los Laureles, Salón Principal';
  const eventSlug = invitation?.slug || event?.externalPortalSlug || event?.slug || (event?.title ? slugify(event.title, { lower: true, strict: true }) : 'invitacion-digital-especial');
  const primaryColor = palette?.primary || '#1c2434';
  const secondaryColor = palette?.secondary || '#f8f5f0';
  const accentColor = palette?.accent || '#c59b6c';

  const sectionsList = (sections && sections.length)
    ? sections.join(', ')
    : '';

  const userPrompt = `El usuario solicita la creación de la siguiente plantilla web de invitación en específico:

1. DATOS REALES DEL EVENTO:
- Título del Evento: "${eventTitle}"
- Tipo de Evento: "${eventType}"
- Fecha y Hora Oficial: "${eventDate}"
- Slug Oficial del Evento (EVENT_SLUG): "${eventSlug}"

2. PETICIÓN Y PREFERENCIAS ESPECÍFICAS DEL USUARIO:
- Petición / Prompt Libre del Usuario: "${customPrompt || ''}"
- Estilo Visual Deseado: ${style || ''}
- Atmósfera / Vibra: ${vibe || ''}
- Paleta de Colores: Primario: ${primaryColor}, Secundario: ${secondaryColor}, Acento: ${accentColor}
- Secciones Solicitadas: ${sectionsList || 'Todas las secciones requeridas'}

3. INDICACIÓN DE INTEGRACIÓN DE ENDPOINTS REALES:
- En el código JavaScript de la plantilla generada, define obligatoriamente al inicio:
  const EVENT_SLUG = window.EVENT_SLUG || '${eventSlug}' || window.location.pathname.split('/').filter(Boolean).pop();
- Usa esa constante EVENT_SLUG en todas las peticiones fetch a la API del backend:
  * GET /api/invitations/public/\${EVENT_SLUG} (para cargar datos dinámicos del evento, anfitriones, itinerario, etc.)
  * POST /api/invitations/public/\${EVENT_SLUG}/album-upload (para subir fotos al álbum de invitados)
  * GET / POST /api/invitations/public/\${EVENT_SLUG}/dedications (para consultar y enviar dedicatorias)
  * GET / POST /api/rsvp/public/\${EVENT_SLUG} (para consultar configuración y enviar confirmaciones RSVP)
  * POST /api/external/\${EVENT_SLUG}/song-requests (para sugerir canciones al DJ)
- Incluye ÚNICAMENTE los módulos y llamadas fetch correspondientes a las secciones solicitadas (${sectionsList || 'todas las secciones requeridas'}).

Genera el código HTML y CSS completo respetando la petición específica del usuario.`;

  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt
  };
};

exports.generateTemplateFromPrompt = async function ({ event, invitation, style, palette, vibe, sections, customPrompt }) {
  const { systemInstruction, userPrompt } = exports.getPromptPreview({ event, invitation, style, palette, vibe, sections, customPrompt });

  console.log('\n================================================================');
  console.log('🔍 [INSPECCIÓN DE MENSAJE] PAYLOAD QUE SE ENVIARÁ A LA IA:');
  console.log('--- 1. CONTEXTO TÉCNICO & SYSTEM INSTRUCTION ---');
  console.log(systemInstruction);
  console.log('--- 2. SOLICITUD ESPECÍFICA DEL USUARIO ---');
  console.log(userPrompt);
  console.log('================================================================\n');

  try {
    const { text: rawJson, modelUsed } = await callAiApi(userPrompt, systemInstruction);
    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      const cleaned = rawJson.replace(/^```json/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    }
    const result = attachModelInfo(parsed, modelUsed);
    result.compiledPrompt = { systemInstruction, userPrompt };
    return result;
  } catch (apiError) {
    console.error('Error generando plantilla con la IA:', apiError.message);
    throw new Error(`Error en la generación con IA: ${apiError.message}`);
  }
};

exports.refineTemplate = async function ({ currentHtml, currentCss, userFeedback, event, invitation }) {
  const eventSlug = invitation?.slug || event?.externalPortalSlug || event?.slug || (event?.title ? slugify(event.title, { lower: true, strict: true }) : 'invitacion-digital-especial');
  const prompt = `
Tienes la siguiente plantilla web de invitación para el evento con slug oficial "${eventSlug}":

CÓDIGO HTML ACTUAL:
${currentHtml}

CÓDIGO CSS ACTUAL:
${currentCss}

SOLICITUD DE REFINAMIENTO DEL USUARIO:
"${userFeedback}"

REGLAS DE REFINAMIENTO:
- Aplica las modificaciones solicitadas manteniendo la coherencia del diseño, el funcionamiento de los scripts y la interactividad.
- Asegúrate de que las llamadas fetch utilicen la variable EVENT_SLUG (con valor "${eventSlug}") y nunca un literal "\${slug}" sin definir.
- Devuelve el JSON actualizado con { name, description, html, css, features }.
`;

  try {
    const { text: rawJson, modelUsed } = await callAiApi(prompt, SYSTEM_INSTRUCTION);
    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      const cleaned = rawJson.replace(/^```json/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    }
    return attachModelInfo(parsed, modelUsed);
  } catch (apiError) {
    console.error('Error refinando plantilla con la IA:', apiError.message);
    throw new Error(`Error en el refinamiento con IA: ${apiError.message}`);
  }
};
