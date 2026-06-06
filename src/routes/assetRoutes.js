const express = require('express');
const controller = require('../controllers/assetController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.post('/upload-url', protect, controller.createUploadUrl);
module.exports = router;
