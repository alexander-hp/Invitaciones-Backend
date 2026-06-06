const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'invitaciones-api' }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
