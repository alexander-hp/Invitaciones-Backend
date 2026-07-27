const express = require('express');
const controller = require('../controllers/eventAccessController');
const { validate, z } = require('../utils/validate');

const router = express.Router();

router.get('/:token', controller.session);
router.post('/:token/check-in', validate(z.object({ body: z.object({ code: z.string().min(4) }).strict() })), controller.checkIn);
router.patch('/:token/album/:assetId', validate(z.object({ body: z.object({ status: z.enum(['pending', 'approved', 'rejected']) }).strict() })), controller.updateAlbum);
router.patch('/:token/song-requests/:requestId', validate(z.object({ body: z.object({ status: z.enum(['pending', 'approved', 'rejected', 'played']) }).strict() })), controller.updateSongRequest);

module.exports = router;
