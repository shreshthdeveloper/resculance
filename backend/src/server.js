require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const db = require('./config/database');
require('./models'); // ensure all schemas are registered
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');
const socketHandler = require('./socket/socketHandler');
const storageService = require('./services/storageService');
const logger = require('./utils/logger').child('server');
// mediasoup was removed — video calls now go through Jitsi (see
// frontend/src/components/VideoCallPanelJitsi.jsx and
// mobile-app/src/lib/videoCall.js). The backend has no media-server role.

const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missing = requiredEnvVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`❌ Missing required env vars: ${missing.join(', ')}`);
  console.error('Please check your .env file.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// CORS origins (comma-separated)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);
const socketAllowedOrigins = (process.env.SOCKET_CORS_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);

console.log('🔒 Express allowed origins:', allowedOrigins);
console.log('🔒 Socket allowed origins:', socketAllowedOrigins);

const io = socketIo(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (socketAllowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        return cb(null, true);
      }
      return cb(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: process.env.NODE_ENV === 'production'
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      return cb(null, true);
    }
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Legacy uploads dir — only used for serving pre-MinIO files that may still
// be referenced in old DB rows. We don't write here anymore (see
// services/storageService.js + middleware/multer*.js, both backed by MinIO).
const uploadsPath = path.join(__dirname, '..', 'uploads');
try {
  if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
} catch (e) {
  logger.warn('could not ensure legacy uploads dir', { msg: e.message });
}
app.use('/uploads', express.static(uploadsPath));

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Resulance API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

const API_VERSION = process.env.API_VERSION || 'v1';
app.use(`/api/${API_VERSION}`, routes);

socketHandler(io);
app.set('io', io);

app.use(errorHandler);
app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

const PORT = process.env.PORT || 5000;

(async function start() {
  try {
    await db.connect();
  } catch (err) {
    logger.error('MongoDB connection failed — server exiting', err);
    process.exit(1);
  }

  // Warm the MinIO connection at boot so misconfiguration shows up in logs
  // immediately instead of on the first upload. Non-fatal — if MinIO is
  // down the API still serves everything else and just returns 503 on
  // upload routes.
  if (storageService.enabled()) {
    storageService.ensureBucket()
      .then(() => logger.info('object storage ready', storageService.config()))
      .catch((err) => logger.error('object storage init failed (uploads will 503 until resolved)', err));
  } else {
    logger.warn('object storage disabled — set MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY to enable file uploads');
  }

  server.listen(PORT, () => {
    logger.info('server listening', {
      port: PORT,
      env: process.env.NODE_ENV || 'development',
      apiBase: `/api/${API_VERSION}`
    });
  });
})();

// Top-level safety nets. Without these, an unhandled rejection in any
// `.catch`-missing promise (e.g. a stray `await someThing()` without try)
// vanishes silently in Node 16+ and only the operator running locally
// sees the warning. Force them into the logger so prod alerting catches them.
process.on('unhandledRejection', (reason, promise) => {
  logger.error('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)), {
    promise: String(promise)
  });
});
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException — process will exit', err);
  // Best practice: don't keep running in an unknown state. systemd / PM2 /
  // Docker should restart us.
  setTimeout(() => process.exit(1), 100).unref();
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down');
  server.close(async () => {
    try { await db.connection.close(false); } catch (e) { logger.warn('db close failed', { msg: e.message }); }
    process.exit(0);
  });
});

module.exports = { app, io };
