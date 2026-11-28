const express = require('express');
const controller = require('../controllers/analyticsController');
const { protect, optionalAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configuración ligera e ingesta por lotes para clientes web/móvil (incluye sendBeacon text/plain)
router.get('/public-config', optionalAuth, controller.getPublicConfig);
router.post(
  '/ingest',
  express.text({ type: 'text/plain', limit: '512kb' }),
  optionalAuth,
  controller.ingestBatch
);

// Panel exclusivo para Administradores
router.get('/admin/dashboard', protect, requireRole('admin'), controller.getAdminDashboard);
router.get('/admin/config', protect, requireRole('admin'), controller.getAdminConfig);
router.put('/admin/config', protect, requireRole('admin'), controller.updateAdminConfig);
router.delete('/admin/reset', protect, requireRole('admin'), controller.resetAnalyticsData);

module.exports = router;
