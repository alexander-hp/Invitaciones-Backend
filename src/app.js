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

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((req, res, next) => {
  const isExternalApi = req.path.startsWith('/api/external');
  const allowedOrigins = new Set([
    env.clientUrl,
    env.frontendUrl,
    ...env.externalAllowedOrigins
  ].filter(Boolean));
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (origin === 'null' && env.nodeEnv !== 'production') return callback(null, true);
      if (origin === 'capacitor://localhost' || origin === 'ionic://localhost') return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      if (env.nodeEnv !== 'production' && (
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin) ||
        /https?:\/\/[^/]+\.(loca\.lt|ngrok-free\.app|ngrok\.io|trycloudflare\.com|lhr\.life)(:\d+)?$/.test(origin)
      )) return callback(null, true);
      const error = new Error('Origen no permitido por CORS');
      error.statusCode = 403;
      return callback(error);
    }
  })(req, res, next);
});
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  skip: () => env.nodeEnv !== 'production'
}));

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
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev', {
  skip: (req) => req.originalUrl.startsWith('/api/guests/whatsapp-pass/')
}));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'invitaciones-api' }));

const http = require('http');
app.all('/api/media/*', (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const mediaPath = req.params[0];
  if (!mediaPath) return res.status(404).end();

  const queryIndex = req.url.indexOf('?');
  const queryString = queryIndex !== -1 ? req.url.slice(queryIndex) : '';
  const targetPath = '/' + mediaPath + queryString;

  const headers = { ...req.headers };
  // Crucial: MinIO signed URL was generated with Host 127.0.0.1:9000
  headers.host = '127.0.0.1:9000';
  delete headers.authorization;
  delete headers.cookie;

  const proxyReq = http.request({
    host: '127.0.0.1',
    port: 9000,
    method: req.method,
    path: targetPath,
    headers: headers
  }, (proxyRes) => {
    const resHeaders = {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': 'ETag, Location',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    };
    if (proxyRes.statusCode >= 400 && req.method === 'GET') {
      return res.status(proxyRes.statusCode).end();
    }
    res.writeHead(proxyRes.statusCode, resHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.warn('Media proxy error:', err.message);
    if (!res.headersSent) res.status(502).json({ message: 'Error de conexión con el servidor de medios.' });
  });

  if (['GET', 'HEAD'].includes(req.method)) {
    proxyReq.end();
  } else {
    req.pipe(proxyReq);
  }
});

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
