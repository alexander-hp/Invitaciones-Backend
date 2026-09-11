const slugify = require('slugify');
const env = require('../config/env');

const GEMINI_MODELS = [
  env.geminiModel,
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-3.1-pro-preview',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-pro-latest'
].filter(Boolean);

// Eliminar duplicados manteniendo el orden
const UNIQUE_GEMINI_MODELS = Array.from(new Set(GEMINI_MODELS));

const SYSTEM_INSTRUCTION = `
Eres un Diseñador Web y Desarrollador Frontend de Élite especializado en eventos de alta gama (Bodas de Lujo, XV Años Exclusivos, Galas, Graduaciones, Aniversarios y Eventos Corporativos).

Tu misión es recibir las especificaciones de un evento (nombres, fechas, paleta, ubicaciones, módulos activos, etc.) y generar una invitación web completa, moderna, lujosa y 100% funcional en formato HTML5 + CSS3 + JavaScript nativo (Vanilla JS) standalone.

══════════════════════════════════════════════════════════════════════════
💎 REGLAS DE ORO INQUEBRANTABLES
══════════════════════════════════════════════════════════════════════════

1. CERO EMOJIS — SOLO ICONOS VECTORIALES SVG:
   - Está TERMINANTEMENTE PROHIBIDO usar emojis (❌ 💍, 📍, 🎵, 📅, ✨, ⚠️, 👤, 🥂, 🎉, 💌, etc.) en cualquier texto, botón, título, badge o detalle.
   - Cada icono debe ser un <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">...</svg> limpio, estilizado, elegante y escalable (estilo Lucide/Heroicons).

2. CERO COLORES DUROS HARDCODEADOS:
   - Todo el diseño visual debe basarse y derivarse estrictamente de las variables CSS de la paleta en :root:
     * --primary: Color primario (texto principal, botones base, fondos oscuros).
     * --secondary: Color secundario / fondo suave.
     * --accent: Color de acento (dorado, cobre, oro rosa o tono metálico).
     * --theme-bg: Fondo principal del tema.
     * --theme-primary: Color primario semántico.
     * --theme-accent: Color de acento semántico.
     * --theme-card-bg: Fondo de tarjetas (blanco o translúcido glassmorphism).
     * --theme-card-inner: Fondo interior sutil de tarjetas.
     * --theme-border: Borde de acento o división con opacidad.
     * --theme-border-subtle: Borde sutil.
     * --theme-text-main: Color de texto principal.
     * --theme-text-muted: Color de texto secundario/atenuado.
     * --theme-shadow-sm, --theme-shadow-md, --theme-shadow-lg: Sombras de elevación multinivel.

3. VALIDACIÓN Y ACCESO VIP / GUEST PASS:
   - Para eventos privados o con lista de invitados, la página cuenta con una Tarjeta de Validación VIP.
   - Permite validar al invitado con su correo electrónico o teléfono mediante el endpoint POST /api/invitations/public/\${EVENT_SLUG}/guest-access.
   - Al validarse, se desbloquea una Tarjeta de Pase VIP Oficial con asignación de Mesa (tableName), Asiento (seatLabel), Pases permitidos (allowedCompanions + 1) y Código QR dinámico o código de check-in (checkInCode).
   - Las secciones interactivas tienen estados protegidos elegantes con botón para interactuar o subir al validador VIP.

4. MOBILE-FIRST & ULTRA RESPONSIVE:
   - La inmensa mayoría de los invitados abrirán la invitación desde su smartphone (WhatsApp, Instagram). El diseño debe ser perfecto desde pantallas móviles pequeñas (360px) hasta monitores 4K.

5. MICRO-INTERACCIONES Y EFECTOS LUXURY:
   - Aplicar Glassmorphism (backdrop-filter: blur(12px), background: rgba(...)), gradientes lineales suaves, bordes dorados tenues, sombras sutiles multicapa y transiciones fluidas con curvas cúbicas (cubic-bezier(0.16, 1, 0.3, 1)).

6. PROHIBICIÓN ESTRICTA DE ARCHIVOS EXTERNOS LOCALES:
   - ❌ NUNCA incluyas <link rel="stylesheet" href="styles.css"> ni enlaces a hojas de estilo externas que no existan. Todo el CSS debe estar en la propiedad "css" del JSON devuelto.
   - ❌ NUNCA incluyas <script src="script.js"></script> ni enlaces a scripts externos no disponibles. Todo el código JavaScript funcional DEBE estar completamente escrito dentro de la etiqueta <script>...</script> en el HTML generado.

══════════════════════════════════════════════════════════════════════════
📐 ESTRUCTURA NARRATIVA Y JERARQUÍA DE SECCIONES RECOMENDADA
══════════════════════════════════════════════════════════════════════════

1. HERO PORTADA DE IMPACTO:
   - Monograma/Logo SVG + Título principal + Subtítulo emotivo + Fecha oficial.
   - Cuenta Regresiva (Countdown Regresivo de Cristal) dinámico calculado en vivo con JavaScript (Días, Horas, Minutos, Segundos).
   - Acciones rápidas: Guardar en Google Calendar & Compartir / Confirmar vía WhatsApp.
2. PORTAL DE ACCESO VIP / PASE CONFIRMADO:
   - Formulario de validación de invitado por email/teléfono.
   - Vista de Pase VIP Oficial con Código QR, número de mesa, asiento y botón para descargar/imprimir pase o guardar comprobante.
3. NUESTRA HISTORIA & MENSAJE DE BIENVENIDA:
   - Carta o dedicatoria de los anfitriones con tipografía editorial de lujo.
4. UBICACIONES & CÓMO LLEGAR (Ceremonia y Fiesta / Recepción):
   - Tarjetas elegantes con nombre del lugar, dirección, notas/horario y botones directos a Google Maps y Waze con iconos SVG.
5. ITINERARIO DE LA CELEBRACIÓN:
   - Línea de tiempo vertical con horas, títulos y SVGs temáticos de cada momento.
6. CÓDIGO DE VESTIMENTA (DRESS CODE):
   - Tipo de etiqueta (Formal, Rigurosa Etiqueta, Guayabera de Gala, Cocktail, etc.), paleta recomendada o colores reservados (ej. blanco para la novia) con badges visuales.
7. CONFIRMACIÓN DE ASISTENCIA (RSVP):
   - Formulario interactivo con selección de asistencia (Asistiré / No podré asistir / Tal vez), acompañantes, selección de menú/alergias y mensaje a los novios.
8. MESA DE REGALOS & SOBRE DIGITAL:
   - Enlaces a tiendas departamentales (Liverpool, Amazon, etc.).
   - Datos bancarios (Banco, Titular, Cuenta, CLABE) con botón de copiado en 1 clic que brinde feedback visual (toast / texto copiado) y soporte para QR de transferencia si existe.
9. HOSPEDAJE RECOMENDADO:
   - Tarjetas de hoteles cercanos con tarifas especiales / códigos de descuento y enlaces directos.
10. GALERÍA DE RECUERDOS (FOTOS ANFITRIONES):
    - Grid de fotografías con modal Lightbox interactivo para ampliar imágenes en pantalla completa.
11. ZONA INTERACTIVA DE INVITADOS:
    - Álbum colectivo de fotos (subida interactiva de fotos por invitados).
    - Muro de dedicatorias & deseos (lectura y publicación de mensajes en tiempo real).
    - Peticiones de música al DJ con buscador y formulario de sugerencia de canciones.
12. REPRODUCTOR DE MÚSICA DE FONDO FLOTANTE:
    - Botón flotante de audio con animación de ondas de sonido, soporte de autoplay amigable al primer toque y control de volumen/silencio.
13. PIE DE PÁGINA & CIERRE:
    - Despedida emotiva, monograma final y créditos discretos.

══════════════════════════════════════════════════════════════════════════
🔌 PROTOCOLO DE INTEROPERABILIDAD (IFRAME BRIDGE & STANDALONE)
══════════════════════════════════════════════════════════════════════════

Para que la página funcione tanto como archivo HTML independiente en cualquier navegador como dentro del iframe de la plataforma SaaS (KyndraSoft), incluye la función global de comunicación:

function dispatchInvitationEvent(type, payload) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type, payload, timestamp: Date.now() }, '*');
  }
}

Eventos soportados:
- INV_SUBMIT_RSVP: { name, email, response, companions, menu, message }
- INV_CHECK_GUEST: { email, phone }
- INV_SUBMIT_DEDICATION: { publicName, message, type }
- INV_TOGGLE_MUSIC: {}

══════════════════════════════════════════════════════════════════════════
⚡ REGLAS FUNDAMENTALES DE INTEGRACIÓN CON ENDPOINTS DEL BACKEND
══════════════════════════════════════════════════════════════════════════

1. DEFINICIÓN DE SLUG Y URL BASE EN JAVASCRIPT:
   - Al inicio del script, declara obligatoriamente:
     const EVENT_SLUG = window.EVENT_SLUG || 'SLUG_DEL_EVENTO' || window.location.pathname.split('/').filter(Boolean).pop();
   - NUNCA uses la variable literal "\${slug}" sin haberla definido previamente.
   - Las rutas a la API deben ser relativas (ej. \`/api/invitations/public/\${EVENT_SLUG}\`) o construidas sobre \`\${window.location.origin}\`.

2. ENDPOINTS PRINCIPALES Y MÓDULOS DE ACCIÓN:
   a) Datos públicos del evento:
      GET /api/invitations/public/\${EVENT_SLUG}
   b) Validación de Invitados y Pase VIP:
      POST /api/invitations/public/\${EVENT_SLUG}/guest-access
      Body JSON: { "email": string, "phone": string }
      Respuesta: { "guest": { "id", "name", "email", "group", "roles", "allowedCompanions", "status", "checkInCode", "qrCode", "tableName", "seatLabel", "companions" } }
   c) Confirmación de Asistencia (RSVP):
      POST /api/rsvps/public/\${EVENT_SLUG}
      Body JSON: {
        "name": string,
        "email": string (opcional),
        "phone": string (opcional),
        "response": "confirmed" | "declined" | "maybe",
        "companions": number,
        "companionNames": string[],
        "customAnswers": [{ "key": string, "label": string, "value": string | number | boolean }] (opcional, para las preguntas en rsvpSettings.customQuestions si existen),
        "message": string (opcional)
      }
   d) Álbum de Fotos de Invitados:
      - Consultar fotos aprobadas: GET /api/invitations/public/\${EVENT_SLUG}/album -> { "photos": [{ "_id", "photoUrl", "uploaderName", "caption", "createdAt" }] }
      - Subir foto: POST /api/invitations/public/\${EVENT_SLUG}/album-upload -> multipart/form-data con campos 'file' (obligatorio), 'uploaderName' (opcional) y 'caption' (opcional).
   e) Dedicatorias y Libro de Firmas:
      - Consultar: GET /api/invitations/public/\${EVENT_SLUG}/dedications -> { "dedications": [{ "_id", "publicName", "message", "type", "createdAt" }] }
      - Publicar: POST /api/invitations/public/\${EVENT_SLUG}/dedications -> Body JSON: { "publicName": string, "email": string (opcional), "message": string, "type": "wish" | "dedication" | "memory" | "toast", "visibility": "public" }
   f) Peticiones de Música al DJ:
      - Consultar canciones: GET /api/invitations/public/\${EVENT_SLUG}/song-requests -> { "songRequests": [...] }
      - Enviar petición: POST /api/invitations/public/\${EVENT_SLUG}/song-requests -> Body JSON: { "title": string, "artist": string, "dedication": string, "requesterName": string }

3. EXPERIENCIA DE USUARIO Y RETROALIMENTACIÓN:
   - Todo formulario debe incluir estados de carga (botones con spinner SVG / texto 'Enviando...').
   - Mostrar notificaciones Toast o banners elegantes flotantes acordes al diseño con mensajes de éxito o error amigables sin recargar la página.

══════════════════════════════════════════════════════════════════════════
📦 FORMATO DE RESPUESTA JSON OBLIGATORIO
══════════════════════════════════════════════════════════════════════════
Responde ÚNICAMENTE con un objeto JSON válido (sin texto antes ni después) con la siguiente estructura:
{
  "name": "Nombre creativo y exclusivo de la plantilla",
  "description": "Descripción de la experiencia digital generada",
  "html": "<!DOCTYPE html><html lang=\\"es\\">...</html>",
  "css": "/* Código CSS completo derivado de tokens :root y reglas responsivas */",
  "features": ["Lista de características destacadas y módulos incluidos"]
}
`;

function parseAiJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Respuesta vacía o inválida recibida del modelo de IA.');
  }

  const text = rawText.trim();

  // 1. Intento directo de JSON.parse
  try {
    return JSON.parse(text);
  } catch (e1) {
    // 2. Limpiar delimitadores markdown ```json ... ```
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      // 3. Buscar el primer '{' y el último '}'
      const firstOpen = text.indexOf('{');
      const lastClose = text.lastIndexOf('}');
      if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        const extracted = text.substring(firstOpen, lastClose + 1);
        try {
          return JSON.parse(extracted);
        } catch (e3) {
          throw new Error(`Error analizando JSON extraído: ${e3.message}. Contenido: ${extracted.slice(0, 100)}...`);
        }
      }
      throw new Error(`No se pudo interpretar la respuesta como JSON: ${e2.message}`);
    }
  }
}

async function callGeminiApi(prompt, systemInstruction = '') {
  const apiKey = env.geminiApiKey;
  if (!apiKey) {
    throw new Error('La clave GEMINI_API_KEY no está configurada en el servidor.');
  }

  let lastError = null;
  for (const model of UNIQUE_GEMINI_MODELS) {
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
        throw new Error(`Gemini API (${model}) no devolvió texto en candidates.`);
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
      temperature: 0.7,
      max_tokens: 8192
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

  // 1. Priorizar Gemini API si la API Key está configurada
  if (env.geminiApiKey) {
    try {
      console.log('Intentando llamada a Gemini API...');
      return await callGeminiApi(prompt, systemInstruction);
    } catch (err) {
      console.warn(`Error llamando Gemini API: ${err.message}. Probando fallback a OpenAI...`);
      lastError = err;
    }
  }

  // 2. Fallback a OpenAI API si Gemini falla o no tiene key
  if (env.openaiApiKey) {
    try {
      console.log(`Intentando llamada a OpenAI API (${env.openaiModel || 'gpt-4o'})...`);
      return await callOpenAiApi(prompt, systemInstruction);
    } catch (err) {
      console.warn(`Error llamando OpenAI (${env.openaiModel || 'gpt-4o'}): ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('No hay claves de API válidas para Gemini ni OpenAI.');
}

function buildEventPayload({ event, invitation, style, palette, vibe, sections, customPrompt }) {
  const content = invitation?.content || {};
  const eventData = event || {};

  const title = eventData.title || content.headline || 'Nuestra Boda de Ensueño';
  const type = eventData.type || 'boda';
  const date = eventData.date
    ? new Date(eventData.date).toISOString()
    : (invitation?.publishedAt ? new Date(invitation.publishedAt).toISOString() : '2026-11-21T18:00:00.000Z');
  const headline = content.headline || eventData.title || 'Sofía & Alejandro';
  const subheadline = content.subheadline || content.storyTitle || '¡Nos Casamos!';
  const story = content.message || content.storyBody || eventData.externalPortalSettings?.welcomeMessage || 'Con gran alegría y emoción, los invitamos a celebrar el día más importante de nuestras vidas rodeados de quienes más queremos.';
  const dressCode = content.dressCode || 'Rigurosa Etiqueta / Black Tie';
  const coverImageUrl = content.coverImageUrl || eventData.externalContent?.coverImageUrl || 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600';
  const brandLogoUrl = content.brandLogoUrl || '';
  const musicUrl = content.musicUrl || eventData.externalContent?.musicUrl || '';

  // Palette
  const primary = palette?.primary || content.palette?.primary || '#1c2434';
  const secondary = palette?.secondary || content.palette?.secondary || '#f8f5f0';
  const accent = palette?.accent || content.palette?.accent || '#c59b6c';

  // Locations
  const locations = (content.locations && content.locations.length)
    ? content.locations
    : (eventData.externalContent?.locations && eventData.externalContent.locations.length)
      ? eventData.externalContent.locations
      : [
          {
            type: 'Ceremonia Religiosa',
            name: eventData.venue?.name || 'Parroquia Nuestra Señora de Guadalupe',
            address: eventData.venue?.address || 'Av. Vallarta 1234, Col. Americana, Guadalajara, Jal.',
            notes: 'Favor de llegar 15 minutos antes. Hay servicio de valet parking.',
            mapUrl: eventData.venue?.mapUrl || 'https://maps.google.com/?q=20.674,-103.365',
            wazeUrl: 'https://waze.com/ul?ll=20.674,-103.365&navigate=yes'
          },
          {
            type: 'Recepción & Fiesta',
            name: 'Hacienda San José del Refugio',
            address: 'Camino Real a Colima 500, Tlajomulco, Jal.',
            notes: 'Recepción y cóctel de bienvenida a partir de las 20:00 hrs.',
            mapUrl: 'https://maps.google.com/?q=20.520,-103.450',
            wazeUrl: 'https://waze.com/ul?ll=20.520,-103.450&navigate=yes'
          }
        ];

  // Itinerary
  const itinerary = (content.itinerary && content.itinerary.length)
    ? content.itinerary
    : (eventData.agenda && eventData.agenda.length)
      ? eventData.agenda
      : [
          { time: '18:00 hrs', title: 'Misa y Ceremonia', description: 'Intercambio de votos y bendición de argollas en la Parroquia.' },
          { time: '19:30 hrs', title: 'Cóctel de Bienvenida', description: 'Música acústica y bebidas de cortesía en los jardines.' },
          { time: '21:00 hrs', title: 'Banquete & Cena de Gala', description: 'Menú especial de 4 tiempos y brindis de honor.' },
          { time: '23:00 hrs', title: 'Vals & Apertura de Pista', description: '¡Que comience la fiesta con el DJ!' }
        ];

  // Gifts
  const gifts = {
    introText: content.giftSettings?.introText || eventData.externalContent?.giftSettings?.introText || 'Tu presencia es nuestro mayor regalo. Si deseas hacernos un detalle, ponemos a tu disposición nuestras opciones:',
    registries: (content.giftRegistry && content.giftRegistry.length)
      ? content.giftRegistry
      : (eventData.externalContent?.giftRegistry && eventData.externalContent.giftRegistry.length)
        ? eventData.externalContent.giftRegistry
        : [
            { title: 'Liverpool', url: 'https://www.liverpool.com.mx', note: 'Evento No. 50493821' },
            { title: 'Amazon México', url: 'https://www.amazon.com.mx', note: 'Mesa de regalos Sofía & Ale' }
          ],
    envelope: (content.digitalEnvelope && (content.digitalEnvelope.bank || content.digitalEnvelope.clabe || content.digitalEnvelope.account))
      ? content.digitalEnvelope
      : (eventData.externalContent?.digitalEnvelope && (eventData.externalContent.digitalEnvelope.bank || eventData.externalContent.digitalEnvelope.clabe))
        ? eventData.externalContent.digitalEnvelope
        : {
            bank: 'BBVA México',
            holder: (eventData.hosts && eventData.hosts.length) ? eventData.hosts.join(' & ') : 'Sofía Martínez & Alejandro Pérez',
            account: '1234567890',
            clabe: '012345678901234567',
            note: 'Para transferencias electrónicas o lluvia de sobres.'
          }
  };

  // Lodging
  const lodging = (content.lodging && content.lodging.length)
    ? content.lodging
    : [
        {
          name: 'Hotel Quinta Real Guadalajara',
          description: 'Tarifa preferencial para invitados mencionando el código BODA-SOFIA-ALE.',
          url: 'https://hotel.com'
        }
      ];

  // Gallery
  const gallery = (content.gallery && content.gallery.length)
    ? content.gallery
    : [
        'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
        'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800',
        'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800',
        'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800'
      ];

  return {
    event: {
      title,
      type,
      date,
      headline,
      subheadline,
      story,
      dressCode,
      coverImageUrl,
      brandLogoUrl,
      musicUrl,
      hosts: eventData.hosts || []
    },
    palette: {
      primary,
      secondary,
      accent
    },
    locations,
    itinerary,
    gifts,
    lodging,
    gallery,
    rsvpSettings: invitation?.rsvpSettings || eventData.externalContent?.rsvpSettings || {
      deadline: '2026-11-01T23:59:59.000Z',
      allowMaybe: true,
      allowCompanionsDefault: true,
      defaultAllowedCompanions: 1
    },
    sectionsRequested: (sections && sections.length) ? sections : [
      'hero', 'vipAccess', 'story', 'locations', 'itinerary',
      'dressCode', 'rsvp', 'gifts', 'lodging', 'gallery',
      'guestAlbum', 'dedications', 'songRequests', 'backgroundMusic'
    ]
  };
}

function normalizeAiTemplateResult(templateObj, modelUsed) {
  if (!templateObj || typeof templateObj !== 'object') {
    templateObj = {};
  }

  let html = typeof templateObj.html === 'string' ? templateObj.html.trim() : '';
  let css = typeof templateObj.css === 'string' ? templateObj.css.trim() : '';

  // 1. Limpiar enlaces a archivos externos ficticios generados por la IA
  html = html
    .replace(/<link\b[^>]*href=["'][^"']*styles?\.css["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*href=["'][^"']*\.css["'][^>]*rel=["']stylesheet["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*src=["'][^"']*scripts?\.js["'][^>]*>\s*<\/script>/gi, '')
    .replace(/<script\b[^>]*src=["'][^"']*\.js["'][^>]*>\s*<\/script>/gi, '');

  // 2. Si el CSS vino dentro de <style> en el HTML y el campo css está vacío, extraerlo
  if (!css && html.includes('<style')) {
    const match = html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i);
    if (match && match[1]) {
      css = match[1].trim();
    }
  }

  templateObj.html = html;
  templateObj.css = css;
  templateObj.modelUsed = modelUsed;

  if (!Array.isArray(templateObj.features)) {
    templateObj.features = [];
  }
  if (!templateObj.features.some(f => typeof f === 'string' && f.toLowerCase().includes('modelo'))) {
    templateObj.features.push(`Modelo IA: ${modelUsed}`);
  }

  return templateObj;
}

exports.getPromptPreview = function ({ event, invitation, style, palette, vibe, sections, customPrompt }) {
  const eventSlug = invitation?.slug || event?.externalPortalSlug || event?.slug || (event?.title ? slugify(event.title, { lower: true, strict: true }) : 'invitacion-digital-especial');
  const payloadData = buildEventPayload({ event, invitation, style, palette, vibe, sections, customPrompt });
  const sectionsList = (sections && sections.length) ? sections.join(', ') : 'Todas las secciones de la Guía Maestra';

  const userPrompt = `
[ESPECIFICACIÓN DEL EVENTO Y DATOS DE ENTRADA]
Genera una plantilla web interactiva completa (HTML5 + CSS3 + JavaScript Standalone) de ultra lujo para el siguiente evento con sus datos y preferencias específicas:

1. PREFERENCIAS Y ESTILO SOLICITADO:
- Petición / Prompt libre del usuario: "${customPrompt || 'Diseño de ultra lujo, elegante y completamente funcional'}"
- Estilo Visual: ${style || 'Luxury Glassmorphism & Editorial Moderno'}
- Atmósfera / Vibra: ${vibe || 'Exclusiva, Romántica y Sofisticada'}
- Secciones Requeridas: ${sectionsList}
- Paleta de Colores: Primario: ${payloadData.palette.primary}, Secundario: ${payloadData.palette.secondary}, Acento: ${payloadData.palette.accent}

2. DATOS REALES DEL EVENTO (JSON_DATA):
${JSON.stringify(payloadData, null, 2)}

3. REGLAS CRÍTICAS DE INTEGRACIÓN EN EL CÓDIGO GENERADO:
- Slug Oficial del Evento (EVENT_SLUG): "${eventSlug}". Declara al inicio del <script>:
  const EVENT_SLUG = window.EVENT_SLUG || '${eventSlug}' || window.location.pathname.split('/').filter(Boolean).pop();
- Utiliza la constante EVENT_SLUG en todas las peticiones fetch() a los endpoints reales:
  * GET /api/invitations/public/\${EVENT_SLUG} (Datos oficiales del evento)
  * POST /api/invitations/public/\${EVENT_SLUG}/guest-access (Validación VIP con email o teléfono)
  * POST /api/rsvps/public/\${EVENT_SLUG} (Confirmación de asistencia RSVP)
  * GET /api/invitations/public/\${EVENT_SLUG}/album y POST /album-upload (Álbum interactivo de fotos)
  * GET /api/invitations/public/\${EVENT_SLUG}/dedications y POST /dedications (Muro de dedicatorias)
  * POST /api/invitations/public/\${EVENT_SLUG}/song-requests (Petición de canciones al DJ)
- Respeta estrictamente las Reglas de Oro:
  * CERO EMOJIS: Usa exclusivamente iconos SVG vectoriales estilizados inline.
  * CERO COLORES HARDCODEADOS: Deriva todo el CSS de las variables semánticas de :root (--primary, --secondary, --accent, etc.).
  * VALIDACIÓN & PASE VIP: Incluye Tarjeta de Validación VIP y Tarjeta de Pase VIP Oficial con Código QR dinámico (con campos mesa, asiento y pases).
  * PROTOCOLO INTEROPERABILIDAD: Incluye la función global dispatchInvitationEvent(type, payload).
  * MOBILE-FIRST & RESPONSIVE: Diseño impecable de 360px a 4K con Glassmorphism y microinteracciones de lujo.
  * NO USAR ARCHIVOS EXTERNOS: No enlaces <link rel="stylesheet" href="styles.css"> ni <script src="script.js">. Todo el código CSS va en "css" y los scripts van directamente dentro de <script>...</script> en el HTML.

Genera el código HTML y CSS completo respetando estas especificaciones y devuelve ÚNICAMENTE el JSON estructurado.`;

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
    const parsed = parseAiJsonResponse(rawJson);
    const result = normalizeAiTemplateResult(parsed, modelUsed);
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
- Cumple estrictamente con las Reglas de Oro: CERO EMOJIS (solo iconos SVG inline), CERO COLORES HARDCODEADOS (usar variables CSS :root), Validaciones VIP, Iframe Bridge y Mobile-first.
- NO enlaces a archivos externos styles.css ni script.js.
- Asegúrate de que las llamadas fetch utilicen la constante EVENT_SLUG (con valor "${eventSlug}") y nunca un literal "\${slug}" sin definir.
- Devuelve el JSON actualizado estructurado exactamente con { name, description, html, css, features }.
`;

  try {
    const { text: rawJson, modelUsed } = await callAiApi(prompt, SYSTEM_INSTRUCTION);
    const parsed = parseAiJsonResponse(rawJson);
    return normalizeAiTemplateResult(parsed, modelUsed);
  } catch (apiError) {
    console.error('Error refinando plantilla con la IA:', apiError.message);
    throw new Error(`Error en el refinamiento con IA: ${apiError.message}`);
  }
};


