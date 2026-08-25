const mongoose = require('mongoose');

const customTemplateSubmissionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', index: true },
  invitation: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation' },
  eventId: { type: String, trim: true, index: true },
  eventTitle: { type: String, trim: true },
  eventSlug: { type: String, trim: true, index: true },
  eventType: { type: String, enum: ['boda', 'xv', 'graduacion', 'cumpleanos', 'bautizo', 'otro'], default: 'otro' },
  invitationId: { type: String, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  htmlCode: { type: String, required: true },
  cssCode: { type: String, default: '' },
  authorName: { type: String, trim: true },
  authorEmail: { type: String, trim: true },
  notes: { type: String, trim: true },
  score: { type: Number, default: 90 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  adminFeedback: { type: String, trim: true },
  publicUrl: { type: String, trim: true },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('CustomTemplateSubmission', customTemplateSubmissionSchema);
