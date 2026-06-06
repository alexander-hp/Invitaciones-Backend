const express = require('express');
const controller = require('../controllers/invitationController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const invitationContentBody = z.object({
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  message: z.string().optional(),
  palette: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional()
  }).optional(),
  musicUrl: z.string().optional(),
  coverImageUrl: z.string().optional(),
  gallery: z.array(z.string()).optional()
}).strict();
const invitationCreateBody = z.object({
  event: z.string().min(12),
  template: z.string().min(12).optional(),
  slug: z.string().min(1).optional(),
  content: invitationContentBody.optional()
}).strict();
const invitationUpdateBody = z.object({
  template: z.string().min(12).optional(),
  slug: z.string().min(1).optional(),
  content: invitationContentBody.optional()
}).strict().refine((body) => Object.keys(body).length > 0, 'Se requiere al menos un campo para actualizar');

router.get('/public/:slug', controller.publicBySlug);
router.use(protect);
router.get('/', controller.list);
router.post('/', validate(z.object({ body: invitationCreateBody })), controller.create);
router.patch('/:id', validate(z.object({ body: invitationUpdateBody })), controller.update);
router.post('/:id/publish', controller.publish);
router.post('/:id/unpublish', controller.unpublish);

module.exports = router;
