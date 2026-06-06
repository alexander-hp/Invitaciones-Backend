const express = require('express');
const controller = require('../controllers/templateController');
const { protect, requireRole } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();

const templateBody = z.object({
  name: z.string().min(2),
  eventType: z.enum(['boda', 'xv', 'graduacion', 'cumpleanos', 'bautizo', 'otro']),
  tier: z.enum(['free', 'premium']).optional(),
  previewImageUrl: z.string().url().optional().or(z.literal('')),
  config: z.record(z.any()).optional(),
  active: z.boolean().optional()
}).strict();

router.get('/', controller.list);
router.post('/', protect, requireRole('admin'), validate(z.object({ body: templateBody })), controller.create);

module.exports = router;