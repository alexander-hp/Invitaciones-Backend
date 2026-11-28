const mongoose = require('mongoose');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const SystemSetting = require('../models/SystemSetting');
const asyncHandler = require('../utils/asyncHandler');

const SETTING_KEY = 'analytics_tracker_config';

const DEFAULT_CONFIG = {
  captureEnabled: true,
  trackAdminUsers: false,
  captureApiHealthSample: true,
  retentionDays: 90,
  slowApiThresholdMs: 1500,
  lastResetAt: null,
  lastResetBy: null
};

let cachedConfig = null;
let cachedConfigAt = 0;
const CACHE_TTL_MS = 20000;

async function getTrackerConfig(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedConfig && now - cachedConfigAt < CACHE_TTL_MS) {
    return cachedConfig;
  }
  const doc = await SystemSetting.findOne({ key: SETTING_KEY }).lean();
  cachedConfig = {
    ...DEFAULT_CONFIG,
    ...(doc && typeof doc.value === 'object' && doc.value !== null ? doc.value : {})
  };
  cachedConfigAt = now;
  return cachedConfig;
}

function cleanStr(val, maxLen = 120, fallback = '') {
  if (val === undefined || val === null) return fallback;
  return String(val).replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function cleanNum(val, min = 0, max = 3600000) {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function parseRangeHours(range) {
  if (range === '24h') return 24;
  if (range === '30d') return 720;
  if (range === '90d') return 2160;
  return 168; // 7d default
}

const ALLOWED_EVENTS = new Set([
  'pageview',
  'pageleave',
  'section_tab',
  'feature_used',
  'ux_rage_click',
  'ux_dead_click',
  'ux_form_abandoned',
  'ux_form_submitted',
  'qa_runtime_error',
  'qa_api_error',
  'qa_slow_api',
  'qa_api_ok',
  'qa_layout_shift',
  'qa_slow_lcp'
]);

const getPublicConfig = asyncHandler(async (_req, res) => {
  const cfg = await getTrackerConfig();
  res.json({
    config: {
      captureEnabled: Boolean(cfg.captureEnabled),
      trackAdminUsers: Boolean(cfg.trackAdminUsers),
      captureApiHealthSample: Boolean(cfg.captureApiHealthSample),
      slowApiThresholdMs: Number(cfg.slowApiThresholdMs || 1500)
    }
  });
});

const ingestBatch = asyncHandler(async (req, res) => {
  const cfg = await getTrackerConfig();
  if (!cfg.captureEnabled) {
    return res.status(202).json({ accepted: 0, status: 'disabled' });
  }

  let bodyPayload = req.body;
  if (typeof bodyPayload === 'string') {
    try {
      bodyPayload = JSON.parse(bodyPayload);
    } catch {
      return res.status(400).json({ message: 'Payload de telemetría inválido' });
    }
  }

  const rawEvents = Array.isArray(bodyPayload?.events) ? bodyPayload.events.slice(0, 60) : [];
  if (!rawEvents.length) {
    return res.status(202).json({ accepted: 0 });
  }

  const retentionDays = Math.max(7, Math.min(365, Number(cfg.retentionDays || 90)));
  const expiresAt = new Date(Date.now() + retentionDays * 86400 * 1000);
  const authUser = req.user || null;

  const docs = [];
  for (const raw of rawEvents) {
    if (!raw || typeof raw !== 'object') continue;
    const evName = cleanStr(raw.event, 64).replace(/^\$/, '');
    if (!ALLOWED_EVENTS.has(evName)) continue;

    const effectiveRole = authUser?.role || cleanStr(raw.userRole, 32, 'guest');
    const isDiagnostic = Boolean(raw.isDiagnostic);

    if (effectiveRole === 'admin' && !cfg.trackAdminUsers && !isDiagnostic) {
      continue;
    }

    if (evName === 'qa_api_ok' && !cfg.captureApiHealthSample) {
      continue;
    }

    const userId =
      authUser?._id ||
      (raw.userId && mongoose.Types.ObjectId.isValid(String(raw.userId)) ? raw.userId : null);

    const distinctId = userId
      ? String(userId)
      : cleanStr(raw.distinctId, 80, 'anon_visitor');

    const sessionId = cleanStr(raw.sessionId, 80, distinctId);

    const occurredTs = raw.timestamp ? new Date(raw.timestamp).getTime() : Date.now();
    const occurredAt =
      Number.isFinite(occurredTs) && Math.abs(Date.now() - occurredTs) < 7 * 86400 * 1000
        ? new Date(occurredTs)
        : new Date();

    docs.push({
      event: evName,
      sessionId,
      distinctId,
      userId,
      userRole: effectiveRole,
      route: cleanStr(raw.route, 140, '/'),
      rawPath: cleanStr(raw.rawPath, 180, '/'),
      routeLabel: cleanStr(raw.routeLabel, 120, 'Pantalla'),
      moduleGroup: cleanStr(raw.moduleGroup, 60, 'Gestión Evento'),
      sectionTab: cleanStr(raw.sectionTab, 80, ''),
      pageSection: cleanStr(raw.pageSection, 120, ''),
      deviceType: cleanStr(raw.deviceType, 32, 'Web Desktop'),
      browser: cleanStr(raw.browser, 40, 'Web'),
      os: cleanStr(raw.os, 40, ''),
      viewport: cleanStr(raw.viewport, 24, ''),
      dwellSeconds: cleanNum(raw.dwellSeconds, 0, 86400),
      maxScrollPct: cleanNum(raw.maxScrollPct, 0, 100),
      routeLoadMs: cleanNum(raw.routeLoadMs, 0, 120000),
      exitReason: cleanStr(raw.exitReason, 32, ''),
      targetLabel: cleanStr(raw.targetLabel, 120, ''),
      selector: cleanStr(raw.selector, 120, ''),
      featureKey: cleanStr(raw.featureKey, 64, ''),
      featureCategory: cleanStr(raw.featureCategory, 64, ''),
      formName: cleanStr(raw.formName, 100, ''),
      fieldsTouched: cleanNum(raw.fieldsTouched, 0, 100),
      endpoint: cleanStr(raw.endpoint, 140, ''),
      httpMethod: cleanStr(raw.httpMethod, 12, ''),
      statusCode: cleanNum(raw.statusCode, 0, 999),
      durationMs: cleanNum(raw.durationMs, 0, 300000),
      errorMessage: cleanStr(raw.errorMessage, 260, ''),
      stackTop: cleanStr(raw.stackTop, 220, ''),
      lastBreadcrumb: cleanStr(raw.lastBreadcrumb, 180, ''),
      isDiagnostic,
      occurredAt,
      expiresAt
    });
  }

  if (docs.length > 0) {
    await AnalyticsEvent.insertMany(docs, { ordered: false }).catch(() => {});
  }

  res.status(202).json({ accepted: docs.length });
});

const getAdminConfig = asyncHandler(async (_req, res) => {
  const config = await getTrackerConfig(true);
  const totalStoredEvents = await AnalyticsEvent.estimatedDocumentCount();
  res.json({ config, totalStoredEvents });
});

const updateAdminConfig = asyncHandler(async (req, res) => {
  const current = await getTrackerConfig(true);
  const body = req.body || {};

  const next = {
    ...current,
    captureEnabled: body.captureEnabled !== undefined ? Boolean(body.captureEnabled) : current.captureEnabled,
    trackAdminUsers: body.trackAdminUsers !== undefined ? Boolean(body.trackAdminUsers) : current.trackAdminUsers,
    captureApiHealthSample:
      body.captureApiHealthSample !== undefined ? Boolean(body.captureApiHealthSample) : current.captureApiHealthSample,
    retentionDays:
      body.retentionDays !== undefined
        ? Math.max(7, Math.min(365, Math.round(Number(body.retentionDays) || 90)))
        : current.retentionDays,
    slowApiThresholdMs:
      body.slowApiThresholdMs !== undefined
        ? Math.max(300, Math.min(15000, Math.round(Number(body.slowApiThresholdMs) || 1500)))
        : current.slowApiThresholdMs
  };

  await SystemSetting.findOneAndUpdate(
    { key: SETTING_KEY },
    {
      key: SETTING_KEY,
      value: next,
      description: 'Configuración global del motor interno de analítica UX, embudos y QA'
    },
    { upsert: true, new: true }
  );

  cachedConfig = next;
  cachedConfigAt = Date.now();

  res.json({ config: next, message: 'Configuración de telemetría guardada en base de datos.' });
});

const resetAnalyticsData = asyncHandler(async (req, res) => {
  const scope = cleanStr(req.query.scope || req.body?.scope || 'all', 32, 'all');
  let filter = {};
  let scopeDescription = 'toda la telemetría';

  if (scope === 'diagnostics') {
    filter = { isDiagnostic: true };
    scopeDescription = 'las sondas de prueba diagnóstica';
  } else if (scope === 'qa') {
    filter = { event: { $in: ['qa_runtime_error', 'qa_api_error', 'qa_slow_api', 'qa_api_ok', 'qa_layout_shift', 'qa_slow_lcp'] } };
    scopeDescription = 'el historial de errores QA y latencia API';
  } else if (scope === 'ux') {
    filter = { event: { $in: ['ux_rage_click', 'ux_dead_click', 'ux_form_abandoned'] } };
    scopeDescription = 'los incidentes de fricción UX';
  }

  const result = await AnalyticsEvent.deleteMany(filter);

  const current = await getTrackerConfig(true);
  const resetTimestamp = new Date().toISOString();
  const updatedConfig = {
    ...current,
    lastResetAt: resetTimestamp,
    lastResetBy: req.user?.email || req.user?.name || 'Admin'
  };

  await SystemSetting.findOneAndUpdate(
    { key: SETTING_KEY },
    {
      key: SETTING_KEY,
      value: updatedConfig,
      description: 'Configuración global del motor interno de analítica UX, embudos y QA'
    },
    { upsert: true, new: true }
  );

  cachedConfig = updatedConfig;
  cachedConfigAt = Date.now();

  res.json({
    ok: true,
    scope,
    deletedCount: result.deletedCount || 0,
    lastResetAt: resetTimestamp,
    lastResetBy: updatedConfig.lastResetBy,
    message: `Se eliminaron ${result.deletedCount || 0} registros (${scopeDescription}).`
  });
});

function buildRoadmapInsights({ kpis, funnels, sections, uxIncidents, qaIssues, exitRoutes }) {
  const insights = [];
  const entryRoutes = new Set(['/', '/new/login', '/new/register', '/new/dashboard', '/new/admin/analytics']);

  const topRage = uxIncidents.find((i) => i.type === 'rage_click');
  if (topRage) {
    const locDetail = topRage.pageSection
      ? `${topRage.routeLabel} · ${topRage.pageSection}`
      : topRage.routeLabel;
    insights.push({
      id: 'ins-rage',
      area: 'UX / Diseño',
      priority: topRage.occurrences >= 5 ? 'P0 Urgente' : 'P1 Alta',
      title: `Clics de frustración en "${topRage.targetLabel}" (${topRage.routeLabel})`,
      pageLabel: topRage.routeLabel,
      pageSection: topRage.pageSection || '',
      evidence: `${topRage.occurrences} rage-clicks de ${topRage.affectedUsers} usuario(s) en ${locDetail} (${topRage.deviceSplit}).`,
      suggestedAction: topRage.diagnosis,
      affectedRoute: topRage.route
    });
  }

  const mainFunnel = funnels[0];
  const worstStep = mainFunnel
    ? [...mainFunnel.steps].filter((s) => s.stepNumber > 1).sort((a, b) => b.dropOffRate - a.dropOffRate)[0]
    : null;
  if (worstStep && worstStep.dropOffRate >= 20 && worstStep.dropOffUsers > 0) {
    insights.push({
      id: 'ins-funnel',
      area: 'Producto / Conversión',
      priority: worstStep.dropOffRate >= 40 && worstStep.dropOffUsers >= 3 ? 'P0 Urgente' : 'P1 Alta',
      title: `Fuga del ${worstStep.dropOffRate}% en el paso "${worstStep.label}"`,
      pageLabel: worstStep.label,
      pageSection: 'Embudo Organizador',
      evidence: `${worstStep.dropOffUsers} usuario(s) no avanzaron hacia ${worstStep.routeHint}.`,
      suggestedAction: 'Simplificar campos obligatorios iniciales y guiar con botón primario destacado.',
      affectedRoute: worstStep.routeHint
    });
  }

  const topQa = qaIssues[0];
  if (topQa) {
    insights.push({
      id: 'ins-qa',
      area: 'QA / Estabilidad',
      priority: topQa.severity === 'critica' ? 'P0 Urgente' : 'P1 Alta',
      title: `Fallo técnico en ${topQa.pageLabel || topQa.routeOrEndpoint}: ${topQa.title}`,
      pageLabel: topQa.pageLabel || topQa.routeOrEndpoint,
      pageSection: topQa.pageSection || '',
      evidence: `${topQa.occurrences} ocurrencia(s) en ${topQa.pageLabel || topQa.routeOrEndpoint} (${topQa.browserDevice}). Acción previa: ${topQa.lastBreadcrumb}.`,
      suggestedAction: 'Revisar manejo de errores en esa pantalla y validar respuesta del endpoint.',
      affectedRoute: topQa.routeOrEndpoint
    });
  }

  const topDead = uxIncidents.find((i) => i.type === 'dead_click');
  if (topDead) {
    const locDetail = topDead.pageSection
      ? `${topDead.routeLabel} · ${topDead.pageSection}`
      : topDead.routeLabel;
    insights.push({
      id: 'ins-dead',
      area: 'UX / Diseño',
      priority: 'P2 Mejora',
      title: `Elemento ambiguo "${topDead.targetLabel}" en ${topDead.routeLabel}`,
      pageLabel: topDead.routeLabel,
      pageSection: topDead.pageSection || '',
      evidence: `${topDead.occurrences} toques sin respuesta dentro de ${locDetail}.`,
      suggestedAction: 'Conectar una acción útil (filtro/modal) o eliminar apariencia de botón clickeable.',
      affectedRoute: topDead.route
    });
  }

  const topExit = exitRoutes[0];
  if (topExit && topExit.exits >= 3 && topExit.exitRatePct >= 35) {
    insights.push({
      id: 'ins-exit',
      area: 'Producto / Conversión',
      priority: 'P1 Alta',
      title: `Mayor cierre definitivo en "${topExit.label}"`,
      pageLabel: topExit.label,
      pageSection: 'Salida de aplicación / pestaña',
      evidence: `${topExit.exits} cierres definitivos en ${topExit.label} (${topExit.exitRatePct}% tasa de fuga tras ~${topExit.avgDwellSec}s).`,
      suggestedAction: 'Añadir llamado a la acción claro o autoguardado para recuperar el progreso del usuario.',
      affectedRoute: topExit.route
    });
  }

  const underused =
    kpis.totalPageviews >= 15
      ? sections.find((s) => s.adoptionStatus === 'Subutilizada' && !entryRoutes.has(s.route))
      : null;
  if (underused) {
    insights.push({
      id: 'ins-underused',
      area: 'Producto / Conversión',
      priority: 'P2 Mejora',
      title: `Baja visibilidad del módulo "${underused.label}"`,
      pageLabel: underused.label,
      pageSection: underused.moduleGroup,
      evidence: `Solo ${underused.views} vistas registradas en ${underused.route} frente a ${kpis.totalPageviews} vistas globales.`,
      suggestedAction: 'Agregar acceso contextual desde el panel del evento o resaltarlo en el tutorial.',
      affectedRoute: underused.route
    });
  }

  if (kpis.avgApiLatencyMs >= 450) {
    insights.push({
      id: 'ins-latency',
      area: 'Rendimiento',
      priority: 'P1 Alta',
      title: `Optimizar tiempo de respuesta API (${kpis.avgApiLatencyMs} ms promedio)`,
      pageLabel: 'Capa API Backend',
      pageSection: 'Latencia global HTTP',
      evidence: 'Latencias elevadas aumentan clics repetidos y abandono en redes móviles.',
      suggestedAction: 'Revisar índices y tamaño de payload en los endpoints con mayor p95.',
      affectedRoute: '/api'
    });
  }

  return insights;
}

const getAdminDashboard = asyncHandler(async (req, res) => {
  const range = cleanStr(req.query.range, 10, '7d');
  const deviceFilter = cleanStr(req.query.device, 32, 'ALL');
  const roleFilter = cleanStr(req.query.role, 32, 'ALL');
  const includeDiagnostics = req.query.includeDiagnostics !== 'false';

  const hours = parseRangeHours(range);
  const sinceDate = new Date(Date.now() - hours * 3600 * 1000);

  const matchQuery = {
    occurredAt: { $gte: sinceDate }
  };
  if (deviceFilter && deviceFilter !== 'ALL') {
    matchQuery.deviceType = deviceFilter;
  }
  if (roleFilter && roleFilter !== 'ALL') {
    matchQuery.userRole = roleFilter;
  }
  if (!includeDiagnostics) {
    matchQuery.isDiagnostic = { $ne: true };
  }

  const config = await getTrackerConfig();

  const [
    totalStoredAllTime,
    oldestEventDoc,
    overviewAgg,
    trendAgg,
    sectionsAgg,
    subTabsAgg,
    featuresAgg,
    uxAgg,
    formStatsAgg,
    devicesAgg,
    rolesAgg,
    qaAgg,
    apiAgg,
    funnelDistinctByRouteAgg,
    funnelDistinctByFeatureAgg,
    recentEventsDocs
  ] = await Promise.all([
    AnalyticsEvent.countDocuments({}),
    AnalyticsEvent.findOne({}, { occurredAt: 1 }).sort({ occurredAt: 1 }).lean(),

    // 1. Overview KPIs
    AnalyticsEvent.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          distinctUsers: { $addToSet: '$distinctId' },
          distinctSessions: { $addToSet: '$sessionId' },
          totalPageviews: { $sum: { $cond: [{ $eq: ['$event', 'pageview'] }, 1, 0] } },
          dwellSum: { $sum: { $cond: [{ $eq: ['$event', 'pageleave'] }, { $ifNull: ['$dwellSeconds', 0] }, 0] } },
          dwellCount: { $sum: { $cond: [{ $eq: ['$event', 'pageleave'] }, 1, 0] } },
          rageClicks: { $sum: { $cond: [{ $eq: ['$event', 'ux_rage_click'] }, 1, 0] } },
          deadClicks: { $sum: { $cond: [{ $eq: ['$event', 'ux_dead_click'] }, 1, 0] } },
          formAbandons: { $sum: { $cond: [{ $eq: ['$event', 'ux_form_abandoned'] }, 1, 0] } },
          runtimeErrors: { $sum: { $cond: [{ $eq: ['$event', 'qa_runtime_error'] }, 1, 0] } },
          apiErrors: { $sum: { $cond: [{ $eq: ['$event', 'qa_api_error'] }, 1, 0] } },
          slowApis: { $sum: { $cond: [{ $eq: ['$event', 'qa_slow_api'] }, 1, 0] } },
          layoutShifts: { $sum: { $cond: [{ $eq: ['$event', 'qa_layout_shift'] }, 1, 0] } },
          apiTotalCalls: {
            $sum: {
              $cond: [{ $in: ['$event', ['qa_api_ok', 'qa_slow_api', 'qa_api_error']] }, 1, 0]
            }
          },
          apiDurationSum: {
            $sum: {
              $cond: [
                { $in: ['$event', ['qa_api_ok', 'qa_slow_api', 'qa_api_error']] },
                { $ifNull: ['$durationMs', 0] },
                0
              ]
            }
          }
        }
      }
    ]),

    // 2. Daily (or Hourly for 24h) Trend
    AnalyticsEvent.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: {
              format: range === '24h' ? '%H:00' : '%Y-%m-%d',
              date: '$occurredAt'
            }
          },
          sessionsSet: { $addToSet: '$sessionId' },
          conversions: {
            $sum: { $cond: [{ $in: ['$event', ['feature_used', 'ux_form_submitted']] }, 1, 0] }
          },
          frictions: {
            $sum: {
              $cond: [{ $in: ['$event', ['ux_rage_click', 'ux_dead_click', 'ux_form_abandoned']] }, 1, 0]
            }
          },
          errors: {
            $sum: {
              $cond: [{ $in: ['$event', ['qa_runtime_error', 'qa_api_error']] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    // 3. Sections & Exit Routes
    AnalyticsEvent.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$route',
          label: { $last: '$routeLabel' },
          moduleGroup: { $last: '$moduleGroup' },
          views: { $sum: { $cond: [{ $eq: ['$event', 'pageview'] }, 1, 0] } },
          usersSet: { $addToSet: '$distinctId' },
          dwellAvg: {
            $avg: { $cond: [{ $eq: ['$event', 'pageleave'] }, '$dwellSeconds', null] }
          },
          scrollAvg: {
            $avg: { $cond: [{ $eq: ['$event', 'pageleave'] }, '$maxScrollPct', null] }
          },
          loadMsAvg: {
            $avg: { $cond: [{ $eq: ['$event', 'pageview'] }, '$routeLoadMs', null] }
          },
          unloads: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$event', 'pageleave'] }, { $eq: ['$exitReason', 'page_unload'] }] },
                1,
                0
              ]
            }
          },
          frictions: {
            $sum: {
              $cond: [{ $in: ['$event', ['ux_rage_click', 'ux_dead_click', 'ux_form_abandoned']] }, 1, 0]
            }
          }
        }
      },
      { $sort: { views: -1 } },
      { $limit: 30 }
    ]),

    // 4. Internal Sub-tabs Usage (Event Detail tabs, Editor tabs, etc.)
    AnalyticsEvent.aggregate([
      {
        $match: {
          ...matchQuery,
          sectionTab: { $exists: true, $nin: ['', null] },
          event: { $in: ['section_tab', 'pageview'] }
        }
      },
      {
        $group: {
          _id: { route: '$route', tab: '$sectionTab' },
          routeLabel: { $last: '$routeLabel' },
          opens: { $sum: 1 },
          usersSet: { $addToSet: '$distinctId' }
        }
      },
      { $sort: { opens: -1 } },
      { $limit: 20 }
    ]),

    // 5. Feature Adoption
    AnalyticsEvent.aggregate([
      { $match: { ...matchQuery, event: 'feature_used', featureKey: { $nin: ['', null] } } },
      {
        $group: {
          _id: '$featureKey',
          label: { $last: '$targetLabel' },
          category: { $last: '$featureCategory' },
          uses: { $sum: 1 },
          usersSet: { $addToSet: '$distinctId' }
        }
      },
      { $sort: { uses: -1 } },
      { $limit: 20 }
    ]),

    // 6. UX Friction Incidents
    AnalyticsEvent.aggregate([
      {
        $match: {
          ...matchQuery,
          event: { $in: ['ux_rage_click', 'ux_dead_click', 'ux_form_abandoned'] }
        }
      },
      {
        $group: {
          _id: {
            event: '$event',
            route: '$route',
            target: {
              $cond: [
                { $eq: ['$event', 'ux_form_abandoned'] },
                { $concat: ['$formName', ' → ', '$targetLabel'] },
                '$targetLabel'
              ]
            }
          },
          routeLabel: { $last: '$routeLabel' },
          pageSection: { $last: '$pageSection' },
          selector: { $last: '$selector' },
          occurrences: { $sum: 1 },
          usersSet: { $addToSet: '$distinctId' },
          mobileHits: {
            $sum: { $cond: [{ $in: ['$deviceType', ['Web Móvil', 'Android App']] }, 1, 0] }
          },
          lastSeen: { $max: '$occurredAt' }
        }
      },
      { $sort: { occurrences: -1 } },
      { $limit: 25 }
    ]),

    // 7. Form Abandonment vs Submission
    AnalyticsEvent.aggregate([
      {
        $match: {
          ...matchQuery,
          event: { $in: ['ux_form_abandoned', 'ux_form_submitted'] },
          formName: { $nin: ['', null] }
        }
      },
      {
        $group: {
          _id: { formName: '$formName', route: '$route' },
          abandoned: { $sum: { $cond: [{ $eq: ['$event', 'ux_form_abandoned'] }, 1, 0] } },
          submitted: { $sum: { $cond: [{ $eq: ['$event', 'ux_form_submitted'] }, 1, 0] } },
          lastField: {
            $last: { $cond: [{ $eq: ['$event', 'ux_form_abandoned'] }, '$targetLabel', null] }
          },
          avgTimeSec: {
            $avg: { $cond: [{ $eq: ['$event', 'ux_form_abandoned'] }, '$dwellSeconds', null] }
          }
        }
      },
      { $match: { abandoned: { $gt: 0 } } },
      { $sort: { abandoned: -1 } },
      { $limit: 15 }
    ]),

    // 8. Devices Experience Breakdown
    AnalyticsEvent.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$deviceType',
          sessionsSet: { $addToSet: '$sessionId' },
          pageviews: { $sum: { $cond: [{ $eq: ['$event', 'pageview'] }, 1, 0] } },
          avgLoadMs: {
            $avg: {
              $cond: [
                { $in: ['$event', ['qa_api_ok', 'qa_slow_api', 'pageview']] },
                { $ifNull: ['$durationMs', '$routeLoadMs'] },
                null
              ]
            }
          },
          frictions: {
            $sum: {
              $cond: [{ $in: ['$event', ['ux_rage_click', 'ux_dead_click', 'ux_form_abandoned']] }, 1, 0]
            }
          },
          errors: {
            $sum: { $cond: [{ $in: ['$event', ['qa_runtime_error', 'qa_api_error']] }, 1, 0] }
          },
          conversions: {
            $sum: { $cond: [{ $in: ['$event', ['feature_used', 'ux_form_submitted']] }, 1, 0] }
          }
        }
      },
      { $sort: { pageviews: -1 } }
    ]),

    // 9. Roles Breakdown
    AnalyticsEvent.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$userRole',
          usersSet: { $addToSet: '$distinctId' },
          sessionsSet: { $addToSet: '$sessionId' },
          eventsCount: { $sum: 1 }
        }
      },
      { $sort: { eventsCount: -1 } }
    ]),

    // 10. QA Issues
    AnalyticsEvent.aggregate([
      {
        $match: {
          ...matchQuery,
          event: { $in: ['qa_runtime_error', 'qa_api_error', 'qa_slow_api', 'qa_layout_shift', 'qa_slow_lcp'] }
        }
      },
      {
        $group: {
          _id: {
            event: '$event',
            key: {
              $cond: [
                { $in: ['$event', ['qa_api_error', 'qa_slow_api']] },
                { $concat: ['$httpMethod', ' ', '$endpoint'] },
                '$errorMessage'
              ]
            },
            route: '$route'
          },
          routeLabel: { $last: '$routeLabel' },
          pageSection: { $last: '$pageSection' },
          statusCode: { $last: '$statusCode' },
          durationMs: { $max: '$durationMs' },
          browser: { $last: '$browser' },
          deviceType: { $last: '$deviceType' },
          lastBreadcrumb: { $last: '$lastBreadcrumb' },
          stackTop: { $last: '$stackTop' },
          occurrences: { $sum: 1 },
          usersSet: { $addToSet: '$distinctId' },
          lastSeen: { $max: '$occurredAt' }
        }
      },
      { $sort: { occurrences: -1, lastSeen: -1 } },
      { $limit: 25 }
    ]),

    // 11. API Endpoint Health
    AnalyticsEvent.aggregate([
      {
        $match: {
          ...matchQuery,
          event: { $in: ['qa_api_ok', 'qa_slow_api', 'qa_api_error'] },
          endpoint: { $nin: ['', null] }
        }
      },
      {
        $group: {
          _id: { method: '$httpMethod', endpoint: '$endpoint' },
          calls: { $sum: 1 },
          avgLatencyMs: { $avg: '$durationMs' },
          maxLatencyMs: { $max: '$durationMs' },
          failures: { $sum: { $cond: [{ $eq: ['$event', 'qa_api_error'] }, 1, 0] } }
        }
      },
      { $sort: { calls: -1 } },
      { $limit: 20 }
    ]),

    // 12. Funnel Distinct Users by Route
    AnalyticsEvent.aggregate([
      { $match: { ...matchQuery, event: { $in: ['pageview', 'pageleave'] } } },
      {
        $group: {
          _id: '$route',
          usersSet: { $addToSet: '$distinctId' },
          deepScrollUsers: {
            $addToSet: {
              $cond: [
                { $and: [{ $eq: ['$event', 'pageleave'] }, { $gte: ['$maxScrollPct', 50] }] },
                '$distinctId',
                '$$REMOVE'
              ]
            }
          },
          avgDwell: {
            $avg: { $cond: [{ $eq: ['$event', 'pageleave'] }, '$dwellSeconds', null] }
          }
        }
      }
    ]),

    // 13. Funnel Distinct Users by Feature
    AnalyticsEvent.aggregate([
      { $match: { ...matchQuery, event: { $in: ['feature_used', 'ux_form_submitted'] } } },
      {
        $group: {
          _id: '$featureKey',
          usersSet: { $addToSet: '$distinctId' }
        }
      }
    ]),

    // 14. Recent Raw Stream
    AnalyticsEvent.find(matchQuery)
      .sort({ occurredAt: -1 })
      .limit(50)
      .lean()
  ]);

  const ov = overviewAgg[0] || {};
  const activeUsers = (ov.distinctUsers || []).length;
  const totalSessions = (ov.distinctSessions || []).length;
  const totalPageviews = ov.totalPageviews || 0;
  const avgDwellSeconds = ov.dwellCount ? Math.round(ov.dwellSum / ov.dwellCount) : 0;
  const rageClicksCount = ov.rageClicks || 0;
  const deadClicksCount = ov.deadClicks || 0;
  const abandonedFormsCount = ov.formAbandons || 0;
  const qaErrorsCount = (ov.runtimeErrors || 0) + (ov.apiErrors || 0);
  const apiTotalCalls = ov.apiTotalCalls || 0;
  const avgApiLatencyMs = apiTotalCalls ? Math.round(ov.apiDurationSum / apiTotalCalls) : 0;
  const apiErrorRate = apiTotalCalls ? Number((((ov.apiErrors || 0) / apiTotalCalls) * 100).toFixed(1)) : 0;

  // Mapear secciones
  const sections = sectionsAgg
    .filter((s) => s.views > 0 || s.frictions > 0)
    .map((s) => {
      const views = Math.max(s.views || 0, 1);
      const exitRatePct = Math.min(100, Math.round(((s.unloads || 0) / views) * 100));
      let adoptionStatus = 'Saludable';
      if (exitRatePct >= 42 || (s.frictions || 0) >= 5) adoptionStatus = 'Alta Fuga';
      else if (views >= Math.max(5, totalPageviews * 0.16)) adoptionStatus = 'Estrella';
      else if (views <= Math.max(2, totalPageviews * 0.04)) adoptionStatus = 'Subutilizada';

      return {
        route: s._id || '/',
        label: s.label || s._id || '/',
        moduleGroup: s.moduleGroup || 'Gestión Evento',
        views: s.views || 0,
        uniqueUsers: (s.usersSet || []).length,
        avgDwellSec: Math.round(s.dwellAvg || 0),
        avgScrollPct: Math.round(s.scrollAvg || 0),
        avgLoadMs: Math.round(s.loadMsAvg || 0),
        exits: s.unloads || 0,
        exitRatePct,
        frictionEvents: s.frictions || 0,
        adoptionStatus
      };
    });

  const exitRoutes = [...sections]
    .filter((s) => s.exits > 0)
    .sort((a, b) => b.exits - a.exits)
    .slice(0, 8);

  const subTabsUsage = subTabsAgg.map((t) => ({
    route: t._id.route,
    routeLabel: t.routeLabel || t._id.route,
    tabName: t._id.tab,
    opens: t.opens,
    uniqueUsers: (t.usersSet || []).length
  }));

  // Calcular embudos reales basados en conjuntos de distinctId
  const routeUserMap = new Map();
  const routeDeepScrollMap = new Map();
  const routeDwellMap = new Map();
  for (const r of funnelDistinctByRouteAgg) {
    routeUserMap.set(r._id, new Set(r.usersSet || []));
    routeDeepScrollMap.set(r._id, new Set(r.deepScrollUsers || []));
    routeDwellMap.set(r._id, Math.round(r.avgDwell || 25));
  }

  const featureUserMap = new Map();
  for (const f of funnelDistinctByFeatureAgg) {
    featureUserMap.set(f._id || 'form_submit', new Set(f.usersSet || []));
  }

  const unionSize = (...sets) => {
    const merged = new Set();
    for (const s of sets) {
      if (!s) continue;
      for (const item of s) merged.add(item);
    }
    return merged;
  };

  const buildSequentialFunnel = (id, title, subtitle, stepDefs) => {
    let runningSet = null;
    const steps = stepDefs.map((def, idx) => {
      const candidateSet = def.usersSet;
      if (idx === 0) {
        runningSet = candidateSet;
      } else {
        // Intersección progresiva o conteo monótono si el usuario entró directo a un paso posterior
        const intersected = new Set([...candidateSet].filter((u) => runningSet.has(u)));
        runningSet = runningSet.size > 0 ? intersected : candidateSet;
      }
      return {
        ...def,
        matchedCount: runningSet.size
      };
    });

    const startCount = steps[0]?.matchedCount || 0;
    const formattedSteps = steps.map((st, idx) => {
      const prevCount = idx === 0 ? st.matchedCount : steps[idx - 1].matchedCount;
      const conversionFromStart = startCount > 0 ? Math.round((st.matchedCount / startCount) * 100) : 0;
      const conversionFromPrev = idx === 0 ? (st.matchedCount > 0 ? 100 : 0) : prevCount > 0 ? Math.round((st.matchedCount / prevCount) * 100) : 0;
      const dropOffUsers = idx === 0 ? 0 : Math.max(0, prevCount - st.matchedCount);
      const dropOffRate = idx === 0 ? 0 : prevCount > 0 ? 100 - conversionFromPrev : 0;

      return {
        stepNumber: idx + 1,
        key: st.key,
        label: st.label,
        routeHint: st.routeHint,
        users: st.matchedCount,
        conversionFromStart,
        conversionFromPrev,
        dropOffRate,
        dropOffUsers,
        avgTimeSec: st.avgTimeSec || 20
      };
    });

    const worst = [...formattedSteps].filter((s) => s.stepNumber > 1).sort((a, b) => b.dropOffRate - a.dropOffRate)[0];
    return {
      id,
      title,
      subtitle,
      totalCompletionRate: formattedSteps[formattedSteps.length - 1]?.conversionFromStart || 0,
      biggestDropStep:
        worst && worst.dropOffRate > 0 ? `${worst.label} (-${worst.dropOffRate}%)` : 'Sin caídas registradas',
      steps: formattedSteps
    };
  };

  const creatorEntrySet = unionSize(
    routeUserMap.get('/'),
    routeUserMap.get('/new/login'),
    routeUserMap.get('/new/register'),
    routeUserMap.get('/new/dashboard')
  );
  const creatorAuthSet = unionSize(
    routeUserMap.get('/new/dashboard'),
    routeUserMap.get('/new/events'),
    routeUserMap.get('/new/events/:id')
  );
  const creatorEventSet = unionSize(
    routeUserMap.get('/new/events'),
    routeUserMap.get('/new/events/:id'),
    featureUserMap.get('create_event')
  );
  const creatorEditorSet = unionSize(
    routeUserMap.get('/new/invitations/:id/visual-editor'),
    routeUserMap.get('/new/invitations/:id/editor'),
    routeUserMap.get('/new/invitations/:id/pass-editor'),
    routeUserMap.get('/new/invitations/:id/sections')
  );

  const guestOpenSet = unionSize(routeUserMap.get('/new/i/:slug'), routeUserMap.get('/new/e/:portalSlug'));
  const guestReadSet = unionSize(routeDeepScrollMap.get('/new/i/:slug'), featureUserMap.get('rsvp_submit'));
  const guestRsvpSet = unionSize(featureUserMap.get('rsvp_submit'));

  const opsDetailSet = unionSize(routeUserMap.get('/new/events/:id'));
  const opsDispatchSet = unionSize(featureUserMap.get('whatsapp_dispatch'), featureUserMap.get('excel_import'), routeUserMap.get('/new/events/:id/seating'));
  const opsSeatingSet = unionSize(routeUserMap.get('/new/events/:id/seating'), featureUserMap.get('seating_chart'));
  const opsCheckinSet = unionSize(routeUserMap.get('/new/check-in/:token'), routeUserMap.get('/new/external-access/:token'));

  const funnels = [
    buildSequentialFunnel(
      'creator_journey',
      'Embudo Organizador: Captación a Diseño de Invitación',
      'Usuarios reales que entran a la plataforma, acceden a su panel, abren un evento y llegan al editor',
      [
        { key: 'entry', label: 'Entrada / Acceso a Plataforma', routeHint: '/ · /new/login · /new/register', usersSet: creatorEntrySet, avgTimeSec: routeDwellMap.get('/') || 28 },
        { key: 'panel', label: 'Ingresa al Panel Organizador', routeHint: '/new/dashboard', usersSet: creatorAuthSet, avgTimeSec: routeDwellMap.get('/new/dashboard') || 42 },
        { key: 'event', label: 'Gestiona o Crea Evento', routeHint: '/new/events/:id', usersSet: creatorEventSet, avgTimeSec: routeDwellMap.get('/new/events/:id') || 65 },
        { key: 'editor', label: 'Personaliza Invitación en Editor', routeHint: '/new/invitations/:id/visual-editor', usersSet: creatorEditorSet, avgTimeSec: routeDwellMap.get('/new/invitations/:id/visual-editor') || 150 }
      ]
    ),
    buildSequentialFunnel(
      'guest_rsvp',
      'Embudo Invitado: Apertura de Enlace a Confirmación RSVP',
      'Invitados que abren su invitación pública, leen los detalles (>50% scroll) y envían su confirmación',
      [
        { key: 'open_inv', label: 'Abre Invitación Pública', routeHint: '/new/i/:slug', usersSet: guestOpenSet, avgTimeSec: 15 },
        { key: 'scroll_inv', label: 'Explora Ubicación e Itinerario (>50% scroll)', routeHint: '/new/i/:slug', usersSet: guestReadSet, avgTimeSec: routeDwellMap.get('/new/i/:slug') || 45 },
        { key: 'rsvp_done', label: 'Envía Confirmación RSVP', routeHint: 'Formulario RSVP', usersSet: guestRsvpSet, avgTimeSec: 30 }
      ]
    ),
    buildSequentialFunnel(
      'event_operations',
      'Embudo Operativo: Evento a Mesas y Check-in QR',
      'Progresión en el uso de herramientas operativas para el día de la celebración',
      [
        { key: 'ev_detail', label: 'Configura Detalle del Evento', routeHint: '/new/events/:id', usersSet: opsDetailSet, avgTimeSec: 80 },
        { key: 'dispatch', label: 'Importa Lista / Envía WhatsApp', routeHint: 'Invitados & Comunicación', usersSet: opsDispatchSet, avgTimeSec: 70 },
        { key: 'seating', label: 'Diseña Croquis de Mesas', routeHint: '/new/events/:id/seating', usersSet: opsSeatingSet, avgTimeSec: routeDwellMap.get('/new/events/:id/seating') || 130 },
        { key: 'checkin', label: 'Opera Check-in QR / Acceso Staff', routeHint: '/new/check-in/:token', usersSet: opsCheckinSet, avgTimeSec: 45 }
      ]
    )
  ];

  // Features
  const features = featuresAgg.map((f) => {
    const uniqueUsers = (f.usersSet || []).length;
    const adoptionPct = activeUsers > 0 ? Math.min(100, Math.round((uniqueUsers / activeUsers) * 100)) : 0;
    return {
      featureKey: f._id,
      label: f.label || f._id,
      category: f.category || 'Operación',
      uses: f.uses,
      uniqueUsers,
      adoptionPct,
      recommendation:
        adoptionPct >= 45
          ? 'Alta adopción: mantener flujo directo y monitorear velocidad.'
          : adoptionPct >= 18
          ? 'Adopción media: destacar acceso contextual en el panel.'
          : 'Oportunidad de crecimiento: guiar mediante tooltip o tutorial.'
    };
  });

  // UX Incidents
  const uxIncidents = uxAgg.map((u, idx) => {
    const ev = u._id.event;
    const type = ev === 'ux_dead_click' ? 'dead_click' : ev === 'ux_form_abandoned' ? 'form_abandon' : 'rage_click';
    const mobilePct = u.occurrences > 0 ? Math.round(((u.mobileHits || 0) / u.occurrences) * 100) : 0;
    return {
      id: `ux-${idx}`,
      type,
      route: u._id.route || '/',
      routeLabel: u.routeLabel || u._id.route || '/',
      pageSection: u.pageSection || '',
      targetLabel: u._id.target || 'Elemento UI',
      selector: u.selector || 'DOM',
      occurrences: u.occurrences,
      affectedUsers: (u.usersSet || []).length,
      deviceSplit: `${mobilePct}% Móvil · ${100 - mobilePct}% Desktop`,
      lastSeen: u.lastSeen,
      severity: u.occurrences >= 6 || type === 'rage_click' ? 'alta' : u.occurrences >= 3 ? 'media' : 'baja',
      diagnosis:
        type === 'rage_click'
          ? 'Clics repetidos rápidos: agregar spinner inmediato o revisar bloqueo/latencia de la acción.'
          : type === 'dead_click'
          ? 'Toques sin reacción: el usuario cree que es un botón o filtro interactivo.'
          : 'El usuario abandonó el formulario tras interactuar con este campo.'
    };
  });

  // Form Abandonments
  const formAbandonments = formStatsAgg.map((fa) => {
    const starts = (fa.abandoned || 0) + (fa.submitted || 0);
    const abandonRatePct = starts > 0 ? Math.round((fa.abandoned / starts) * 100) : 100;
    return {
      formName: fa._id.formName,
      route: fa._id.route || '/',
      starts,
      abandoned: fa.abandoned,
      submitted: fa.submitted || 0,
      abandonRatePct,
      lastTouchedField: fa.lastField || 'Campo del formulario',
      avgTimeBeforeExitSec: Math.round(fa.avgTimeSec || 20)
    };
  });

  // Devices
  const totalDevSessions = Math.max(
    1,
    devicesAgg.reduce((acc, d) => acc + (d.sessionsSet || []).length, 0)
  );
  const devices = devicesAgg.map((d) => {
    const sess = (d.sessionsSet || []).length;
    const views = Math.max(d.pageviews || 1, 1);
    return {
      device: d._id || 'Web Desktop',
      sessions: sess,
      sharePct: Math.round((sess / totalDevSessions) * 100),
      avgLoadMs: Math.round(d.avgLoadMs || 0),
      frictionRatePct: Number(Math.min(100, ((d.frictions || 0) / views) * 100).toFixed(1)),
      errorRatePct: Number(Math.min(100, ((d.errors || 0) / views) * 100).toFixed(1)),
      conversionPct: Math.min(100, Math.round(((d.conversions || 0) / Math.max(sess, 1)) * 100))
    };
  });

  const rolesBreakdown = rolesAgg.map((r) => ({
    role: r._id || 'guest',
    users: (r.usersSet || []).length,
    sessions: (r.sessionsSet || []).length,
    events: r.eventsCount || 0
  }));

  // QA Issues
  const qaIssues = qaAgg.map((q, idx) => {
    const ev = q._id.event;
    const kind =
      ev === 'qa_api_error'
        ? 'http_error'
        : ev === 'qa_slow_api'
        ? 'slow_endpoint'
        : ev === 'qa_layout_shift' || ev === 'qa_slow_lcp'
        ? 'layout_shift'
        : 'runtime_exception';

    let title = q._id.key || 'Incidencia QA';
    if (ev === 'qa_api_error' && q.statusCode !== null) {
      title = `${title} → HTTP ${q.statusCode}`;
    } else if (ev === 'qa_slow_api' && q.durationMs) {
      title = `${title} (${q.durationMs} ms)`;
    }

    return {
      id: `qa-${idx}`,
      kind,
      title,
      routeOrEndpoint: q._id.route || '/',
      pageLabel: q.routeLabel || q._id.route || '/',
      pageSection: q.pageSection || '',
      occurrences: q.occurrences,
      affectedUsers: (q.usersSet || []).length,
      statusOrCode: q.statusCode ? String(q.statusCode) : kind === 'slow_endpoint' ? `${q.durationMs || 0}ms` : 'JS',
      browserDevice: `${q.browser || 'Web'} · ${q.deviceType || 'Web'}`,
      lastBreadcrumb: q.lastBreadcrumb || '-',
      stackTop: q.stackTop || '',
      lastSeen: q.lastSeen,
      severity: kind === 'runtime_exception' || (q.statusCode && q.statusCode >= 500) ? 'critica' : q.occurrences >= 4 ? 'alta' : 'media'
    };
  });

  // API Health
  const apiHealth = apiAgg.map((a) => ({
    method: a._id.method || 'GET',
    endpoint: a._id.endpoint || '/api',
    calls: a.calls,
    avgLatencyMs: Math.round(a.avgLatencyMs || 0),
    p95LatencyMs: Math.round(a.maxLatencyMs || a.avgLatencyMs || 0),
    failures: a.failures || 0,
    errorRatePct: a.calls > 0 ? Number((((a.failures || 0) / a.calls) * 100).toFixed(1)) : 0
  }));

  const dailyTrend = trendAgg.map((t) => ({
    label: range === '24h' ? t._id : t._id.slice(5),
    dateIso: t._id,
    sessions: (t.sessionsSet || []).length,
    conversions: t.conversions || 0,
    frictions: t.frictions || 0,
    errors: t.errors || 0
  }));

  const kpis = {
    activeUsers,
    totalSessions,
    totalPageviews,
    avgDwellSeconds,
    globalConversionRate: funnels[0]?.totalCompletionRate || 0,
    uxFrictionCount: rageClicksCount + deadClicksCount + abandonedFormsCount,
    rageClicksCount,
    deadClicksCount,
    abandonedFormsCount,
    qaErrorsCount,
    apiErrorRate,
    avgApiLatencyMs
  };

  const insights = buildRoadmapInsights({
    kpis,
    funnels,
    sections,
    uxIncidents,
    qaIssues,
    exitRoutes
  });

  res.json({
    generatedAt: new Date().toISOString(),
    sourceMode: 'backend_db',
    range,
    storageStats: {
      totalStoredEvents: totalStoredAllTime,
      estimatedSizeKb: Math.round(totalStoredAllTime * 0.65),
      oldestEventAt: oldestEventDoc?.occurredAt || null,
      retentionDays: config.retentionDays,
      lastResetAt: config.lastResetAt,
      lastResetBy: config.lastResetBy
    },
    config,
    kpis,
    dailyTrend,
    funnels,
    sections,
    exitRoutes,
    subTabsUsage,
    features,
    uxIncidents,
    formAbandonments,
    devices,
    rolesBreakdown,
    qaIssues,
    apiHealth,
    insights,
    recentLiveEvents: recentEventsDocs
  });
});

module.exports = {
  getPublicConfig,
  ingestBatch,
  getAdminConfig,
  updateAdminConfig,
  resetAnalyticsData,
  getAdminDashboard
};
