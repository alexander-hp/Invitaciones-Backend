const VisualDesignTemplate = require('../models/VisualDesignTemplate');
const SystemSetting = require('../models/SystemSetting');
const asyncHandler = require('../utils/asyncHandler');

// ═══ SEED TEMPLATES FOR MARKETPLACE ═══
const SEED_TEMPLATES = [
  {
    name: 'Villa L’Orangerie · Atelier',
    authorName: 'Velisse Studio · Oficial',
    eventType: 'boda',
    category: 'boda',
    description: 'Fresco italiano, cipreses nocturnos, arcos barrocos en oro viejo, sello de lacre, pase VIP de gala y pantalla de bienvenida.',
    previewImageUrl: 'assets/templates/palazzo-orangerie/garden-portrait.webp',
    thumbnailUrl: 'assets/templates/palazzo-orangerie/garden-portrait.webp',
    isPublic: true,
    status: 'featured',
    authorRewardPercent: 5,
    includesInvitation: true,
    includesPass: true,
    includesAccess: true,
    usageCount: 238,
    tags: ['Boda', 'Argon', 'Oro Viejo', 'Elegante', 'Pase VIP'],
    design: {
      version: 1,
      active: true,
      mode: 'easy',
      presentationMode: 'continuous',
      responsiveMode: 'shared',
      theme: {
        backgroundColor: '#152820',
        textColor: '#f6efe2',
        accentColor: '#c89b3c',
        headingFont: "'Cinzel Decorative', serif",
        bodyFont: 'Montserrat, sans-serif',
        buttonBackgroundColor: '#c89b3c',
        buttonTextColor: '#152820',
        buttonStyle: 'solid',
        buttonRadius: 28
      },
      sections: [
        {
          id: 'sec-hero-1',
          type: 'custom',
          title: 'Portada Villa L’Orangerie',
          enabled: true,
          layout: 'canvas',
          height: 780,
          background: { color: '#152820', overlay: 0 },
          layers: [
            {
              id: 'l-badge',
              type: 'text',
              text: '★ NUESTRA BODA ★',
              x: 10, y: 12, width: 80, height: 5, zIndex: 1,
              style: { color: '#c89b3c', fontSize: 13, fontWeight: 700, letterSpacing: 3, textAlign: 'center' }
            },
            {
              id: 'l-title',
              type: 'text',
              text: '{{event.title}}',
              x: 6, y: 18, width: 88, height: 14, zIndex: 2,
              style: { color: '#f6efe2', fontSize: 36, fontWeight: 700, fontFamily: "'Cinzel Decorative', serif", textAlign: 'center' }
            },
            {
              id: 'l-sub',
              type: 'text',
              text: 'Queremos celebrar nuestro amor y compartir contigo un día inolvidable',
              x: 10, y: 34, width: 80, height: 7, zIndex: 3,
              style: { color: 'rgba(246, 239, 226, 0.85)', fontSize: 15, fontFamily: 'Montserrat, sans-serif', textAlign: 'center' }
            },
            {
              id: 'l-btn',
              type: 'button',
              text: 'Confirmar Asistencia',
              x: 20, y: 46, width: 60, height: 7, zIndex: 4,
              binding: 'section:rsvp',
              style: { backgroundColor: '#c89b3c', color: '#152820', borderRadius: 28, fontSize: 14, fontWeight: 700 }
            }
          ]
        }
      ]
    },
    passDesign: {
      sections: [
        {
          id: 'sheet-pass-1',
          title: 'Hoja 1 (Frente)',
          layout: 'canvas',
          height: 800,
          pluginSettings: { sheetWidth: 450, sheetHeight: 800 },
          background: { color: '#152820' },
          layers: [
            {
              id: 'p-frame',
              type: 'shape',
              text: 'Marco de Oro',
              x: 5, y: 3, width: 90, height: 94, zIndex: 1,
              style: { borderColor: '#c89b3c', borderWidth: 1.5, borderRadius: 24, backgroundColor: 'rgba(200, 155, 60, 0.05)', shapeKind: 'rounded' }
            },
            {
              id: 'p-badge',
              type: 'text',
              text: '★ PASE DE ACCESO VIP ★',
              x: 10, y: 7, width: 80, height: 4, zIndex: 2,
              style: { color: '#c89b3c', fontSize: 12, fontWeight: 700, textAlign: 'center', letterSpacing: 2 }
            },
            {
              id: 'p-title',
              type: 'text',
              text: '{{event.title}}',
              x: 8, y: 12, width: 84, height: 8, zIndex: 3,
              style: { color: '#f6efe2', fontSize: 24, fontWeight: 700, fontFamily: "'Cinzel Decorative', serif", textAlign: 'center' }
            },
            {
              id: 'p-qr-bg',
              type: 'shape',
              text: 'Fondo QR',
              x: 25, y: 27, width: 50, height: 28, zIndex: 4,
              style: { backgroundColor: '#ffffff', borderRadius: 16, shapeKind: 'rounded' }
            },
            {
              id: 'p-qr',
              type: 'image',
              text: 'Código QR',
              x: 28, y: 29, width: 44, height: 24, zIndex: 5,
              binding: 'pass.qrCode',
              url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=VIP-ACCESO-DEMO'
            },
            {
              id: 'p-guest',
              type: 'text',
              text: '{{guest.name}}',
              x: 8, y: 62, width: 84, height: 6, zIndex: 6,
              style: { color: '#ffffff', fontSize: 22, fontWeight: 800, textAlign: 'center' }
            },
            {
              id: 'p-meta',
              type: 'text',
              text: 'Mesa: {{guest.table}}  ·  {{guest.companions}} pases',
              x: 10, y: 69, width: 80, height: 5, zIndex: 7,
              style: { color: '#c89b3c', fontSize: 14, fontWeight: 600, textAlign: 'center' }
            }
          ]
        }
      ]
    },
    accessScreen: {
      enabled: true,
      title: 'Invitación de Gala',
      subtitle: 'Ingresa tu correo o teléfono registrado para acceder a tu invitación y pase VIP.',
      cardStyle: 'glass',
      cardBgColor: '#152820',
      cardOpacity: 90,
      cardRadius: 20,
      primaryColor: '#c89b3c',
      textColor: '#f6efe2',
      buttonBgColor: '#c89b3c',
      buttonTextColor: '#152820',
      headingFont: "'Cinzel Decorative', serif"
    }
  },
  {
    name: 'Mis XV Borgoña Real',
    authorName: 'Camila Designs · Creadora VIP',
    eventType: 'xv',
    category: 'xv',
    description: 'Terciopelo borgoña profundo, perlas, rosas 3D, caligrafía Great Vibes y tarjeta de pase con código QR personalizado.',
    previewImageUrl: 'assets/templates/xv-burgundy/portrait.jpg',
    thumbnailUrl: 'assets/templates/xv-burgundy/portrait.jpg',
    isPublic: true,
    status: 'featured',
    authorRewardPercent: 5,
    includesInvitation: true,
    includesPass: true,
    includesAccess: true,
    usageCount: 184,
    tags: ['XV Años', 'Borgoña', 'Princesa', 'Gala', 'Pase VIP'],
    design: {
      version: 1,
      active: true,
      mode: 'easy',
      presentationMode: 'continuous',
      responsiveMode: 'shared',
      theme: {
        backgroundColor: '#5c0d18',
        textColor: '#faf6f0',
        accentColor: '#d4af37',
        headingFont: "'Great Vibes', cursive",
        bodyFont: 'Montserrat, sans-serif',
        buttonBackgroundColor: '#d4af37',
        buttonTextColor: '#480a13',
        buttonStyle: 'solid',
        buttonRadius: 24
      },
      sections: [
        {
          id: 'sec-xv-1',
          type: 'custom',
          title: 'Mis Quince Años',
          enabled: true,
          layout: 'canvas',
          height: 780,
          background: { color: '#5c0d18' },
          layers: [
            {
              id: 'l-xv-badge',
              type: 'text',
              text: '👑 MIS XV AÑOS 👑',
              x: 10, y: 14, width: 80, height: 5, zIndex: 1,
              style: { color: '#d4af37', fontSize: 13, fontWeight: 700, letterSpacing: 3, textAlign: 'center' }
            },
            {
              id: 'l-xv-title',
              type: 'text',
              text: '{{event.title}}',
              x: 6, y: 20, width: 88, height: 16, zIndex: 2,
              style: { color: '#faf6f0', fontSize: 44, fontWeight: 600, fontFamily: "'Great Vibes', cursive", textAlign: 'center' }
            },
            {
              id: 'l-xv-btn',
              type: 'button',
              text: 'Ver Pases y Confirmar',
              x: 20, y: 44, width: 60, height: 7, zIndex: 3,
              binding: 'section:rsvp',
              style: { backgroundColor: '#d4af37', color: '#480a13', borderRadius: 24, fontSize: 14, fontWeight: 700 }
            }
          ]
        }
      ]
    },
    passDesign: {
      sections: [
        {
          id: 'sheet-pass-xv',
          title: 'Pase XV Años',
          layout: 'canvas',
          height: 800,
          pluginSettings: { sheetWidth: 450, sheetHeight: 800 },
          background: { color: '#5c0d18' },
          layers: [
            {
              id: 'p-xv-frame',
              type: 'shape',
              text: 'Marco Borgoña',
              x: 5, y: 3, width: 90, height: 94, zIndex: 1,
              style: { borderColor: '#d4af37', borderWidth: 1.5, borderRadius: 24, backgroundColor: 'rgba(212, 175, 55, 0.06)', shapeKind: 'rounded' }
            },
            {
              id: 'p-xv-badge',
              type: 'text',
              text: '✨ ENTRADA VIP EXCLUSIVA ✨',
              x: 10, y: 7, width: 80, height: 4, zIndex: 2,
              style: { color: '#d4af37', fontSize: 12, fontWeight: 700, textAlign: 'center' }
            },
            {
              id: 'p-xv-title',
              type: 'text',
              text: '{{event.title}}',
              x: 8, y: 12, width: 84, height: 10, zIndex: 3,
              style: { color: '#faf6f0', fontSize: 32, fontFamily: "'Great Vibes', cursive", textAlign: 'center' }
            },
            {
              id: 'p-xv-qr-bg',
              type: 'shape',
              text: 'Fondo QR',
              x: 25, y: 27, width: 50, height: 28, zIndex: 4,
              style: { backgroundColor: '#ffffff', borderRadius: 16, shapeKind: 'rounded' }
            },
            {
              id: 'p-xv-qr',
              type: 'image',
              text: 'QR Acceso',
              x: 28, y: 29, width: 44, height: 24, zIndex: 5,
              binding: 'pass.qrCode',
              url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=VIP-ACCESO-DEMO'
            },
            {
              id: 'p-xv-guest',
              type: 'text',
              text: '{{guest.name}}',
              x: 8, y: 62, width: 84, height: 6, zIndex: 6,
              style: { color: '#ffffff', fontSize: 22, fontWeight: 800, textAlign: 'center' }
            },
            {
              id: 'p-xv-meta',
              type: 'text',
              text: 'Mesa: {{guest.table}}  ·  {{guest.companions}} pases autorizados',
              x: 10, y: 69, width: 80, height: 5, zIndex: 7,
              style: { color: '#d4af37', fontSize: 14, fontWeight: 600, textAlign: 'center' }
            }
          ]
        }
      ]
    },
    accessScreen: {
      enabled: true,
      title: 'Recepción XV Años',
      subtitle: 'Valida tu entrada personal con tu NIP o número registrado.',
      cardStyle: 'glass',
      cardBgColor: '#5c0d18',
      cardOpacity: 92,
      cardRadius: 24,
      primaryColor: '#d4af37',
      textColor: '#faf6f0',
      buttonBgColor: '#d4af37',
      buttonTextColor: '#480a13',
      headingFont: "'Great Vibes', cursive"
    }
  },
  {
    name: 'Bautizo & Baby Shower Celestial',
    authorName: 'Ana Sofía · Creadora Destacada',
    eventType: 'bautizo',
    category: 'bautizo',
    description: 'Tonos pasteles suaves, tipografía tierna, icono de angelito/bebé, código QR de acceso y confirmación digital.',
    previewImageUrl: 'assets/templates/palazzo-orangerie/villa-painting.png',
    thumbnailUrl: 'assets/templates/palazzo-orangerie/villa-painting.png',
    isPublic: true,
    status: 'featured',
    authorRewardPercent: 5,
    includesInvitation: true,
    includesPass: true,
    includesAccess: true,
    usageCount: 112,
    tags: ['Bautizo', 'Baby Shower', 'Celestial', 'Pastel', 'Pase VIP'],
    design: {
      version: 1,
      active: true,
      mode: 'easy',
      presentationMode: 'continuous',
      responsiveMode: 'shared',
      theme: {
        backgroundColor: '#f5f8fa',
        textColor: '#2c3e50',
        accentColor: '#6da0c7',
        headingFont: "'Playfair Display', serif",
        bodyFont: 'Montserrat, sans-serif',
        buttonBackgroundColor: '#6da0c7',
        buttonTextColor: '#ffffff',
        buttonStyle: 'soft',
        buttonRadius: 20
      },
      sections: [
        {
          id: 'sec-bau-1',
          type: 'custom',
          title: 'Bendición Celestial',
          enabled: true,
          layout: 'canvas',
          height: 760,
          background: { color: '#f5f8fa' },
          layers: [
            {
              id: 'l-bau-icon',
              type: 'text',
              text: 'Bebé',
              x: 44, y: 12, width: 12, height: 8, zIndex: 1,
              style: { iconName: 'baby', color: '#6da0c7', iconStrokeWidth: 2 }
            },
            {
              id: 'l-bau-title',
              type: 'text',
              text: '{{event.title}}',
              x: 8, y: 22, width: 84, height: 12, zIndex: 2,
              style: { color: '#2c3e50', fontSize: 32, fontWeight: 700, fontFamily: "'Playfair Display', serif", textAlign: 'center' }
            },
            {
              id: 'l-bau-sub',
              type: 'text',
              text: 'Damos gracias por este regalo de vida y te invitamos a celebrar con nosotros',
              x: 10, y: 36, width: 80, height: 8, zIndex: 3,
              style: { color: '#5a6b7c', fontSize: 14, textAlign: 'center' }
            }
          ]
        }
      ]
    },
    passDesign: {
      sections: [
        {
          id: 'sheet-pass-bau',
          title: 'Pase Bautizo',
          layout: 'canvas',
          height: 800,
          pluginSettings: { sheetWidth: 450, sheetHeight: 800 },
          background: { color: '#f5f8fa' },
          layers: [
            {
              id: 'p-bau-frame',
              type: 'shape',
              text: 'Marco Suave',
              x: 5, y: 3, width: 90, height: 94, zIndex: 1,
              style: { borderColor: '#6da0c7', borderWidth: 1.5, borderRadius: 24, backgroundColor: '#ffffff', shapeKind: 'rounded', boxShadow: '0 8px 24px rgba(109,160,199,0.15)' }
            },
            {
              id: 'p-bau-icon',
              type: 'text',
              text: 'Bebé',
              x: 44, y: 6, width: 12, height: 6, zIndex: 2,
              style: { iconName: 'baby', color: '#6da0c7' }
            },
            {
              id: 'p-bau-title',
              type: 'text',
              text: '{{event.title}}',
              x: 8, y: 13, width: 84, height: 8, zIndex: 3,
              style: { color: '#2c3e50', fontSize: 24, fontWeight: 700, fontFamily: "'Playfair Display', serif", textAlign: 'center' }
            },
            {
              id: 'p-bau-qr',
              type: 'image',
              text: 'QR Acceso',
              x: 28, y: 25, width: 44, height: 24, zIndex: 4,
              binding: 'pass.qrCode',
              url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=VIP-ACCESO-DEMO'
            },
            {
              id: 'p-bau-guest',
              type: 'text',
              text: '{{guest.name}}',
              x: 8, y: 55, width: 84, height: 6, zIndex: 5,
              style: { color: '#2c3e50', fontSize: 20, fontWeight: 700, textAlign: 'center' }
            },
            {
              id: 'p-bau-meta',
              type: 'text',
              text: 'Mesa: {{guest.table}} · {{guest.companions}} personas',
              x: 10, y: 63, width: 80, height: 5, zIndex: 6,
              style: { color: '#6da0c7', fontSize: 13, fontWeight: 600, textAlign: 'center' }
            }
          ]
        }
      ]
    },
    accessScreen: {
      enabled: true,
      title: 'Pase Familiar Bautizo',
      subtitle: 'Ingresa tu número registrado para obtener tus boletos digitales.',
      cardStyle: 'glass',
      cardBgColor: '#ffffff',
      cardOpacity: 95,
      cardRadius: 20,
      primaryColor: '#6da0c7',
      textColor: '#2c3e50',
      buttonBgColor: '#6da0c7',
      buttonTextColor: '#ffffff',
      headingFont: "'Playfair Display', serif"
    }
  }
];

async function ensureSeedTemplates(ownerId) {
  try {
    const count = await VisualDesignTemplate.countDocuments({ isPublic: true });
    if (count < 2 && ownerId) {
      for (const t of SEED_TEMPLATES) {
        const exists = await VisualDesignTemplate.findOne({ name: t.name });
        if (!exists) {
          await VisualDesignTemplate.create({ ...t, owner: ownerId });
        }
      }
    }
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Public & Community Catalog (Canva-style marketplace)
 */
exports.catalog = asyncHandler(async (req, res) => {
  const { eventType, search, contentFilter, sort = 'popular', limit = 40 } = req.query;

  const query = {
    isPublic: true,
    status: { $in: ['published', 'featured'] }
  };

  if (eventType && eventType !== 'all') {
    query.eventType = eventType;
  }

  if (search && search.trim()) {
    const rx = new RegExp(search.trim(), 'i');
    query.$or = [
      { name: rx },
      { description: rx },
      { authorName: rx },
      { tags: rx }
    ];
  }

  if (contentFilter === 'full') {
    query.includesInvitation = true;
    query.includesPass = true;
  } else if (contentFilter === 'pass') {
    query.includesPass = true;
  } else if (contentFilter === 'access') {
    query.includesAccess = true;
  }

  let sortCriteria = { usageCount: -1, createdAt: -1 };
  if (sort === 'newest') sortCriteria = { createdAt: -1 };
  if (sort === 'name') sortCriteria = { name: 1 };

  let templates = await VisualDesignTemplate.find(query)
    .sort(sortCriteria)
    .limit(Number(limit))
    .lean();

  // If no public templates exist in DB yet, auto-seed with owner or return virtual seed templates
  if (templates.length === 0 && (!search || search.trim() === '')) {
    if (req.user?._id) {
      await ensureSeedTemplates(req.user._id);
      templates = await VisualDesignTemplate.find(query).sort(sortCriteria).limit(Number(limit)).lean();
    }
    if (templates.length === 0) {
      templates = SEED_TEMPLATES.map((st, i) => ({
        ...st,
        _id: `seed-tpl-${i + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }
  }

  res.json({
    templates,
    total: templates.length,
    creatorRewardPolicy: {
      percent: 5,
      description: 'Ganas el 5% de comisión cada vez que otro usuario utilice tu plantilla publicada.'
    }
  });
});

/**
 * User's own templates
 */
exports.list = asyncHandler(async (req, res) => {
  const templates = await VisualDesignTemplate.find({ owner: req.user._id }).sort('-updatedAt');
  res.json({ templates });
});

/**
 * Publish or create a template
 */
exports.create = asyncHandler(async (req, res) => {
  const body = req.validated?.body || req.body;
  const owner = req.user._id;
  const authorName = body.authorName?.trim() || req.user.name || 'Creador de la Comunidad';

  // Determine publication status based on autoApproveTemplates policy
  const isPublic = body.isPublic !== undefined ? Boolean(body.isPublic) : true;
  let status = 'published';
  if (!isPublic) {
    status = 'draft';
  } else if (req.user?.role !== 'admin') {
    const autoApproveSetting = await SystemSetting.findOne({ key: 'autoApproveTemplates' });
    const autoApprove = autoApproveSetting !== null ? Boolean(autoApproveSetting.value) : true;
    status = autoApprove ? 'published' : 'pending';
  }

  const templatePayload = {
    ...body,
    owner,
    authorName,
    isPublic: ['published', 'featured'].includes(status),
    status,
    authorRewardPercent: 5,
    includesInvitation: Boolean(body.includesInvitation ?? true),
    includesPass: Boolean(body.includesPass || (body.passDesign?.sections?.length > 0)),
    includesAccess: Boolean(body.includesAccess || body.accessScreen?.enabled),
    design: body.design,
    passDesign: body.passDesign || null,
    accessScreen: body.accessScreen || null,
    tags: Array.isArray(body.tags) && body.tags.length > 0
      ? body.tags
      : [body.eventType || 'evento', 'plantilla', 'velisse']
  };

  const existing = await VisualDesignTemplate.findOne({ owner, name: body.name.trim() });
  if (existing) {
    Object.assign(existing, templatePayload);
    existing.status = status;
    await existing.save();
    return res.json({
      template: existing,
      message: status === 'pending'
        ? '¡Plantilla actualizada y enviada a moderación!'
        : '¡Plantilla actualizada con éxito en el catálogo!'
    });
  }

  const template = await VisualDesignTemplate.create(templatePayload);
  res.status(201).json({
    template,
    message: status === 'pending'
      ? '¡Plantilla enviada a revisión! El equipo de moderación la aprobará en breve para que esté disponible en el catálogo comunitario.'
      : '¡Plantilla publicada con éxito! Ya está disponible en el catálogo comunitario con 5% de comisión para ti.'
  });
});

/**
 * Increment usage counter when a template is applied
 */
exports.useTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let template = null;
  if (!id.startsWith('seed-tpl-')) {
    template = await VisualDesignTemplate.findByIdAndUpdate(
      id,
      { $inc: { usageCount: 1 } },
      { new: true }
    );
  } else {
    const idx = parseInt(id.replace('seed-tpl-', ''), 10) - 1;
    template = SEED_TEMPLATES[idx] || SEED_TEMPLATES[0];
  }

  if (!template) {
    const error = new Error('Plantilla no encontrada');
    error.statusCode = 404;
    throw error;
  }

  res.json({
    template,
    rewardNotice: `Esta plantilla otorga 5% de comisión a ${template.authorName || 'el creador'}.`
  });
});

/**
 * Update personal template
 */
exports.update = asyncHandler(async (req, res) => {
  const body = req.validated?.body || req.body;
  const template = await VisualDesignTemplate.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    body,
    { new: true, runValidators: true }
  );
  if (!template) {
    const error = new Error('Plantilla visual no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ template });
});

/**
 * Delete personal template
 */
exports.remove = asyncHandler(async (req, res) => {
  const template = await VisualDesignTemplate.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!template) {
    const error = new Error('Plantilla visual no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ message: 'Plantilla eliminada exitosamente' });
});

/**
 * ═══════════════════════════════════════════════════════════════
 * ADMIN MANAGEMENT & MODERATION (Centro de Gestión de Plantillas)
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Get global template management settings
 */
exports.getAdminSettings = asyncHandler(async (_req, res) => {
  const setting = await SystemSetting.findOne({ key: 'autoApproveTemplates' });
  const autoApproveTemplates = setting !== null ? Boolean(setting.value) : true;
  res.json({
    settings: {
      autoApproveTemplates
    }
  });
});

/**
 * Update global template management settings
 */
exports.updateAdminSettings = asyncHandler(async (req, res) => {
  const { autoApproveTemplates } = req.body;
  const setting = await SystemSetting.findOneAndUpdate(
    { key: 'autoApproveTemplates' },
    { value: Boolean(autoApproveTemplates), description: 'Aprobar automáticamente plantillas comunitarias' },
    { upsert: true, new: true }
  );
  res.json({
    settings: {
      autoApproveTemplates: Boolean(setting.value)
    },
    message: `Aprobación automática de plantillas ${Boolean(setting.value) ? 'ACTIVADA' : 'DESACTIVADA'}.`
  });
});

/**
 * List all visual templates for admin moderation
 */
exports.adminList = asyncHandler(async (req, res) => {
  const { status, search, eventType, sort = 'newest' } = req.query;
  const query = {};

  if (status && status !== 'all') {
    query.status = status;
  }
  if (eventType && eventType !== 'all') {
    query.eventType = eventType;
  }
  if (search && search.trim()) {
    const rx = new RegExp(search.trim(), 'i');
    query.$or = [
      { name: rx },
      { description: rx },
      { authorName: rx },
      { tags: rx }
    ];
  }

  let sortCriteria = { createdAt: -1 };
  if (sort === 'usage') sortCriteria = { usageCount: -1, createdAt: -1 };
  if (sort === 'oldest') sortCriteria = { createdAt: 1 };
  if (sort === 'name') sortCriteria = { name: 1 };

  const templates = await VisualDesignTemplate.find(query)
    .populate('owner', 'name email avatarUrl')
    .sort(sortCriteria)
    .lean();

  const counts = {
    total: await VisualDesignTemplate.countDocuments({}),
    pending: await VisualDesignTemplate.countDocuments({ status: 'pending' }),
    published: await VisualDesignTemplate.countDocuments({ status: 'published' }),
    featured: await VisualDesignTemplate.countDocuments({ status: 'featured' }),
    rejected: await VisualDesignTemplate.countDocuments({ status: 'rejected' }),
    draft: await VisualDesignTemplate.countDocuments({ status: 'draft' })
  };

  res.json({
    templates,
    counts,
    total: templates.length
  });
});

/**
 * Update template moderation status (approve, reject, feature, set pending)
 */
exports.adminUpdateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, adminFeedback } = req.body;

  if (!['pending', 'published', 'featured', 'rejected', 'draft'].includes(status)) {
    const error = new Error('Estado no válido');
    error.statusCode = 400;
    throw error;
  }

  const update = {
    status,
    reviewedAt: new Date(),
    reviewedBy: req.user._id,
    isPublic: ['published', 'featured'].includes(status)
  };
  if (adminFeedback !== undefined) {
    update.adminFeedback = adminFeedback;
  }

  const template = await VisualDesignTemplate.findByIdAndUpdate(id, update, { new: true })
    .populate('owner', 'name email avatarUrl');

  if (!template) {
    const error = new Error('Plantilla no encontrada');
    error.statusCode = 404;
    throw error;
  }

  const message = status === 'published'
    ? `¡Plantilla "${template.name}" aprobada y publicada en el catálogo comunitario!`
    : status === 'featured'
      ? `¡Plantilla "${template.name}" destacada en los primeros lugares!`
      : status === 'rejected'
        ? `Plantilla "${template.name}" retirada del catálogo. Ajustes solicitados al autor.`
        : `Estado de "${template.name}" actualizado a ${status}.`;

  res.json({
    template,
    message
  });
});
