const express = require('express');
const controller = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.post('/checkout', protect, controller.createCheckout);
router.post('/webhook', controller.webhook);
module.exports = router;
