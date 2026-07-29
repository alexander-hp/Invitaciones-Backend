const mongoose = require('mongoose');

const PERMISSIONS = [
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
];

const ROLE_PERMISSIONS = {
  owner: PERMISSIONS,
  organizer: ['view_event', 'edit_event', 'view_metrics', 'manage_guests', 'manage_tables', 'check_in', 'review_album', 'review_dedications', 'manage_songs'],
  client: ['view_event', 'view_metrics'],
  venue_owner: ['view_event', 'view_metrics', 'manage_tables', 'check_in'],
  vendor: ['view_event'],
  staff: ['view_event', 'check_in'],
  dj: ['view_event', 'manage_songs'],
  photographer: ['view_event', 'review_album']
};

const eventMemberSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  name: { type: String, trim: true },
  role: {
    type: String,
    enum: ['owner', 'organizer', 'client', 'venue_owner', 'vendor', 'staff', 'dj', 'photographer'],
    default: 'client',
    index: true
  },
  permissions: [{ type: String, enum: PERMISSIONS }],
  status: { type: String, enum: ['invited', 'active', 'disabled'], default: 'invited', index: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  invitedAt: { type: Date, default: Date.now },
  acceptedAt: Date,
  lastUsedAt: Date
}, { timestamps: true });

eventMemberSchema.pre('validate', function applyRolePermissions(next) {
  if (!this.permissions || this.permissions.length === 0) {
    this.permissions = ROLE_PERMISSIONS[this.role] || ROLE_PERMISSIONS.client;
  }
  next();
});

eventMemberSchema.index({ event: 1, email: 1 }, { unique: true });
eventMemberSchema.index({ event: 1, user: 1 }, { sparse: true });

module.exports = mongoose.model('EventMember', eventMemberSchema);
module.exports.PERMISSIONS = PERMISSIONS;
module.exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
