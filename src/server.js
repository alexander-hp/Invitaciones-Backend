const app = require('./app');
const { connectDatabase } = require('./config/database');
const env = require('./config/env');

async function bootstrap() {
  await connectDatabase();
  app.listen(env.port, () => {
    console.log(`Invitaciones API listening on http://localhost:${env.port}/api`);
  });
}

bootstrap().catch((error) => {
  console.error('API failed to start', error);
  process.exit(1);
});
