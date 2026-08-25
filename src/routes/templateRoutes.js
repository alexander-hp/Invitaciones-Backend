const express = require('express');
const controller = require('../controllers/templateController');
const aiController = require('../controllers/aiTemplateController');
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

const customSubmissionBody = z.object({
  id: z.string().optional(),
  _id: z.string().optional(),
  eventId: z.string().optional(),
  eventTitle: z.string().optional(),
  eventSlug: z.string().optional(),
  eventType: z.enum(['boda', 'xv', 'graduacion', 'cumpleanos', 'bautizo', 'otro']).optional(),
  invitationId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  htmlCode: z.string().min(1),
  cssCode: z.string().optional().default(''),
  authorName: z.string().optional(),
  authorEmail: z.string().optional(),
  notes: z.string().optional(),
  score: z.number().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional()
});

// ── Regular Templates ──
router.get('/', controller.list);
router.post('/', protect, requireRole('admin'), validate(z.object({ body: templateBody })), controller.create);

// ── Custom HTML/CSS Template Submissions ──
router.get('/custom-submissions', protect, controller.listCustomSubmissions);
router.get('/custom-submissions/:id', protect, controller.getCustomSubmission);
router.post('/custom-submissions', protect, validate(z.object({ body: customSubmissionBody })), controller.submitCustom);
router.post('/custom-submissions/:id/approve', protect, controller.approveCustom);
router.post('/custom-submissions/:id/reject', protect, controller.rejectCustom);
router.delete('/custom-submissions/:id', protect, controller.deleteCustom);

// ── AI Template Generation (Gemini / OpenAI) ──
router.post('/ai/preview-prompt', protect, aiController.previewPrompt);
router.post('/ai/generate', protect, aiController.generate);
router.post('/ai/refine', protect, aiController.refine);
router.post('/ai/save', protect, aiController.save);

module.exports = router;
