const VisualDesignTemplate = require('../models/VisualDesignTemplate');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const templates = await VisualDesignTemplate.find({ owner: req.user._id }).sort('-updatedAt');
  res.json({ templates });
});

exports.create = asyncHandler(async (req, res) => {
  const existing = await VisualDesignTemplate.findOne({ owner: req.user._id, name: req.validated.body.name });
  if (existing) {
    Object.assign(existing, req.validated.body);
    await existing.save();
    return res.json({ template: existing });
  }
  const template = await VisualDesignTemplate.create({ ...req.validated.body, owner: req.user._id });
  res.status(201).json({ template });
});

exports.update = asyncHandler(async (req, res) => {
  const template = await VisualDesignTemplate.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    req.validated.body,
    { new: true, runValidators: true }
  );
  if (!template) {
    const error = new Error('Plantilla visual no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ template });
});

exports.remove = asyncHandler(async (req, res) => {
  const template = await VisualDesignTemplate.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!template) {
    const error = new Error('Plantilla visual no encontrada');
    error.statusCode = 404;
    throw error;
  }
  res.json({ message: 'Plantilla visual eliminada' });
});
