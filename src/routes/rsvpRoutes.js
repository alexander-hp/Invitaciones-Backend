const express = require('express');
const controller = require('../controllers/rsvpController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const publicRsvpBody = z.object({
  guest: z.string().min(12).optional(),
  name: z.string().min(2),
  email: z.string().email().optional(),
  response: z.enum(['confirmed', 'declined']),
  companions: z.number().int().min(0).optional(),
  mealPreference: z.string().optional(),
  message: z.string().optional()
}).strict();

router.post('/public/:slug', validate(z.object({ body: publicRsvpBody })), controller.submitPublic);
router.get('/event/:eventId', protect, controller.listByEvent);

module.exports = router;
