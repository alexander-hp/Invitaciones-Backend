const express = require('express');
const controller = require('../controllers/eventController');
const albumController = require('../controllers/albumController');
const checkInController = require('../controllers/checkInController');
const tableController = require('../controllers/tableController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const eventBody = z.object({
  type: z.enum(['boda', 'xv', 'graduacion', 'cumpleanos', 'bautizo', 'otro']),
  title: z.string().min(2),
  hosts: z.array(z.string()).optional(),
  date: z.string().or(z.date()),
  venue: z.object({ name: z.string().optional(), address: z.string().optional(), mapUrl: z.string().optional() }).optional(),
  agenda: z.array(z.object({ time: z.string(), title: z.string(), description: z.string().optional() })).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional()
}).strict();
const eventUpdateBody = eventBody.partial().refine((body) => Object.keys(body).length > 0, 'Se requiere al menos un campo para actualizar');
const checkInLinkBody = z.object({
  label: z.string().optional(),
  days: z.number().int().min(1).max(30).optional()
}).strict();
const tableBody = z.object({
  name: z.string().min(1),
  capacity: z.number().int().min(1).max(100),
  notes: z.string().optional(),
  order: z.number().int().optional()
}).strict();
const tableUpdateBody = tableBody.partial().refine((body) => Object.keys(body).length > 0, 'Se requiere al menos un campo para actualizar');
const albumStatusBody = z.object({ status: z.enum(['pending', 'approved', 'rejected']) }).strict();

router.use(protect);
router.get('/', controller.list);
router.post('/', validate(z.object({ body: eventBody })), controller.create);
router.get('/:id', controller.get);
router.patch('/:id', validate(z.object({ body: eventUpdateBody })), controller.update);
router.post('/:eventId/check-in-link', validate(z.object({ body: checkInLinkBody })), checkInController.createLink);
router.get('/:eventId/tables', tableController.list);
router.post('/:eventId/tables', validate(z.object({ body: tableBody })), tableController.create);
router.patch('/:eventId/tables/:tableId', validate(z.object({ body: tableUpdateBody })), tableController.update);
router.delete('/:eventId/tables/:tableId', tableController.remove);
router.get('/:eventId/album', albumController.list);
router.patch('/:eventId/album/:assetId', validate(z.object({ body: albumStatusBody })), albumController.update);

module.exports = router;
