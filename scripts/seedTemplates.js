const mongoose = require('mongoose');
const env = require('../src/config/env');
const Template = require('../src/models/Template');

const templates = [
  {
    name: 'Editorial Boda',
    eventType: 'boda',
    tier: 'premium',
    previewImageUrl: '',
    config: { palette: { primary: '#1f2a44', secondary: '#f7f2ea', accent: '#b67b4b' }, layout: 'editorial' },
    active: true
  },
  {
    name: 'XV Brillante',
    eventType: 'xv',
    tier: 'premium',
    previewImageUrl: '',
    config: { palette: { primary: '#34204f', secondary: '#fbf4ff', accent: '#d6a7ff' }, layout: 'celebration' },
    active: true
  },
  {
    name: 'Graduacion Clasica',
    eventType: 'graduacion',
    tier: 'free',
    previewImageUrl: '',
    config: { palette: { primary: '#203047', secondary: '#f4f6f8', accent: '#b7a15a' }, layout: 'classic' },
    active: true
  },
  {
    name: 'Cumple Alegre',
    eventType: 'cumpleanos',
    tier: 'free',
    previewImageUrl: '',
    config: { palette: { primary: '#263238', secondary: '#fff8e7', accent: '#e26d5c' }, layout: 'simple' },
    active: true
  }
];

async function main() {
  await mongoose.connect(env.mongoUri);
  for (const template of templates) {
    await Template.findOneAndUpdate(
      { name: template.name, eventType: template.eventType },
      template,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log(`Seeded ${templates.length} templates`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});