const express = require('express');
const controller = require('../controllers/assetController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const mediaTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf'];

const uploadUrlBody = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.enum(mediaTypes),
  folder: z.enum(['covers', 'gallery', 'music', 'assets', 'whatsapp-media']).optional(),
  event: z.string().min(12).optional(),
  size: z.number().int().positive().max(25 * 1024 * 1024).optional()
}).strict();

const inspectUrlBody = z.object({
  url: z.string().url().refine((url) => /^https?:\/\//i.test(url), 'URL debe iniciar con http o https')
}).strict();

const whatsappMediaBody = z.object({
  key: z.string().min(1).max(500),
  url: z.string().url(),
  type: z.enum(['image', 'video', 'audio', 'document']),
  fileName: z.string().min(1).max(180),
  mimetype: z.enum(mediaTypes),
  size: z.number().int().positive().max(25 * 1024 * 1024).optional(),
  caption: z.string().max(1024).optional()
}).strict();

const imageSearchQuery = z.object({
  q: z.string().trim().min(2).max(100),
  page: z.coerce.number().int().min(1).max(100).optional(),
  orientation: z.enum(['landscape', 'portrait', 'squarish']).optional()
}).strict();

router.post('/inspect-url', protect, validate(z.object({ body: inspectUrlBody })), controller.inspectUrl);
router.get('/export-image', protect, validate(z.object({ query: z.object({ url: z.string().url() }).strict() })), controller.exportImage);
router.post('/upload-url', protect, validate(z.object({ body: uploadUrlBody })), controller.createUploadUrl);
router.get('/search-images', protect, validate(z.object({ query: imageSearchQuery })), controller.searchImages);
router.post('/track-web-image', protect, validate(z.object({ body: z.object({ downloadLocation: z.string().url() }).strict() })), controller.trackWebImage);
router.get('/events/:eventId/whatsapp-media', protect, validate(z.object({ params: z.object({ eventId: z.string().min(12) }) })), controller.listWhatsAppMedia);
router.post('/events/:eventId/whatsapp-media', protect, validate(z.object({ params: z.object({ eventId: z.string().min(12) }), body: whatsappMediaBody })), controller.createWhatsAppMedia);
router.delete('/events/:eventId/whatsapp-media/:assetId', protect, validate(z.object({ params: z.object({ eventId: z.string().min(12), assetId: z.string().min(12) }) })), controller.deleteWhatsAppMedia);
module.exports = router;
