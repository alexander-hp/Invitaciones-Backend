const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/invitationController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const publicInvitationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
const guestAccessLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
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
  gallery: z.array(z.string()).optional(),
  privateAlbum: z.array(z.string()).optional(),
  privateAlbumEnabled: z.boolean().optional()
}).strict();
const rsvpSettingsBody = z.object({
  deadline: z.string().datetime().or(z.string().min(1)).or(z.date()).optional(),
  allowMaybe: z.boolean().optional(),
  allowChangesUntilDeadline: z.boolean().optional(),
  declineRequiresConfirmation: z.boolean().optional(),
  reminderDaysBeforeDeadline: z.number().int().min(0).max(60).optional()
}).strict();
const invitationCreateBody = z.object({
  event: z.string().min(12),
  template: z.string().min(12).optional(),
  slug: z.string().min(1).optional(),
  accessMode: z.enum(['open', 'guest_list']).optional(),
  rsvpSettings: rsvpSettingsBody.optional(),
  content: invitationContentBody.optional()
}).strict();
const invitationUpdateBody = z.object({
  template: z.string().min(12).optional(),
  slug: z.string().min(1).optional(),
  accessMode: z.enum(['open', 'guest_list']).optional(),
  rsvpSettings: rsvpSettingsBody.optional(),
  content: invitationContentBody.optional()
}).strict().refine((body) => Object.keys(body).length > 0, 'Se requiere al menos un campo para actualizar');

router.get('/public/:slug', publicInvitationLimiter, controller.publicBySlug);
router.post('/public/:slug/guest-access', guestAccessLimiter, validate(z.object({ body: z.object({ email: z.string().email() }).strict() })), controller.guestAccess);
router.use(protect);
router.get('/', controller.list);
router.post('/', validate(z.object({ body: invitationCreateBody })), controller.create);
router.patch('/:id', validate(z.object({ body: invitationUpdateBody })), controller.update);
router.post('/:id/publish', controller.publish);
router.post('/:id/unpublish', controller.unpublish);

module.exports = router;
