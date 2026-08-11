const express = require('express');
const multer = require('multer');
const controller = require('../controllers/eventAccessController');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.get('/:token', controller.session);
router.post('/:token/check-in', validate(z.object({ body: z.object({ code: z.string().min(4) }).strict() })), controller.checkIn);
router.post('/:token/album', upload.single('file'), validate(z.object({
  body: z.object({
    uploaderName: z.string().max(120).optional(),
    uploaderEmail: z.string().email().optional(),
    status: z.enum(['pending', 'approved']).optional()
  }).strict()
})), controller.uploadAlbum);
router.patch('/:token/album/:assetId', validate(z.object({ body: z.object({ status: z.enum(['pending', 'approved', 'rejected']) }).strict() })), controller.updateAlbum);
router.patch('/:token/song-requests/:songRequestId', validate(z.object({
  body: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'played']).optional(),
    sortOrder: z.number().int().optional()
  }).strict().refine((body) => body.status || body.sortOrder !== undefined, 'Se requiere status o sortOrder')
})), controller.updateSong);
router.post('/:token/song-requests', validate(z.object({
  body: z.object({
    title: z.string().optional(),
    artist: z.string().optional(),
    query: z.string().optional(),
    sourceUrl: z.string().optional(),
    url: z.string().optional(),
    dedication: z.string().optional(),
    requesterName: z.string().optional()
  }).strict()
})), controller.addSong);

module.exports = router;
