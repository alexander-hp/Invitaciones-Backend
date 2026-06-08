const express = require('express');
const controller = require('../controllers/whatsappWebhookController');

const router = express.Router();

router.get('/meta', controller.verifyMeta);
router.post('/meta', controller.receiveMeta);
router.post('/openwa', controller.receiveOpenWa);

module.exports = router;
