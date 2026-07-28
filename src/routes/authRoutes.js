const express = require('express');
const controller = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const accountRole = z.enum(['client', 'organizer', 'venue_owner', 'vendor']);
const accountType = z.enum(['client', 'organizer', 'venue_owner', 'vendor', 'planner', 'staff']);

router.post('/register', validate(z.object({ body: z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: accountRole.optional(), accountType: accountType.optional() }) })), controller.register);
router.post('/login', validate(z.object({ body: z.object({ email: z.string().email(), password: z.string().min(1) }) })), controller.login);
router.post('/social', validate(z.object({
  body: z.object({
    provider: z.enum(['google', 'facebook', 'apple']),
    idToken: z.string().min(8).optional(),
    accessToken: z.string().min(8).optional(),
    profile: z.object({
      email: z.string().email(),
      name: z.string().min(1).optional(),
      providerUserId: z.string().min(1).optional(),
      avatarUrl: z.string().url().optional().or(z.literal(''))
    }).strict().optional(),
    role: accountRole.optional(),
    accountType: accountType.optional()
  }).strict().refine((body) => body.idToken || body.accessToken || body.profile, 'Se requiere token social o perfil de desarrollo')
})), controller.socialLogin);
router.post('/password-reset', validate(z.object({ body: z.object({ email: z.string().email() }).strict() })), controller.requestPasswordReset);
router.post('/password-reset/confirm', validate(z.object({ body: z.object({ token: z.string().min(32), password: z.string().min(8) }).strict() })), controller.confirmPasswordReset);
router.get('/me', protect, controller.me);

module.exports = router;
