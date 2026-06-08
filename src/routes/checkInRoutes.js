const express = require('express');
const controller = require('../controllers/checkInController');
const { validate, z } = require('../utils/validate');

const router = express.Router();

router.get('/:token', controller.session);
router.post('/:token', validate(z.object({ body: z.object({ code: z.string().min(4) }).strict() })), controller.checkIn);

module.exports = router;
