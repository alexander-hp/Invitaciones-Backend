const Template = require('../models/Template');
const asyncHandler = require('../utils/asyncHandler');

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