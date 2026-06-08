const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/rsvpController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const publicRsvpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const publicRsvpBody = z.object({
  guest: z.string().min(12).optional(),
  name: z.string().min(2),
  email: z.string().email().optional(),
  response: z.enum(['confirmed', 'declined', 'maybe']),
  companions: z.number().int().min(0).optional(),
  mealPreference: z.string().optional(),
  message: z.string().optional(),
  declineConfirmed: z.boolean().optional(),
  phoneCountryCode: z.string().regex(/^\+\d{1,4}$/, 'Codigo de pais invalido').optional(),
  phoneNationalNumber: z.string().regex(/^\d+$/, 'Numero de telefono invalido').min(6).max(15).optional()
}).strict();

router.post('/public/:slug', publicRsvpLimiter, validate(z.object({ body: publicRsvpBody })), controller.submitPublic);
router.get('/event/:eventId', protect, controller.listByEvent);
router.get('/event/:eventId/export', protect, controller.exportByEvent);

module.exports = router;
