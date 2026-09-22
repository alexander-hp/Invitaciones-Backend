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
const visualModuleStyle = z.object({
  layout: z.enum(['list', 'grid']).optional(), columns: z.number().int().min(1).max(3).optional(),
  alignment: z.enum(['left', 'center']).optional(), surface: z.enum(['transparent', 'solid', 'soft']).optional(),
  cardStyle: z.enum(['none', 'bordered', 'elevated']).optional(), gap: z.number().int().min(4).max(32).optional(),
  showTitle: z.boolean().optional()
}).strict();
const visualPluginSettings = z.record(
  z.string().max(80),
  z.union([z.string().max(1000), z.number(), z.boolean()])
);
const visualDesign = z.object({
  version: z.number().int().min(1).max(10),
  active: z.boolean(),
  mode: z.enum(['easy', 'advanced']),
  responsiveMode: z.enum(['shared', 'independent']).optional(),
  theme: z.object({
    backgroundColor: z.string().max(40), textColor: z.string().max(40), accentColor: z.string().max(40),
    headingFont: z.string().max(120), bodyFont: z.string().max(120),
    buttonBackgroundColor: z.string().max(40), buttonTextColor: z.string().max(40),
    buttonStyle: z.enum(['solid', 'outline', 'soft']), buttonRadius: z.number().min(0).max(100)
  }).strict().optional(),
  assets: z.array(z.object({
    id: z.string().min(1).max(100), url: z.string().url().max(2000),
    type: z.enum(['image', 'video', 'audio']), name: z.string().min(1).max(200),
    attribution: z.string().max(200).optional(), attributionUrl: z.string().url().max(2000).optional(), sourceUrl: z.string().url().max(2000).optional(),
    createdAt: z.string().datetime().optional()
  }).strict()).max(200).optional(),
  sections: z.array(z.object({
    id: z.string().min(1).max(100), type: z.string().min(1).max(80), title: z.string().max(160).optional(),
    enabled: z.boolean(), layout: z.enum(['flow', 'canvas']), height: z.number().int().min(240).max(1600),
    background: z.object({ color: z.string().max(40).optional(), imageUrl: z.string().max(2000).optional(), overlay: z.number().min(0).max(1).optional() }).strict().optional(),
    moduleStyle: visualModuleStyle.optional(),
    pluginSettings: visualPluginSettings.optional(),
    layers: z.array(z.object({
      id: z.string().min(1).max(100), type: z.enum(['text', 'image', 'video', 'audio', 'button', 'shape']),
      groupId: z.string().min(1).max(100).optional(),
      name: z.string().max(120).optional(),
      text: z.string().max(5000).optional(), url: z.string().max(2000).optional(), binding: z.string().max(100).optional(),
      x: z.number().min(0).max(100), y: z.number().min(0).max(100), width: z.number().min(1).max(100), height: z.number().min(1).max(100),
      rotation: z.number().min(-360).max(360).optional(), zIndex: z.number().int().min(0).max(1000).optional(), locked: z.boolean().optional(), hidden: z.boolean().optional(),
      animation: z.object({ type: z.enum(['none', 'fade', 'slide-up', 'slide-left', 'zoom', 'float']), duration: z.number().min(0.2).max(10).optional(), delay: z.number().min(0).max(10).optional(), repeat: z.boolean().optional() }).strict().optional(),
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
