const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const paymentController = require('./controllers/paymentController')

const app = express();

app.use(helmet());
app.use((req, res, next) => {
  const isExternalApi = req.path.startsWith('/api/external');
  const allowedOrigins = new Set([
    env.clientUrl,
    env.frontendUrl,
    ...(isExternalApi ? env.externalAllowedOrigins : [])
  ].filter(Boolean));
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (origin === 'null' && env.nodeEnv !== 'production' && isExternalApi) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      if (env.nodeEnv !== 'production' && isExternalApi && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      const error = new Error('Origen no permitido por CORS');
      error.statusCode = 403;
      return callback(error);
    }
  })(req, res, next);
});
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.webhook
);

app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'invitaciones-api' }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
