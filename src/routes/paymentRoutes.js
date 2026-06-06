const express = require('express');
const controller = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();

const checkoutBody = z.object({
  package: z.enum(['basic', 'premium', 'organizer']),
  invitation: z.string().min(12).optional()
}).strict();

router.post('/checkout', protect, validate(z.object({ body: checkoutBody })), controller.createCheckout);
router.post('/webhook', controller.webhook);
module.exports = router;