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
const mediasoupService = require('./services/mediasoupService');

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

// Static uploads
const uploadsPath = path.join(__dirname, '..', 'uploads');
try {
  if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
  const profilesPath = path.join(uploadsPath, 'profiles');
  if (!fs.existsSync(profilesPath)) fs.mkdirSync(profilesPath, { recursive: true });
  const sessionFilesPath = path.join(uploadsPath, 'session-files');
  if (!fs.existsSync(sessionFilesPath)) fs.mkdirSync(sessionFilesPath, { recursive: true });
} catch (e) {
  console.warn('Could not ensure uploads directory:', e.message);
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
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  try {
    await mediasoupService.initialize();
    console.log('✅ Mediasoup service initialized');
  } catch (e) {
    console.error('⚠️  Mediasoup init failed:', e.message);
    console.error('Video calls will not work until mediasoup is healthy.');
  }

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api/${API_VERSION}`);
  });
})();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received: shutting down');
  server.close(async () => {
    try { await db.connection.close(false); } catch (e) { console.error(e); }
    process.exit(0);
  });
});

module.exports = { app, io };
