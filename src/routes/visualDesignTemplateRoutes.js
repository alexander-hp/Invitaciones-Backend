const express = require('express');
const controller = require('../controllers/visualDesignTemplateController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const styleValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const visualLayout = z.object({
  x: z.number().min(0).max(100), y: z.number().min(0).max(100),
  width: z.number().min(1).max(100), height: z.number().min(1).max(100),
  rotation: z.number().min(-360).max(360).optional()
}).strict();
const visualDesign = z.object({
  version: z.number().int().min(1).max(10),
  active: z.boolean(),
  mode: z.enum(['easy', 'advanced']),
  responsiveMode: z.enum(['shared', 'independent']).optional(),
  sections: z.array(z.object({
    id: z.string().min(1).max(100), type: z.string().min(1).max(80), title: z.string().max(160).optional(),
    enabled: z.boolean(), layout: z.enum(['flow', 'canvas']), height: z.number().int().min(240).max(1600),
    background: z.object({ color: z.string().max(40).optional(), imageUrl: z.string().max(2000).optional(), overlay: z.number().min(0).max(1).optional() }).strict().optional(),
    layers: z.array(z.object({
      id: z.string().min(1).max(100), type: z.enum(['text', 'image', 'video', 'audio', 'button', 'shape']),
      groupId: z.string().min(1).max(100).optional(),
      name: z.string().max(120).optional(),
      text: z.string().max(5000).optional(), url: z.string().max(2000).optional(), binding: z.string().max(100).optional(),
      x: z.number().min(0).max(100), y: z.number().min(0).max(100), width: z.number().min(1).max(100), height: z.number().min(1).max(100),
      rotation: z.number().min(-360).max(360).optional(), zIndex: z.number().int().min(0).max(1000).optional(), locked: z.boolean().optional(), hidden: z.boolean().optional(),
      layouts: z.object({ mobile: visualLayout.optional(), tablet: visualLayout.optional(), desktop: visualLayout.optional() }).strict().optional(),
      style: z.record(z.string(), styleValue).optional()
    }).strict()).max(100)
  }).strict()).max(50)
}).strict();
const body = z.object({
  name: z.string().min(2).max(120),
  eventType: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  previewImageUrl: z.string().url().or(z.literal('')).optional(),
  design: visualDesign
}).strict();

router.use(protect);
router.get('/', controller.list);
router.post('/', validate(z.object({ body })), controller.create);
router.patch('/:id', validate(z.object({ body: body.partial().refine((value) => Object.keys(value).length > 0) })), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
