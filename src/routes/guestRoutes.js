const express = require('express');
const multer = require('multer');
const controller = require('../controllers/guestController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const guestBody = z.object({
  event: z.string().min(12),
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  group: z.string().optional(),
  allowedCompanions: z.number().int().min(0).max(20).optional()
}).strict();

const importBody = z.object({
  event: z.string().min(12)
}).strict();

router.use(protect);
router.get('/event/:eventId', controller.list);
router.post('/', validate(z.object({ body: guestBody })), controller.create);
router.post('/import', upload.single('file'), validate(z.object({ body: importBody })), controller.importGuests);

module.exports = router;