require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const createApiRouter = require('./routes/api');
const { setupSocket, broadcastQueueUpdate } = require('./socket');
const { syncTokenCounter } = require('./services/queueService');

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/queue-cure';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const USE_MEMORY_DB = process.env.USE_MEMORY_DB === 'true';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'queue-cure-api' });
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const broadcast = () => broadcastQueueUpdate(io);
app.use('/api', apiLimiter, createApiRouter(broadcast));
setupSocket(io);

async function connectDatabase() {
  if (USE_MEMORY_DB) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri('queue-cure');
    await mongoose.connect(uri);
    console.log('Using in-memory MongoDB (local dev, data resets on restart)');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.warn('MongoDB unavailable, falling back to in-memory database');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri('queue-cure');
    await mongoose.connect(uri);
    console.log('In-memory MongoDB ready');
  }
}

async function start() {
  await connectDatabase();
  await syncTokenCounter();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPort ${PORT} is already in use.`);
      console.error('Another backend is already running on this port.');
      console.error(`Check: http://localhost:${PORT}/health`);
      console.error('To restart: stop the other terminal (Ctrl+C) or run:');
      console.error(`  netstat -ano | findstr :${PORT}`);
      console.error('  taskkill /PID <pid> /F\n');
    } else {
      console.error('Server error:', err.message);
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`Queue Cure API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
