const express = require('express');
const controller = require('../controllers/visualDesignTemplateController');
const { protect, optionalAuth, requireRole } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();

const templateBody = z.object({
  name: z.string().min(2).max(120),
  authorName: z.string().max(100).optional(),
  eventType: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  previewImageUrl: z.string().max(2000).optional(),
  thumbnailUrl: z.string().max(2000).optional(),
  isPublic: z.boolean().optional(),
  authorRewardPercent: z.number().min(0).max(100).optional(),
  includesInvitation: z.boolean().optional(),
  includesPass: z.boolean().optional(),
  includesAccess: z.boolean().optional(),
  design: z.any(),
  passDesign: z.any().optional(),
  accessScreen: z.any().optional(),
  tags: z.array(z.string().max(50)).max(20).optional()
}).passthrough();

// Public / Community Catalog routes
router.get('/catalog', optionalAuth, controller.catalog);
router.post('/:id/use', optionalAuth, controller.useTemplate);

// Protected routes (user's personal templates and publishing)
router.use(protect);

// Admin Moderation & Management routes (Placed before /:id)
router.get('/admin/settings', requireRole('admin'), controller.getAdminSettings);
router.put('/admin/settings', requireRole('admin'), controller.updateAdminSettings);
router.get('/admin/manage', requireRole('admin'), controller.adminList);
router.get('/admin/usages', requireRole('admin'), controller.adminListUsages);
router.patch('/admin/usages/:usageId/payout', requireRole('admin'), controller.adminUpdateUsagePayout);
router.patch('/admin/:id/status', requireRole('admin'), controller.adminUpdateStatus);

router.get('/', controller.list);
router.post('/', validate(z.object({ body: templateBody })), controller.create);
router.patch('/:id', validate(z.object({ body: templateBody.partial().refine((value) => Object.keys(value).length > 0) })), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
