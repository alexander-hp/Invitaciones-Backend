const express = require('express');
const controller = require('../controllers/contactController');
const { validate, z } = require('../utils/validate');

const router = express.Router();

const contactBody = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  message: z.string().min(10).max(3000)
}).strict();

router.post('/', validate(z.object({ body: contactBody })), controller.sendContact);

module.exports = router;