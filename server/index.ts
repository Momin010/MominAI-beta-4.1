import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { aiRouter } from './routes/ai';
import { projectRouter } from './routes/projects';
import { authRouter } from './routes/auth';
import { WebSocketManager } from './services/websocket';
import { DatabaseManager } from './services/database';
import { RateLimiter } from './middleware/rateLimiter';
import { AuthMiddleware } from './middleware/auth';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize services
const db = new DatabaseManager();
const wsManager = new WebSocketManager(wss);
const rateLimiter = new RateLimiter();
const auth = new AuthMiddleware();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin ||
        origin.endsWith('.app.github.dev') ||
        origin === 'http://localhost:5173') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Catch-all OPTIONS handler for CORS preflight
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(204);
});
app.use(express.json({ limit: '50mb' }));
app.use(rateLimiter.middleware);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/ai', aiRouter);
app.use('/api/projects', auth.protect, projectRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;

// Initialize database
db.initialize().catch(console.error);

server.listen(PORT, () => {
  console.log(`🚀 MominAI Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
});

export { wsManager, db };