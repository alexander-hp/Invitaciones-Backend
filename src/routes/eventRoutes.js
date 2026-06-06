const express = require('express');
const controller = require('../controllers/eventController');
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

router.use(protect);
router.get('/', controller.list);
router.post('/', validate(z.object({ body: eventBody })), controller.create);
router.get('/:id', controller.get);
router.patch('/:id', validate(z.object({ body: eventUpdateBody })), controller.update);

module.exports = router;
