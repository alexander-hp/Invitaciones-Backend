const express = require('express');
const auth = require('./authRoutes');
const events = require('./eventRoutes');
const invitations = require('./invitationRoutes');
const guests = require('./guestRoutes');
const rsvps = require('./rsvpRoutes');
const templates = require('./templateRoutes');
const dashboard = require('./dashboardRoutes');
const assets = require('./assetRoutes');
const payments = require('./paymentRoutes');

const router = express.Router();

router.use('/auth', auth);
router.use('/events', events);
router.use('/invitations', invitations);
router.use('/guests', guests);
router.use('/rsvps', rsvps);
router.use('/templates', templates);
router.use('/dashboard', dashboard);
router.use('/assets', assets);
router.use('/payments', payments);

module.exports = router;
