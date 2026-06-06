const express = require('express');
const controller = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();

router.post('/register', validate(z.object({ body: z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: z.enum(['client', 'organizer']).optional() }) })), controller.register);
router.post('/login', validate(z.object({ body: z.object({ email: z.string().email(), password: z.string().min(1) }) })), controller.login);
router.post('/password-reset', controller.requestPasswordReset);
router.get('/me', protect, controller.me);

module.exports = router;
