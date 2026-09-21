const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const albumController = require('../controllers/albumController');
const controller = require('../controllers/invitationController');
const dedicationController = require('../controllers/dedicationController');
const songRequestController = require('../controllers/songRequestController');
const visualDesignRevisionController = require('../controllers/visualDesignRevisionController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const env = require('../config/env');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const publicInvitationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false, skip: () => env.nodeEnv !== 'production' });
const guestAccessLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, standardHeaders: true, legacyHeaders: false, skip: () => env.nodeEnv !== 'production' });
const albumUploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false, skip: () => env.nodeEnv !== 'production' });
const optionalHttpUrl = z.string().url().refine((url) => /^https?:\/\//i.test(url), 'URL debe iniciar con http o https').or(z.literal('')).optional();
const visualLayoutBody = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  rotation: z.number().min(-360).max(360).optional()
}).strict();
const visualLayerBody = z.object({
  id: z.string().min(1).max(100),
  groupId: z.string().min(1).max(100).optional(),
  type: z.enum(['text', 'image', 'video', 'audio', 'button', 'shape']),
  name: z.string().max(120).optional(),
  text: z.string().max(5000).optional(),
  url: z.string().max(2000).optional(),
  binding: z.string().max(100).optional(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  rotation: z.number().min(-360).max(360).optional(),
  zIndex: z.number().int().min(0).max(1000).optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  animation: z.object({
    type: z.enum(['none', 'fade', 'slide-up', 'slide-left', 'zoom', 'float']),
    duration: z.number().min(0.2).max(10).optional(),
    delay: z.number().min(0).max(10).optional(),
    repeat: z.boolean().optional()
  }).strict().optional(),
  layouts: z.object({
    mobile: visualLayoutBody.optional(),
    tablet: visualLayoutBody.optional(),
    desktop: visualLayoutBody.optional()
  }).strict().optional(),
  style: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
}).strict();
const visualModuleStyleBody = z.object({
  layout: z.enum(['list', 'grid']).optional(),
  columns: z.number().int().min(1).max(3).optional(),
  alignment: z.enum(['left', 'center']).optional(),
  surface: z.enum(['transparent', 'solid', 'soft']).optional(),
  cardStyle: z.enum(['none', 'bordered', 'elevated']).optional(),
  gap: z.number().int().min(4).max(32).optional(),
  showTitle: z.boolean().optional()
}).strict();
const visualDesignBody = z.object({
  version: z.number().int().min(1).max(10),
  active: z.boolean(),
  mode: z.enum(['easy', 'advanced']),
  responsiveMode: z.enum(['shared', 'independent']).optional(),
  theme: z.object({
    backgroundColor: z.string().max(40),
    textColor: z.string().max(40),
    accentColor: z.string().max(40),
    headingFont: z.string().max(120),
    bodyFont: z.string().max(120),
    buttonBackgroundColor: z.string().max(40),
    buttonTextColor: z.string().max(40),
    buttonStyle: z.enum(['solid', 'outline', 'soft']),
    buttonRadius: z.number().min(0).max(100)
  }).strict().optional(),
  assets: z.array(z.object({
    id: z.string().min(1).max(100),
    url: z.string().url().max(2000),
    type: z.enum(['image', 'video', 'audio']),
    name: z.string().min(1).max(200),
    attribution: z.string().max(200).optional(),
    attributionUrl: z.string().url().max(2000).optional(),
    sourceUrl: z.string().url().max(2000).optional(),
    createdAt: z.string().datetime().optional()
  }).strict()).max(200).optional(),
  sections: z.array(z.object({
    id: z.string().min(1).max(100),
    type: z.string().min(1).max(80),
    title: z.string().max(160).optional(),
    enabled: z.boolean(),
    layout: z.enum(['flow', 'canvas']),
    height: z.number().int().min(240).max(1600),
    background: z.object({
      color: z.string().max(40).optional(),
      imageUrl: z.string().max(2000).optional(),
      overlay: z.number().min(0).max(1).optional()
    }).strict().optional(),
    moduleStyle: visualModuleStyleBody.optional(),
    layers: z.array(visualLayerBody).max(100)
  }).strict()).max(50)
}).strict();
const invitationContentBody = z.object({
  template: z.string().optional(),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  message: z.string().optional(),
  storyTitle: z.string().optional(),
  storyBody: z.string().optional(),
  palette: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional()
  }).optional(),
  musicUrl: z.string().optional(),
  sectionMusic: z.record(z.string(), z.string()).optional(),
  coverImageUrl: z.string().optional(),
  gallery: z.array(z.string()).optional(),
  galleryItems: z.array(z.object({
    id: z.string().max(100).optional(),
    url: z.string().url().or(z.literal('')),
    title: z.string().max(160).optional(),
    description: z.string().max(1000).optional(),
    dedication: z.string().max(1000).optional(),
    alt: z.string().max(240).optional(),
    fit: z.enum(['cover', 'contain']).optional(),
    focalX: z.number().min(0).max(100).optional(),
    focalY: z.number().min(0).max(100).optional()
  }).strict()).max(100).optional(),
  gallerySettings: z.object({
    displayMode: z.enum(['grid', 'list', 'carousel']).optional(),
    showCaptions: z.boolean().optional(),
    autoplay: z.boolean().optional(),
    intervalSeconds: z.number().int().min(2).max(30).optional()
  }).strict().optional(),
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
  dressCodeDescription: z.string().optional(),
  dressCodeImageUrl: z.string().optional(),
  dressCodeOptions: z.array(z.object({
    title: z.string().optional(),
    description: z.string().optional()
  })).optional(),
  dressCodeWomen: z.string().optional(),
  dressCodeMen: z.string().optional(),
  dressCodeOption1: z.string().optional(),
  dressCodeOption2: z.string().optional(),
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
  songRequestSettings: z.object({
    enabled: z.boolean().optional(),
    maxRequestsPerGuest: z.number().int().min(1).max(20).optional(),
    allowDedications: z.boolean().optional(),
    requireApproval: z.boolean().optional()
  }).strict().optional(),
  dedicationSettings: z.object({
    enabled: z.boolean().optional(),
    requireApproval: z.boolean().optional(),
    introText: z.string().max(600).optional()
  }).strict().optional(),
  moderationSettings: z.object({
    notifyOnReview: z.boolean().optional(),
    autoApproveRoles: z.array(z.string()).max(50).optional(),
    autoApproveGroups: z.array(z.string()).max(100).optional(),
    autoApproveEmails: z.array(z.string().email()).max(1000).optional(),
    autoApprovePhones: z.array(z.string().min(6).max(30)).max(1000).optional(),
    autoApproveAlbum: z.boolean().optional(),
    autoApproveSongs: z.boolean().optional(),
    autoApproveDedications: z.boolean().optional()
  }).strict().optional(),
  brandLogoUrl: z.string().url().or(z.literal('')).optional(),
  hideBranding: z.boolean().optional(),
  sectionSettings: z.object({
    story: z.boolean().optional(),
    locations: z.boolean().optional(),
    itinerary: z.boolean().optional(),
    dressCode: z.boolean().optional(),
    rsvp: z.boolean().optional(),
    giftRegistry: z.boolean().optional(),
    digitalEnvelope: z.boolean().optional(),
    lodging: z.boolean().optional(),
    gallery: z.boolean().optional(),
    guestAlbum: z.boolean().optional(),
    dedications: z.boolean().optional(),
    backgroundMusic: z.boolean().optional(),
    songRequests: z.boolean().optional()
  }).strict().optional(),
  lodging: z.array(z.object({
    name: z.string().max(160).optional(),
    description: z.string().max(1200).optional(),
    url: z.string().url().or(z.literal('')).optional(),
    imageUrl: z.string().url().or(z.literal('')).optional(),
    address: z.string().max(500).optional(),
    phone: z.string().max(40).optional(),
    mapUrl: z.string().url().or(z.literal('')).optional(),
    agreementLabel: z.string().max(200).optional(),
    discountCode: z.string().max(100).optional(),
    discountDescription: z.string().max(500).optional(),
    priceLabel: z.string().max(200).optional(),
    services: z.array(z.string().max(120)).max(30).optional(),
    notes: z.string().max(1000).optional(),
    priority: z.number().int().min(0).max(1000).optional()
  }).strict()).max(30).optional(),
  privateAlbum: z.array(z.string()).optional(),
  privateAlbumEnabled: z.boolean().optional(),
  visualDesign: visualDesignBody.optional(),
  template: z.string().optional(),
  customHtml: z.string().optional(),
  customCss: z.string().optional(),
  customPageApproved: z.boolean().optional()
}).strict();
const rsvpSettingsBody = z.object({
  deadline: z.string().datetime().or(z.string().min(1)).or(z.date()).optional(),
  allowMaybe: z.boolean().optional(),
  allowChangesUntilDeadline: z.boolean().optional(),
  declineRequiresConfirmation: z.boolean().optional(),
  reminderDaysBeforeDeadline: z.number().int().min(0).max(60).optional(),
  identityMethods: z.array(z.enum(['email', 'phone'])).max(2).optional(),
  allowCompanionsDefault: z.boolean().optional(),
  defaultAllowedCompanions: z.number().int().min(0).max(50).optional(),
  maxAttendees: z.number().int().min(1).max(10000).optional(),
  allowedGuestIds: z.array(z.string().min(12)).max(1000).optional(),
  allowedRoles: z.array(z.string().min(1)).max(50).optional(),
  allowedGroups: z.array(z.string().min(1)).max(100).optional(),
  allowedEmails: z.array(z.string().email()).max(1000).optional(),
  allowedPhones: z.array(z.string().min(6).max(30)).max(1000).optional(),
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
  template: z.string().nullable().optional(),
  slug: z.string().min(1).optional(),
  accessMode: z.enum(['open', 'public', 'guest_list', 'specific_users']).optional(),
  rsvpSettings: rsvpSettingsBody.optional(),
  content: invitationContentBody.optional()
}).strict();
const invitationUpdateBody = z.object({
  template: z.string().min(12).nullable().optional(),
  slug: z.string().min(1).optional(),
  accessMode: z.enum(['open', 'public', 'guest_list', 'specific_users']).optional(),
  rsvpSettings: rsvpSettingsBody.optional(),
  content: invitationContentBody.optional()
}).strict().refine((body) => Object.keys(body).length > 0, 'Se requiere al menos un campo para actualizar');
const publicSongRequestBody = z.object({
  guest: z.string().min(12).optional(),
  requesterName: z.string().min(1).max(120).optional(),
  requesterEmail: z.string().email().optional(),
  title: z.string().min(1).max(180).optional(),
  artist: z.string().max(180).optional(),
  dedication: z.string().max(500).optional(),
  query: z.string().max(300).optional(),
  url: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
  status: z.enum(['pending', 'approved', 'played', 'rejected']).optional()
}).strict().refine((body) => body.title || body.query || body.url || body.sourceUrl, 'Se requiere canción, búsqueda o link');

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
router.post('/public/:slug/guest-access', guestAccessLimiter, validate(z.object({ body: z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).max(30).optional()
}).strict().refine((body) => body.email || body.phone, 'Email o telefono requerido') })), controller.guestAccess);
router.post('/public/:slug/album-upload', albumUploadLimiter, upload.single('file'), albumController.uploadPublic);
router.post('/public/:slug/dedications', publicInvitationLimiter, validate(z.object({ body: dedicationBody })), dedicationController.createInvitationPublic);
router.get('/public/:slug/song-requests', publicInvitationLimiter, songRequestController.listPublicByInvitation);
router.post('/public/:slug/song-requests', publicInvitationLimiter, validate(z.object({ body: publicSongRequestBody })), songRequestController.createPublicByInvitation);
router.post('/public/:slug/song-lookup', publicInvitationLimiter, songRequestController.lookupYouTubePublic);

router.use(protect);
router.get('/', controller.list);
router.post('/', validate(z.object({ body: invitationCreateBody })), controller.create);
router.get('/:id/visual-revisions', visualDesignRevisionController.list);
router.post('/:id/visual-revisions', validate(z.object({ body: z.object({
  label: z.string().trim().min(1).max(120),
  design: visualDesignBody
}).strict() })), visualDesignRevisionController.create);
router.post('/:id/visual-revisions/:revisionId/restore', visualDesignRevisionController.restore);
router.delete('/:id/visual-revisions/:revisionId', visualDesignRevisionController.remove);
router.patch('/:id', validate(z.object({ body: invitationUpdateBody })), controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/publish', controller.publish);
router.post('/:id/unpublish', controller.unpublish);

module.exports = router;
