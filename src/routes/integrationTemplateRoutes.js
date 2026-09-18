const express = require('express');
const controller = require('../controllers/integrationTemplateController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');
const { INTEGRATION_MODES, INTEGRATION_STACKS, INTEGRATION_MODULES } = require('../models/IntegrationTemplate');

const router = express.Router();
router.use(protect);

const configuration = {
  mode: z.enum(INTEGRATION_MODES).optional(),
  stack: z.enum(INTEGRATION_STACKS).optional(),
  modules: z.array(z.enum(INTEGRATION_MODULES)).min(1).max(INTEGRATION_MODULES.length).optional(),
  instructions: z.string().max(4000).optional()
};
const createBody = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  ...configuration
}).strict();
const updateBody = createBody.partial().refine((body) => Object.keys(body).length > 0, 'Se requiere al menos un campo');
const previewBody = z.object({
  eventId: z.string().min(12),
  templateId: z.string().min(12).optional(),
  ...configuration
}).strict();

router.get('/', controller.list);
router.post('/preview', validate(z.object({ body: previewBody })), controller.preview);
router.post('/', validate(z.object({ body: createBody })), controller.create);
router.patch('/:id', validate(z.object({ body: updateBody })), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
