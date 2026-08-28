const slugify = require('slugify');
const geminiService = require('../services/geminiService');
const Event = require('../models/Event');
const Invitation = require('../models/Invitation');
const CustomTemplateSubmission = require('../models/CustomTemplateSubmission');
const Template = require('../models/Template');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

exports.previewPrompt = asyncHandler(async (req, res) => {
  const { eventId, invitationId, style, palette, vibe, sections, customPrompt } = req.body;
  let event = null;
  let invitation = null;

  if (invitationId) {
    invitation = await Invitation.findById(invitationId);
    if (invitation && !eventId) {
      event = await Event.findById(invitation.event);
    }
  }

  if (eventId && !event) {
    event = await Event.findById(eventId);
  }

  if (event && !invitation) {
    invitation = await Invitation.findOne({ event: event._id });
  }

  const promptPreview = geminiService.getPromptPreview({
    event,
    invitation,
    style,
    palette,
    vibe,
    sections,
    customPrompt
  });

  res.json({
    success: true,
    isPreview: true,
    promptPreview
  });
});

exports.generate = asyncHandler(async (req, res) => {
  const { eventId, invitationId, style, palette, vibe, sections, customPrompt, previewOnly } = req.body;
  let event = null;
  let invitation = null;

  if (invitationId) {
    invitation = await Invitation.findById(invitationId);
    if (invitation && !eventId) {
      event = await Event.findById(invitation.event);
    }
  }

  if (eventId && !event) {
    event = await Event.findById(eventId);
  }

  if (event && !invitation) {
    invitation = await Invitation.findOne({ event: event._id });
  }

  if (previewOnly) {
    const promptPreview = geminiService.getPromptPreview({
      event,
      invitation,
      style,
      palette,
      vibe,
      sections,
      customPrompt
    });

    return res.json({
      success: true,
      isPreview: true,
      promptPreview
    });
  }

  const generated = await geminiService.generateTemplateFromPrompt({
    event,
    invitation,
    style,
    palette,
    vibe,
    sections,
    customPrompt
  });

  res.json({
    success: true,
    template: generated
  });
});

exports.refine = asyncHandler(async (req, res) => {
  const { currentHtml, currentCss, userFeedback, eventId, invitationId } = req.body;
  if (!currentHtml || !userFeedback) {
    const error = new Error('Código HTML actual y feedback del usuario son requeridos');
    error.statusCode = 400;
    throw error;
  }

  let event = null;
  let invitation = null;

  if (invitationId) {
    invitation = await Invitation.findById(invitationId);
    if (invitation && !eventId) {
      event = await Event.findById(invitation.event);
    }
  }

  if (eventId && !event) {
    event = await Event.findById(eventId);
  }

  if (event && !invitation) {
    invitation = await Invitation.findOne({ event: event._id });
  }

  const refined = await geminiService.refineTemplate({
    currentHtml,
    currentCss: currentCss || '',
    userFeedback,
    event,
    invitation
  });

  res.json({
    success: true,
    template: refined
  });
});

exports.save = asyncHandler(async (req, res) => {
  const { invitationId, eventId, name, htmlCode, cssCode, description } = req.body;
  if (!htmlCode) {
    const error = new Error('El código HTML es requerido para guardar la plantilla');
    error.statusCode = 400;
    throw error;
  }

  let event = null;
  if (eventId) {
    event = await Event.findById(eventId);
  }

  let invitation = null;
  if (invitationId) {
    invitation = await Invitation.findById(invitationId);
  } else if (event) {
    invitation = await Invitation.findOne({ event: event._id });
  }

  const templateName = name || `Plantilla IA - ${event ? event.title : 'Especial'}`;
  const targetSlug = invitation ? invitation.slug : (event?.externalPortalSlug || slugify(templateName, { lower: true, strict: true }));

  // Update or create Invitation in MongoDB
  if (invitation) {
    invitation.status = 'published';
    invitation.publishedAt = new Date();
    invitation.content = invitation.content || {};
    invitation.content.template = 'custom-html';
    invitation.content.customHtml = htmlCode;
    invitation.content.customCss = cssCode || '';
    invitation.content.customPageApproved = true;
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
        customHtml: htmlCode,
        customCss: cssCode || '',
        customPageApproved: true
      }
    });
  }

  // Also save a CustomTemplateSubmission record with approved status for audit and hosting
  let submission = null;
  if (event || invitation) {
    submission = await CustomTemplateSubmission.create({
      owner: req.user?._id || (event ? event.owner : undefined),
      event: event ? event._id : undefined,
      invitation: invitation ? invitation._id : undefined,
      eventId: event ? String(event._id) : undefined,
      eventTitle: event ? event.title : templateName,
      eventSlug: invitation ? invitation.slug : targetSlug,
      eventType: event ? event.type : 'otro',
      name: templateName,
      description: description || 'Plantilla generada con Inteligencia Artificial Gemini',
      htmlCode,
      cssCode: cssCode || '',
      authorName: req.user ? req.user.name : 'Asistente IA Gemini',
      score: 98,
      status: 'approved',
      reviewedAt: new Date(),
      publicUrl: `${env.publicBaseUrl}/new/i/${invitation ? invitation.slug : targetSlug}`
    });
  }

  const publicUrl = `${env.publicBaseUrl}/new/i/${invitation ? invitation.slug : targetSlug}`;

  res.json({
    success: true,
    message: 'Plantilla creada con IA guardada y aplicada exitosamente',
    invitation,
    submission,
    publicUrl
  });
});
