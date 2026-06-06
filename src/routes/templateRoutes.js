const express = require('express');
const controller = require('../controllers/templateController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', controller.list);
router.post('/', protect, requireRole('admin'), controller.create);

module.exports = router;
