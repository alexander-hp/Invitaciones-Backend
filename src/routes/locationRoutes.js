const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/locationController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

router.get('/search', protect, limiter, validate(z.object({ query: z.object({ q: z.string().trim().min(3).max(160) }).strict() })), controller.search);
router.post('/inspect-map-url', protect, limiter, validate(z.object({ body: z.object({ url: z.string().url().max(3000) }).strict() })), controller.inspectMapUrl);

module.exports = router;
