const express = require('express');
const multer = require('multer');
const controller = require('../controllers/guestController');
const { protect } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.use(protect);
router.get('/event/:eventId', controller.list);
router.post('/', controller.create);
router.post('/import', upload.single('file'), controller.importGuests);

module.exports = router;
