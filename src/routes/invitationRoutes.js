const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const albumController = require('../controllers/albumController');
const controller = require('../controllers/invitationController');
const dedicationController = require('../controllers/dedicationController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const publicInvitationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
const guestAccessLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const albumUploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const optionalHttpUrl = z.string().url().refine((url) => /^https?:\/\//i.test(url), 'URL debe iniciar con http o https').or(z.literal('')).optional();
const invitationContentBody = z.object({
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  message: z.string().optional(),
  palette: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional()
  }).optional(),
  musicUrl: z.string().optional(),
  coverImageUrl: z.string().optional(),
  gallery: z.array(z.string()).optional(),
  itinerary: z.array(z.object({
    time: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional()
  }).strict()).optional(),
  locations: z.array(z.object({
    type: z.string().optional(),
    name: z.string().optional(),
    address: z.string().optional(),
    mapUrl: optionalHttpUrl,
    wazeUrl: optionalHttpUrl,
    notes: z.string().optional()
  }).strict()).max(12).optional(),
  dressCode: z.string().optional(),
  giftRegistry: z.array(z.object({
    store: z.string().optional(),
    title: z.string().optional(),
    label: z.string().optional(),
    url: z.string().url().or(z.literal('')).optional(),
    imageUrl: z.string().url().or(z.literal('')).optional(),
    note: z.string().optional(),
    priority: z.number().int().optional()
  }).strict()).optional(),
  digitalEnvelope: z.object({
    bank: z.string().optional(),
    account: z.string().optional(),
    clabe: z.string().optional(),
    holder: z.string().optional(),
    note: z.string().optional(),
    qrImageUrl: z.string().url().or(z.literal('')).optional()
  }).strict().optional(),
  giftSettings: z.object({
    enabled: z.boolean().optional(),
    introText: z.string().max(600).optional(),
    showRegistry: z.boolean().optional(),
    showEnvelope: z.boolean().optional()
  }).strict().optional(),
  dedicationSettings: z.object({
    enabled: z.boolean().optional(),
    requireApproval: z.boolean().optional(),
    introText: z.string().max(600).optional()
  }).strict().optional(),
  brandLogoUrl: z.string().url().or(z.literal('')).optional(),
  hideBranding: z.boolean().optional(),
  lodging: z.array(z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    url: z.string().url().or(z.literal('')).optional()
  }).strict()).optional(),
  privateAlbum: z.array(z.string()).optional(),
  privateAlbumEnabled: z.boolean().optional()
}).strict();
const rsvpSettingsBody = z.object({
  deadline: z.string().datetime().or(z.string().min(1)).or(z.date()).optional(),
  allowMaybe: z.boolean().optional(),
  allowChangesUntilDeadline: z.boolean().optional(),
  declineRequiresConfirmation: z.boolean().optional(),
  reminderDaysBeforeDeadline: z.number().int().min(0).max(60).optional(),
  customQuestions: z.array(z.object({
    key: z.string().min(1).optional(),
    label: z.string().min(1),
    type: z.enum(['text', 'textarea', 'select', 'boolean']).optional(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional()
  }).strict()).max(20).optional()
}).strict();
const invitationCreateBody = z.object({
  event: z.string().min(12),
  template: z.string().min(12).optional(),
  slug: z.string().min(1).optional(),
  accessMode: z.enum(['open', 'guest_list']).optional(),
  rsvpSettings: rsvpSettingsBody.optional(),
  content: invitationContentBody.optional()
}).strict();
const invitationUpdateBody = z.object({
  template: z.string().min(12).optional(),
  slug: z.string().min(1).optional(),
  accessMode: z.enum(['open', 'guest_list']).optional(),
  rsvpSettings: rsvpSettingsBody.optional(),
  content: invitationContentBody.optional()
}).strict().refine((body) => Object.keys(body).length > 0, 'Se requiere al menos un campo para actualizar');
const dedicationBody = z.object({
  guest: z.string().min(12).optional(),
  publicName: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  message: z.string().min(2).max(1000),
  type: z.enum(['dedication', 'wish', 'memory', 'toast']).optional(),
  visibility: z.enum(['public', 'hosts_only']).optional()
}).strict();

router.get('/public/:slug', publicInvitationLimiter, controller.publicBySlug);
router.get('/public/:slug/album', publicInvitationLimiter, albumController.publicApproved);
router.get('/public/:slug/dedications', publicInvitationLimiter, dedicationController.listInvitationPublic);
router.get('/public/:slug/guest-token/:token', guestAccessLimiter, controller.guestByToken);
router.post('/public/:slug/guest-access', guestAccessLimiter, validate(z.object({ body: z.object({ email: z.string().email() }).strict() })), controller.guestAccess);
router.post('/public/:slug/album-upload', albumUploadLimiter, upload.single('file'), albumController.uploadPublic);
router.post('/public/:slug/dedications', publicInvitationLimiter, validate(z.object({ body: dedicationBody })), dedicationController.createInvitationPublic);
router.use(protect);
router.get('/', controller.list);
router.post('/', validate(z.object({ body: invitationCreateBody })), controller.create);
router.patch('/:id', validate(z.object({ body: invitationUpdateBody })), controller.update);
router.post('/:id/publish', controller.publish);
router.post('/:id/unpublish', controller.unpublish);

module.exports = router;
