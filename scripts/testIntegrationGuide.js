const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../src/app');
const env = require('../src/config/env');
const { connectDatabase } = require('../src/config/database');
const Event = require('../src/models/Event');
const IntegrationTemplate = require('../src/models/IntegrationTemplate');

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function run() {
  let server;
  let temporaryTemplateId;
  try {
    await connectDatabase();
    const event = await Event.findOne({
      mode: 'external_dashboard',
      externalPortalSlug: { $exists: true, $ne: '' }
    }).select('_id owner title');
    if (!event) throw new Error('No hay un evento external_dashboard disponible para la prueba');

    const token = jwt.sign({ sub: String(event.owner) }, env.jwtSecret, { expiresIn: '5m' });
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));

    const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const preview = await requestJson(`${baseUrl}/integration-templates/preview`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        eventId: String(event._id),
        mode: 'mixed',
        stack: 'react',
        modules: ['event', 'rsvp', 'album']
      })
    });
    if (!preview.prompt || preview.security?.includesSecrets !== false) {
      throw new Error('La vista previa no devolvió un prompt seguro');
    }

    const created = await requestJson(`${baseUrl}/integration-templates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Smoke integración',
        mode: 'api',
        stack: 'react',
        modules: ['event', 'rsvp']
      })
    });
    temporaryTemplateId = created.template?.id;
    if (!temporaryTemplateId) throw new Error('No se creó la plantilla temporal');

    const updated = await requestJson(`${baseUrl}/integration-templates/${temporaryTemplateId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: 'Smoke integración actualizada' })
    });
    if (updated.template?.name !== 'Smoke integración actualizada') {
      throw new Error('No se actualizó la plantilla temporal');
    }

    const list = await requestJson(`${baseUrl}/integration-templates`, { headers });
    if (!list.templates.some((template) => String(template.id) === String(temporaryTemplateId))) {
      throw new Error('La plantilla temporal no apareció en el listado');
    }

    await requestJson(`${baseUrl}/integration-templates/${temporaryTemplateId}`, {
      method: 'DELETE',
      headers
    });
    temporaryTemplateId = undefined;

    console.log(JSON.stringify({
      ok: true,
      event: event.title,
      promptCharacters: preview.prompt.length,
      templateCrud: true
    }, null, 2));
  } finally {
    if (temporaryTemplateId) {
      await IntegrationTemplate.deleteOne({ _id: temporaryTemplateId });
    }
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
