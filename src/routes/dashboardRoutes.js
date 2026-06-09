const express = require('express');
const controller = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.get('/summary', protect, controller.summary);
router.get('/event/:eventId', protect, controller.eventSummary);
module.exports = router;
