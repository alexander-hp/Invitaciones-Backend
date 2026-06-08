const express = require('express');
const controller = require('../controllers/assetController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();

const uploadUrlBody = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/mp3', 'audio/wav']),
  folder: z.enum(['covers', 'gallery', 'music', 'assets']).optional(),
  size: z.number().int().positive().max(10 * 1024 * 1024).optional()
}).strict();

router.post('/upload-url', protect, validate(z.object({ body: uploadUrlBody })), controller.createUploadUrl);
module.exports = router;
