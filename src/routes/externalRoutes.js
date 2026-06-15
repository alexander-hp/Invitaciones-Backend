const express = require('express');
const multer = require('multer');
const controller = require('../controllers/externalController');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const identifyBody = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  token: z.string().min(16).optional()
}).strict();

const rsvpBody = z.object({
  guest: z.string().min(12),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  response: z.enum(['confirmed', 'declined', 'maybe']),
  companions: z.number().int().min(0).optional(),
  companionNames: z.array(z.string()).optional(),
  dietaryRestrictions: z.string().optional(),
  mealPreference: z.string().optional(),
  menuSelection: z.string().optional(),
  customAnswers: z.array(z.object({
    key: z.string().min(1),
    label: z.string().optional(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional()
  }).strict()).optional(),
  message: z.string().optional()
}).strict();

const songBody = z.object({
  guest: z.string().min(12).optional(),
  requesterName: z.string().min(2).optional(),
  requesterEmail: z.string().email().optional(),
  title: z.string().min(1).max(180).optional(),
  artist: z.string().max(180).optional(),
  dedication: z.string().max(500).optional(),
  query: z.string().max(300).optional(),
  url: z.string().url().optional(),
  sourceUrl: z.string().url().optional()
}).strict().refine((body) => body.title || body.query || body.url || body.sourceUrl, 'Se requiere cancion, busqueda o link');

const songLookupBody = z.object({
  query: z.string().max(300).optional(),
  url: z.string().url().optional(),
  title: z.string().max(180).optional(),
  artist: z.string().max(180).optional()
}).strict().refine((body) => body.query || body.url || body.title, 'Se requiere busqueda o link');
const dedicationBody = z.object({
  guest: z.string().min(12).optional(),
  publicName: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  message: z.string().min(2).max(1000),
  type: z.enum(['dedication', 'wish', 'memory', 'toast']).optional(),
  visibility: z.enum(['public', 'hosts_only']).optional()
}).strict();

router.get('/:portalSlug/config', controller.config);
router.get('/:portalSlug/assets', controller.assets);
router.get('/:portalSlug/gifts', controller.gifts);
router.post('/:portalSlug/guest/identify', validate(z.object({ body: identifyBody })), controller.identifyGuest);
router.get('/:portalSlug/my-status', controller.myStatus);
router.post('/:portalSlug/rsvp', validate(z.object({ body: rsvpBody })), controller.rsvp);
router.get('/:portalSlug/album', controller.album);
router.post('/:portalSlug/album', upload.single('file'), controller.albumUpload);
router.get('/:portalSlug/dedications', controller.dedications);
router.post('/:portalSlug/dedications', validate(z.object({ body: dedicationBody })), controller.createDedication);
router.post('/:portalSlug/song-lookup', validate(z.object({ body: songLookupBody })), controller.songLookup);
router.post('/:portalSlug/song-requests', validate(z.object({ body: songBody })), controller.songRequest);
router.get('/:portalSlug/embed-manifest', controller.embedManifest);

module.exports = router;
