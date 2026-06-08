const Guest = require('../models/Guest');
const asyncHandler = require('../utils/asyncHandler');
const whatsappService = require('../services/whatsappService');
const env = require('../config/env');

function mapMetaStatus(status) {
  if (status === 'delivered') return 'delivered';
  if (status === 'read') return 'read';
  if (status === 'failed') return 'failed';
  if (status === 'sent') return 'sent';
  return 'sent';
}

async function updateGuestFromLog(log) {
  if (!log?.guest) return;
  const guest = await Guest.findById(log.guest);
  if (!guest) return;
  if (['sent', 'delivered', 'read', 'failed'].includes(log.status)) {
    guest.communicationStatus = log.status;
  }
  await guest.save();
}

exports.verifyMeta = asyncHandler(async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && token === env.whatsappWebhookVerifyToken) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

exports.receiveMeta = asyncHandler(async (req, res) => {
  if (!whatsappService.verifyMetaSignature(req)) {
    return res.sendStatus(401);
  }
  const entries = req.body?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const statuses = change.value?.statuses || [];
      for (const item of statuses) {
        const log = await whatsappService.updateMessageStatus({
          provider: 'meta',
          messageId: item.id,
          status: mapMetaStatus(item.status),
          payload: item
        });
        await updateGuestFromLog(log);
      }
    }
  }
  res.sendStatus(200);
});

exports.receiveOpenWa = asyncHandler(async (req, res) => {
  const messageId = req.body?.messageId || req.body?.id || req.body?.data?.id;
  const status = req.body?.status || req.body?.event || req.body?.data?.status || 'sent';
  const log = await whatsappService.updateMessageStatus({
    provider: 'openwa',
    messageId,
    status,
    payload: req.body
  });
  await updateGuestFromLog(log);
  res.sendStatus(200);
});
