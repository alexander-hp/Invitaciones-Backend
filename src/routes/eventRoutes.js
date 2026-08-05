const express = require('express');
const multer = require('multer');
const controller = require('../controllers/eventController');
const albumController = require('../controllers/albumController');
const checkInController = require('../controllers/checkInController');
const tableController = require('../controllers/tableController');
const songRequestController = require('../controllers/songRequestController');
const dedicationController = require('../controllers/dedicationController');
const { protect } = require('../middleware/auth');
const { validate, z } = require('../utils/validate');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const messageTypeBody = z.object({
  confirm: z.boolean().optional(),
  messageType: z.enum(['invitation', 'reminder', 'event_reminder', 'location_change', 'thanks']).optional(),
  guestIds: z.array(z.string().min(12)).max(200).optional()
}).strict();
const eventBody = z.object({
  mode: z.enum(['invitation', 'external_dashboard']).optional(),
  externalSiteUrl: z.string().url().optional().or(z.literal('')),
  externalSiteLabel: z.string().max(120).optional().or(z.literal('')),
  externalPortalSlug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/).optional().or(z.literal('')),
  externalPortalEnabled: z.boolean().optional(),
  externalPortalSettings: z.object({
    rsvpEnabled: z.boolean().optional(),
    albumEnabled: z.boolean().optional(),
    passEnabled: z.boolean().optional(),
    calendarEnabled: z.boolean().optional(),
    showLocation: z.boolean().optional(),
    brandLabel: z.string().max(120).optional().or(z.literal('')),
    welcomeMessage: z.string().max(600).optional().or(z.literal(''))
  }).strict().optional(),
  externalContent: z.object({
    coverImageUrl: z.string().url().optional().or(z.literal('')),
    heroImageUrl: z.string().url().optional().or(z.literal('')),
    gallery: z.array(z.string().url()).max(100).optional(),
    carousel: z.array(z.string().url()).max(30).optional(),
    spectacularImages: z.array(z.string().url()).max(30).optional(),
    musicUrl: z.string().url().optional().or(z.literal('')),
    audioSections: z.array(z.object({
      title: z.string().optional(),
      url: z.string().url(),
      description: z.string().optional()
    }).strict()).max(20).optional(),
    sectionMusic: z.record(z.string(), z.string()).optional(),
    locations: z.array(z.object({
      type: z.string().optional(),
      name: z.string().optional(),
      address: z.string().optional(),
      mapUrl: z.string().url().optional().or(z.literal('')),
      wazeUrl: z.string().url().optional().or(z.literal('')),
      notes: z.string().optional(),
      time: z.string().optional()
    }).strict()).max(20).optional(),
    sections: z.array(z.object({
      key: z.string().optional(),
      type: z.enum(['text', 'image', 'video', 'cta', 'iframe', 'timeline', 'story', 'dress_code', 'gift_registry', 'dedications', 'lodging', 'faq', 'people']).optional(),
      title: z.string().optional(),
      body: z.string().optional(),
      url: z.string().url().optional().or(z.literal('')),
      imageUrl: z.string().url().optional().or(z.literal('')),
      roles: z.array(z.string()).optional(),
      order: z.number().int().optional()
    }).strict()).max(50).optional(),
    rsvpSettings: z.object({
      deadline: z.string().optional().or(z.date()),
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
    }).strict().optional(),
    songRequestSettings: z.object({
      enabled: z.boolean().optional(),
      maxRequestsPerGuest: z.number().int().min(1).max(20).optional(),
      allowDedications: z.boolean().optional(),
      requireApproval: z.boolean().optional()
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
    giftRegistry: z.array(z.object({
      store: z.string().optional(),
      title: z.string().optional(),
      label: z.string().optional(),
      url: z.string().url().optional().or(z.literal('')),
      imageUrl: z.string().url().optional().or(z.literal('')),
      note: z.string().optional(),
      priority: z.number().int().optional()
    }).strict()).max(20).optional(),
    digitalEnvelope: z.object({
      bank: z.string().optional(),
      account: z.string().optional(),
      clabe: z.string().optional(),
      holder: z.string().optional(),
      note: z.string().optional(),
      qrImageUrl: z.string().url().optional().or(z.literal(''))
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
    }).strict().optional()
  }).strict().optional(),
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
  capacity: z.number().int().min(0).max(100),
  notes: z.string().optional(),
  order: z.number().int().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  floor: z.number().int().optional(),
  floorName: z.string().optional(),
  shape: z.string().optional(),
  width: z.number().int().min(10).max(1200).optional(),
  height: z.number().int().min(10).max(1200).optional()
}).passthrough();
const tableUpdateBody = tableBody.partial().refine((body) => Object.keys(body).length > 0, 'Se requiere al menos un campo para actualizar');
const tableAutoAssignBody = z.object({
  strategy: z.enum(['fill_order', 'by_group']).optional(),
  includeStatuses: z.array(z.enum(['pending', 'confirmed', 'declined'])).min(1).max(3).optional(),
  overwrite: z.boolean().optional()
}).strict();
const tableBatchBody = z.object({
  tables: z.array(tableBody).min(1).max(100)
}).passthrough();
const albumStatusBody = z.object({ status: z.enum(['pending', 'approved', 'rejected']) }).strict();
const songRequestStatusBody = z.object({ status: z.enum(['pending', 'approved', 'rejected', 'played']).optional(), sortOrder: z.number().int().optional() }).strict().refine((body) => body.status || body.sortOrder !== undefined, 'Se requiere status o sortOrder');
const dedicationStatusBody = z.object({ status: z.enum(['pending', 'approved', 'rejected', 'hidden']) }).strict();
const publicEmailBody = z.object({ email: z.string().email() }).strict();
const accessLinkBody = z.object({
  role: z.enum(['check_in', 'album_review', 'client_view', 'guest_ops', 'dj']),
  label: z.string().max(120).optional(),
  days: z.number().int().min(1).max(90).optional()
}).strict();
const memberPermission = z.enum([
  'view_event',
  'edit_event',
  'view_metrics',
  'manage_guests',
  'manage_tables',
  'check_in',
  'review_album',
  'review_dedications',
  'manage_songs',
  'view_payments'
]);
const memberRole = z.enum(['organizer', 'client', 'venue_owner', 'vendor', 'staff', 'dj', 'photographer']);
const memberBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional().or(z.literal('')),
  role: memberRole,
  permissions: z.array(memberPermission).min(1).max(10).optional()
}).strict();
const memberUpdateBody = z.object({
  name: z.string().min(1).max(120).optional().or(z.literal('')),
  role: memberRole.optional(),
  permissions: z.array(memberPermission).min(1).max(10).optional(),
  status: z.enum(['invited', 'active', 'disabled']).optional()
}).strict().refine((body) => Object.keys(body).length > 0, 'Se requiere al menos un campo');

router.get('/public/:portalSlug', controller.publicByPortalSlug);
router.get('/public/:portalSlug/album', albumController.publicEventApproved);
router.post('/public/:portalSlug/guest-access', validate(z.object({ body: publicEmailBody })), controller.publicGuestAccess);
router.get('/public/:portalSlug/guest-token/:token', controller.publicGuestByToken);
router.post('/public/:portalSlug/album', upload.single('file'), albumController.uploadPublicEvent);
router.use(protect);
router.get('/', controller.list);
router.post('/', validate(z.object({ body: eventBody })), controller.create);
router.get('/:id', controller.get);
router.patch('/:id', validate(z.object({ body: eventUpdateBody })), controller.update);
router.post('/:eventId/send-email', validate(z.object({ params: z.object({ eventId: z.string().min(12) }), body: messageTypeBody })), controller.sendEmailBulk);
router.post('/:eventId/check-in-link', validate(z.object({ body: checkInLinkBody })), checkInController.createLink);
router.get('/:eventId/tables', tableController.list);
router.post('/:eventId/tables/batch', validate(z.object({ body: tableBatchBody })), tableController.createBatch);
router.post('/:eventId/tables', validate(z.object({ body: tableBody })), tableController.create);
router.post('/:eventId/tables/auto-assign', validate(z.object({ body: tableAutoAssignBody })), tableController.autoAssign);
router.patch('/:eventId/tables/:tableId', validate(z.object({ body: tableUpdateBody })), tableController.update);
router.delete('/:eventId/tables/:tableId', tableController.remove);
router.get('/:eventId/album', albumController.list);
router.patch('/:eventId/album/:assetId', validate(z.object({ body: albumStatusBody })), albumController.update);
router.get('/:eventId/song-requests', songRequestController.list);
router.patch('/:eventId/song-requests/:songRequestId', validate(z.object({ body: songRequestStatusBody })), songRequestController.update);
router.get('/:eventId/dedications', dedicationController.listAdmin);
router.patch('/:eventId/dedications/:dedicationId', validate(z.object({ body: dedicationStatusBody })), dedicationController.updateAdmin);
router.get('/:eventId/access-links', controller.listAccessLinks);
router.post('/:eventId/access-links', validate(z.object({ body: accessLinkBody })), controller.createAccessLink);
router.delete('/:eventId/access-links/:linkId', controller.revokeAccessLink);
router.get('/:eventId/members', controller.listMembers);
router.post('/:eventId/members', validate(z.object({ body: memberBody })), controller.createMember);
router.patch('/:eventId/members/:memberId', validate(z.object({ body: memberUpdateBody })), controller.updateMember);
router.delete('/:eventId/members/:memberId', controller.removeMember);

module.exports = router;
