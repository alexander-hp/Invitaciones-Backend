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
  tableName: z.string().optional(),
  seatLabel: z.string().optional(),
  allowedCompanions: z.number().int().min(0).max(20).optional()
}).strict();

const guestUpdateBody = guestBody.omit({ event: true }).partial().refine((body) => Object.keys(body).length > 0, 'Se requiere al menos un campo para actualizar');

const importBody = z.object({
  event: z.string().min(12)
}).strict();

const communicationBody = z.object({
  communicationStatus: z.enum(['pending', 'sent', 'confirmed']),
  messageType: z.enum(['invitation', 'reminder', 'location_change', 'thanks']).optional(),
  channel: z.enum(['whatsapp', 'email']).optional()
}).strict();

router.use(protect);
router.get('/event/:eventId', controller.list);
router.get('/event/:eventId/export', controller.exportGuests);
router.post('/check-in', validate(z.object({ body: z.object({ code: z.string().min(4) }).strict() })), controller.checkIn);
router.post('/', validate(z.object({ body: guestBody })), controller.create);
router.patch('/:id', validate(z.object({ params: z.object({ id: z.string().min(12) }), body: guestUpdateBody })), controller.update);
router.patch('/:id/communication', validate(z.object({ params: z.object({ id: z.string().min(12) }), body: communicationBody })), controller.markCommunication);
router.delete('/:id', validate(z.object({ params: z.object({ id: z.string().min(12) }) })), controller.remove);
router.post('/import', upload.single('file'), validate(z.object({ body: importBody })), controller.importGuests);

module.exports = router;
