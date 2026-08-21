const fs = require('fs');
const path = require('path');

const backendDir = path.resolve(__dirname, '../../Invitaciones-Backend');

// 1. Update passImageService.js
const passServicePath = path.join(backendDir, 'src/services/passImageService.js');
let passContent = fs.readFileSync(passServicePath, 'utf8');

if (!passContent.includes('generatePassImageBuffer')) {
  passContent = passContent.replace(
    'async function generatePassImageBase64(html) {',
    `async function generatePassImageBuffer(html) {
  const puppeteer = await getPuppeteer();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 640, height: 900, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const element = await page.$('.pass-container');
    if (element) {
      return await element.screenshot({ type: 'png' });
    } else {
      return await page.screenshot({ type: 'png', fullPage: true });
    }
  } finally {
    await browser.close();
  }
}

async function generateBatchPassImages(items) {
  const puppeteer = await getPuppeteer();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 640, height: 900, deviceScaleFactor: 2 });

    for (const item of items) {
      await page.setContent(item.html, { waitUntil: 'networkidle0' });
      const element = await page.$('.pass-container');
      let buffer;
      if (element) {
        buffer = await element.screenshot({ type: 'png' });
      } else {
        buffer = await page.screenshot({ type: 'png', fullPage: true });
      }
      results.push({
        filename: item.filename,
        buffer
      });
    }
    return results;
  } finally {
    await browser.close();
  }
}

async function generatePassImageBase64(html) {
  const buffer = await generatePassImageBuffer(html);
  return buffer.toString('base64');
}`
  );

  passContent = passContent.replace(
    /module\.exports\s*=\s*\{[\s\S]*?\};/,
    `module.exports = {
  generatePassDataForGuest,
  generateGuestPassHtml,
  generatePassImageBase64,
  generatePassImageBuffer,
  generateBatchPassImages
};`
  );

  fs.writeFileSync(passServicePath, passContent, 'utf8');
  console.log('passImageService.js updated successfully');
}

// 2. Update guestController.js
const guestCtrlPath = path.join(backendDir, 'src/controllers/guestController.js');
let ctrlContent = fs.readFileSync(guestCtrlPath, 'utf8');

if (!ctrlContent.includes('downloadGuestPassImage')) {
  const newMethods = `
const downloadGuestPassImage = asyncHandler(async (req, res) => {
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw new ApiError(404, 'Invitado no encontrado');
  await requireEventAccess(guest.event, req.user);

  const EventModel = require('../models/Event');
  const fullEvent = await EventModel.findById(guest.event).populate('venue');
  const invitation = await Invitation.findOne({ event: guest.event });

  const passImageService = require('../services/passImageService');
  const passData = passImageService.generatePassDataForGuest({ guest, event: fullEvent, invitation });
  const passHtml = passImageService.generateGuestPassHtml(passData);
  const buffer = await passImageService.generatePassImageBuffer(passHtml);

  const safeName = guest.name.replace(/[^a-zA-Z0-9_\\-\\s]/g, '').trim().replace(/\\s+/g, '_') || 'Invitado';
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', 'attachment; filename="Pase_VIP_' + safeName + '.png"');
  res.send(buffer);
});

const downloadAllPassesZip = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  await requireEventAccess(eventId, req.user);

  const guests = await Guest.find({ event: eventId });
  if (!guests.length) throw new ApiError(404, 'No hay invitados en este evento');

  const EventModel = require('../models/Event');
  const fullEvent = await EventModel.findById(eventId).populate('venue');
  const invitation = await Invitation.findOne({ event: eventId });

  const passImageService = require('../services/passImageService');
  const JSZip = require('jszip');

  const items = guests.map(guest => {
    const passData = passImageService.generatePassDataForGuest({ guest, event: fullEvent, invitation });
    const passHtml = passImageService.generateGuestPassHtml(passData);
    const safeName = guest.name.replace(/[^a-zA-Z0-9_\\-\\s]/g, '').trim().replace(/\\s+/g, '_') || 'Invitado';
    return {
      filename: 'Pase_VIP_' + safeName + '.png',
      html: passHtml
    };
  });

  const images = await passImageService.generateBatchPassImages(items);
  const zip = new JSZip();
  for (const img of images) {
    zip.file(img.filename, img.buffer);
  }
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  const safeTitle = (fullEvent?.title || 'Evento').replace(/[^a-zA-Z0-9_\\-\\s]/g, '').trim().replace(/\\s+/g, '_');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="Pases_VIP_' + safeTitle + '.zip"');
  res.send(zipBuffer);
});
`;

  ctrlContent = ctrlContent.replace('module.exports = {', `${newMethods}\nmodule.exports = {\n  downloadGuestPassImage,\n  downloadAllPassesZip,`);
  fs.writeFileSync(guestCtrlPath, ctrlContent, 'utf8');
  console.log('guestController.js updated successfully');
}

// 3. Update guestRoutes.js
const routesPath = path.join(backendDir, 'src/routes/guestRoutes.js');
let routesContent = fs.readFileSync(routesPath, 'utf8');

if (!routesContent.includes('/pass-image')) {
  routesContent = routesContent.replace(
    "router.get('/event/:eventId/export', controller.exportGuests);",
    "router.get('/event/:eventId/export', controller.exportGuests);\nrouter.get('/:id/pass-image', validate(z.object({ params: z.object({ id: z.string().min(12) }) })), controller.downloadGuestPassImage);\nrouter.get('/event/:eventId/pass-images/zip', validate(z.object({ params: z.object({ eventId: z.string().min(12) }) })), controller.downloadAllPassesZip);"
  );
  fs.writeFileSync(routesPath, routesContent, 'utf8');
  console.log('guestRoutes.js updated successfully');
}
