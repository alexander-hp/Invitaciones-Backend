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
  roles: z.array(z.string()).max(20).optional(),
  tags: z.array(z.string()).max(30).optional(),
  relationshipLabel: z.string().optional(),
  visibilityGroup: z.string().optional(),
  tableName: z.string().optional(),
  seatLabel: z.string().optional(),
  companions: z.array(z.object({
    name: z.string().optional(),
    tableName: z.string().optional(),
    seatLabel: z.string().optional()
  }).strict()).optional(),
  allowedCompanions: z.number().int().min(0).max(20).optional()
}).strict();

const guestUpdateBody = guestBody.omit({ event: true }).partial().refine((body) => Object.keys(body).length > 0, 'Se requiere al menos un campo para actualizar');

const importBody = z.object({
  event: z.string().min(12)
}).strict();

const communicationBody = z.object({
  communicationStatus: z.enum(['pending', 'sent', 'delivered', 'read', 'opened', 'failed', 'confirmed']),
  messageType: z.enum(['invitation', 'reminder', 'event_reminder', 'location_change', 'thanks']).optional(),
  channel: z.enum(['whatsapp', 'email']).optional()
}).strict();

const emailSendBody = z.object({
  messageType: z.enum(['invitation', 'reminder', 'event_reminder', 'location_change', 'thanks']).optional()
}).strict();

const whatsappMediaBody = z.object({
  type: z.enum(['image', 'video', 'audio', 'document']),
  url: z.string().url().optional(),
  base64: z.string().min(1).optional(),
  mimetype: z.string().min(3).max(120).optional(),
  filename: z.string().max(180).optional(),
  caption: z.string().max(1024).optional()
}).strict().refine((media) => Boolean(media.url || media.base64), 'Media requiere url o base64');

const whatsappSendBody = z.object({
  messageType: z.enum(['invitation', 'reminder', 'event_reminder', 'location_change', 'thanks']),
  text: z.string().max(3000).optional(),
  media: whatsappMediaBody.optional()
}).strict();

const whatsappBulkBody = z.object({
  confirm: z.boolean(),
  messageType: z.enum(['invitation', 'reminder', 'event_reminder', 'location_change', 'thanks']),
  media: whatsappMediaBody.optional(),
  guestIds: z.array(z.string().min(12)).max(200).optional(),
  filters: z.object({
    search: z.string().optional(),
    status: z.string().optional(),
    communicationStatus: z.string().optional(),
    group: z.string().optional()
  }).strict().optional()
}).strict();

router.use(protect);
router.get('/whatsapp/status', controller.whatsappStatus);
router.get('/event/:eventId', controller.list);
router.get('/event/:eventId/export', controller.exportGuests);
router.get('/event/:eventId/whatsapp/logs', controller.listWhatsAppLogs);
router.post('/event/:eventId/whatsapp/bulk', validate(z.object({ params: z.object({ eventId: z.string().min(12) }), body: whatsappBulkBody })), controller.sendWhatsAppBulk);
router.post('/check-in', validate(z.object({ body: z.object({ code: z.string().min(4) }).strict() })), controller.checkIn);
router.post('/', validate(z.object({ body: guestBody })), controller.create);
router.patch('/:id', validate(z.object({ params: z.object({ id: z.string().min(12) }), body: guestUpdateBody })), controller.update);
router.patch('/:id/communication', validate(z.object({ params: z.object({ id: z.string().min(12) }), body: communicationBody })), controller.markCommunication);
router.post('/:id/send-email', validate(z.object({ params: z.object({ id: z.string().min(12) }), body: emailSendBody })), controller.sendEmail);
router.post('/:id/whatsapp', validate(z.object({ params: z.object({ id: z.string().min(12) }), body: whatsappSendBody })), controller.sendWhatsApp);
router.delete('/:id', validate(z.object({ params: z.object({ id: z.string().min(12) }) })), controller.remove);
router.post('/import', upload.single('file'), validate(z.object({ body: importBody })), controller.importGuests);

module.exports = router;
