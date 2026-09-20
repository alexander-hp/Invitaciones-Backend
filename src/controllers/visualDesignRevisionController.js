const Invitation = require('../models/Invitation');
const VisualDesignRevision = require('../models/VisualDesignRevision');
const asyncHandler = require('../utils/asyncHandler');

async function ownedInvitation(id, owner) {
  const invitation = await Invitation.findOne({ _id: id, owner });
  if (!invitation) {
    const error = new Error('Invitación no encontrada');
    error.statusCode = 404;
    throw error;
  }
  return invitation;
}

exports.list = asyncHandler(async (req, res) => {
  await ownedInvitation(req.params.id, req.user._id);
  const revisions = await VisualDesignRevision.find({ invitation: req.params.id, owner: req.user._id })
    .select('label design createdAt updatedAt')
    .sort('-createdAt')
    .limit(20);
  res.json({ revisions });
});

exports.create = asyncHandler(async (req, res) => {
  const invitation = await ownedInvitation(req.params.id, req.user._id);
  const revision = await VisualDesignRevision.create({
    owner: req.user._id,
    event: invitation.event,
    invitation: invitation._id,
    label: req.validated.body.label,
    design: req.validated.body.design
  });
  const stale = await VisualDesignRevision.find({ invitation: invitation._id, owner: req.user._id })
    .sort('-createdAt')
    .skip(20)
    .select('_id');
  if (stale.length) await VisualDesignRevision.deleteMany({ _id: { $in: stale.map((item) => item._id) } });
  res.status(201).json({ revision });
});

exports.restore = asyncHandler(async (req, res) => {
  const invitation = await ownedInvitation(req.params.id, req.user._id);
  const revision = await VisualDesignRevision.findOne({
    _id: req.params.revisionId,
    invitation: invitation._id,
    owner: req.user._id
  });
  if (!revision) {
    const error = new Error('Versión visual no encontrada');
    error.statusCode = 404;
    throw error;
  }
  invitation.content = invitation.content || {};
  invitation.content.visualDesign = revision.design;
  invitation.markModified('content.visualDesign');
  await invitation.save();
  res.json({ invitation, revision });
});

exports.remove = asyncHandler(async (req, res) => {
  await ownedInvitation(req.params.id, req.user._id);
  const revision = await VisualDesignRevision.findOneAndDelete({
    _id: req.params.revisionId,
    invitation: req.params.id,
    owner: req.user._id
  });
  if (!revision) {
    const error = new Error('Versión visual no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ message: 'Versión eliminada' });
});
