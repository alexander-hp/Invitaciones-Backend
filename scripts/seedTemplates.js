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
    name: 'Boda Jardin Atemporal',
    eventType: 'boda',
    tier: 'free',
    previewImageUrl: '',
    config: { palette: { primary: '#244034', secondary: '#f4f7f0', accent: '#9f6f46' }, layout: 'garden' },
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
    name: 'XV Neon Gala',
    eventType: 'xv',
    tier: 'free',
    previewImageUrl: '',
    config: { palette: { primary: '#312e81', secondary: '#f8fafc', accent: '#ec4899' }, layout: 'gala' },
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
    name: 'Graduacion Magna',
    eventType: 'graduacion',
    tier: 'premium',
    previewImageUrl: '',
    config: { palette: { primary: '#111827', secondary: '#f9fafb', accent: '#d4af37' }, layout: 'ceremony' },
    active: true
  },
  {
    name: 'Cumple Alegre',
    eventType: 'cumpleanos',
    tier: 'free',
    previewImageUrl: '',
    config: { palette: { primary: '#263238', secondary: '#fff8e7', accent: '#e26d5c' }, layout: 'simple' },
    active: true
  },
  {
    name: 'Bautizo Luz',
    eventType: 'bautizo',
    tier: 'free',
    previewImageUrl: '',
    config: { palette: { primary: '#31576b', secondary: '#f6fbff', accent: '#b7d7e8' }, layout: 'soft' },
    active: true
  },
  {
    name: 'Bautizo Clasico Premium',
    eventType: 'bautizo',
    tier: 'premium',
    previewImageUrl: '',
    config: { palette: { primary: '#2f3e46', secondary: '#f8faf7', accent: '#c8b273' }, layout: 'classic-soft' },
    active: true
  },
  {
    name: 'Evento Corporativo Minimal',
    eventType: 'otro',
    tier: 'free',
    previewImageUrl: '',
    config: { palette: { primary: '#0f172a', secondary: '#f8fafc', accent: '#0ea5e9' }, layout: 'minimal' },
    active: true
  },
  {
    name: 'Evento Premium Black',
    eventType: 'otro',
    tier: 'premium',
    previewImageUrl: '',
    config: { palette: { primary: '#111111', secondary: '#f4f1ea', accent: '#c5a46d' }, layout: 'black-tie' },
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
