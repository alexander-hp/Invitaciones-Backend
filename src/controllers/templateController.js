const mongoose = require('mongoose');
const slugify = require('slugify');
const Template = require('../models/Template');
const CustomTemplateSubmission = require('../models/CustomTemplateSubmission');
const Event = require('../models/Event');
const Invitation = require('../models/Invitation');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));

exports.list = asyncHandler(async (req, res) => {
  const filter = { active: true };
  if (req.query.eventType) filter.eventType = req.query.eventType;
  if (req.query.tier) filter.tier = req.query.tier;
  const templates = await Template.find(filter).sort('eventType name');
  res.json({ templates });
});

exports.create = asyncHandler(async (req, res) => {
  const template = await Template.create(req.validated.body);
  res.status(201).json({ template });
});

// ── Custom Template Submissions (HTML / CSS) ──

exports.listCustomSubmissions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status && req.query.status !== 'all') {
    filter.status = req.query.status;
  }
  if (req.query.eventId) {
    filter.$or = [{ eventId: req.query.eventId }, { event: req.query.eventId }];
  } else if (req.user && req.user.role !== 'admin') {
    filter.$or = [{ owner: req.user._id }];
  }

  const submissions = await CustomTemplateSubmission.find(filter).sort('-createdAt');
  res.json({ submissions });
});

exports.getCustomSubmission = asyncHandler(async (req, res) => {
  const param = req.params.id;
  const query = isValidObjectId(param)
    ? { _id: param }
    : { $or: [{ eventId: param }, { eventSlug: param }] };
  const submission = await CustomTemplateSubmission.findOne(query);
  if (!submission) {
    const error = new Error('Solicitud de plantilla no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ submission });
});

exports.submitCustom = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  let submission;

  if (body.id && isValidObjectId(body.id)) {
    submission = await CustomTemplateSubmission.findById(body.id);
  } else if (body.eventId) {
    const eventQuery = isValidObjectId(body.eventId)
      ? { $or: [{ eventId: body.eventId }, { event: body.eventId }] }
      : { eventId: body.eventId };
    submission = await CustomTemplateSubmission.findOne(eventQuery);
  }

  if (submission) {
    Object.assign(submission, body);
    if (req.user?._id) submission.owner = req.user._id;
    submission.submittedAt = new Date();
    submission.status = 'pending';
    await submission.save();
    return res.json({ submission });
  }

  const payload = {
    ...body,
    owner: req.user?._id,
    submittedAt: new Date(),
    status: 'pending'
  };

  if (body.eventId && isValidObjectId(body.eventId)) {
    const event = await Event.findById(body.eventId).select('title externalPortalSlug type owner');
    if (event) {
      payload.event = event._id;
      payload.eventTitle = payload.eventTitle || event.title;
      payload.eventSlug = payload.eventSlug || event.externalPortalSlug || slugify(event.title, { lower: true, strict: true });
      payload.eventType = payload.eventType || event.type || 'otro';
    }
  }

  submission = await CustomTemplateSubmission.create(payload);
  res.status(201).json({ submission });
});

exports.approveCustom = asyncHandler(async (req, res) => {
  const param = req.params.id;
  const query = isValidObjectId(param)
    ? { _id: param }
    : { $or: [{ eventId: param }, { eventSlug: param }] };
  const submission = await CustomTemplateSubmission.findOne(query);
  if (!submission) {
    const error = new Error('Solicitud de plantilla no encontrada');
    error.statusCode = 404;
    throw error;
  }

  submission.status = 'approved';
  submission.reviewedAt = new Date();
  if (req.body.feedback) {
    submission.adminFeedback = req.body.feedback;
  }

  let event = null;
  if (submission.eventId && isValidObjectId(submission.eventId)) {
    event = await Event.findById(submission.eventId);
  } else if (submission.event) {
    event = await Event.findById(submission.event);
  } else if (submission.eventSlug) {
    event = await Event.findOne({ externalPortalSlug: submission.eventSlug });
  }

  // Find or create the Invitation document for this event
  let invitation = null;
  if (submission.invitation) {
    invitation = await Invitation.findById(submission.invitation);
  }
  if (!invitation && event) {
    invitation = await Invitation.findOne({ event: event._id });
  }
  if (!invitation && submission.eventSlug) {
    invitation = await Invitation.findOne({ slug: submission.eventSlug });
  }

  const targetSlug = submission.eventSlug || (invitation ? invitation.slug : (event?.externalPortalSlug || slugify(submission.eventTitle || submission.name || 'invitacion', { lower: true, strict: true })));

  if (invitation) {
    invitation.status = 'published';
    invitation.publishedAt = new Date();
    if (!invitation.content) invitation.content = {};
    invitation.content.template = 'custom-html';
    invitation.content.customHtml = submission.htmlCode;
    invitation.content.customCss = submission.cssCode || '';
    invitation.content.customPageApproved = true;
    if (!invitation.slug || invitation.slug !== targetSlug) {
      const slugTaken = await Invitation.findOne({ slug: targetSlug, _id: { $ne: invitation._id } });
      if (!slugTaken) invitation.slug = targetSlug;
    }
    await invitation.save();
  } else if (event) {
    let slug = targetSlug;
    let counter = 1;
    while (await Invitation.exists({ slug })) {
      counter += 1;
      slug = `${targetSlug}-${counter}`;
    }
    invitation = await Invitation.create({
      owner: event.owner,
      event: event._id,
      slug,
      status: 'published',
      publishedAt: new Date(),
      content: {
        headline: event.title,
        template: 'custom-html',
        customHtml: submission.htmlCode,
        customCss: submission.cssCode || '',
        customPageApproved: true
      }
    });
  } else {
    // Standalone invitation created from submission
    let slug = targetSlug;
    let counter = 1;
    while (await Invitation.exists({ slug })) {
      counter += 1;
      slug = `${targetSlug}-${counter}`;
    }
    invitation = await Invitation.create({
      owner: submission.owner,
      slug,
      status: 'published',
      publishedAt: new Date(),
      content: {
        headline: submission.eventTitle || submission.name,
        template: 'custom-html',
        customHtml: submission.htmlCode,
        customCss: submission.cssCode || '',
        customPageApproved: true
      }
    });
  }

  const publicSlug = invitation ? invitation.slug : targetSlug;
  const baseUrl = env.publicBaseUrl || 'http://localhost:4200';
  submission.publicUrl = `${baseUrl}/new/i/${publicSlug}`;
  if (invitation) {
    submission.invitation = invitation._id;
    submission.invitationId = String(invitation._id);
  }
  await submission.save();

  res.json({
    submission,
    publicUrl: submission.publicUrl,
    invitation
  });
});

exports.rejectCustom = asyncHandler(async (req, res) => {
  const param = req.params.id;
  const query = isValidObjectId(param)
    ? { _id: param }
    : { $or: [{ eventId: param }, { eventSlug: param }] };
  const submission = await CustomTemplateSubmission.findOne(query);
  if (!submission) {
    const error = new Error('Solicitud de plantilla no encontrada');
    error.statusCode = 404;
    throw error;
  }

  submission.status = 'rejected';
  submission.reviewedAt = new Date();
  if (req.body.feedback) {
    submission.adminFeedback = req.body.feedback;
  }
  await submission.save();

  res.json({ submission });
});

exports.deleteCustom = asyncHandler(async (req, res) => {
  const param = req.params.id;
  const query = isValidObjectId(param)
    ? { _id: param }
    : { $or: [{ eventId: param }, { eventSlug: param }] };
  const submission = await CustomTemplateSubmission.findOneAndDelete(query);
  if (!submission) {
    const error = new Error('Solicitud de plantilla no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ message: 'Plantilla eliminada correctamente' });
});
