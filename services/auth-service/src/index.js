require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const db = require('./config/db');
const { runMigrations } = require('./database/migrations');
const { helmetMiddleware, securityHeaders, csrfProtection } = require('./middleware/security');
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmetMiddleware);
app.use(securityHeaders);

// ── CORS — allow credentials (cookies) ──────────────────────────────────────
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true, // Required for httpOnly cookies
}));

// ── Parse JSON bodies + cookies ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ── CSRF protection (after cookieParser) ─────────────────────────────────────
app.use('/auth', csrfProtection);

// ── General rate limiter for all /auth/* ─────────────────────────────────────
app.use('/auth', generalLimiter);

// ── Mount auth routes ────────────────────────────────────────────────────────
app.use('/auth', authRoutes);

// ── Global 404 handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Connect to DB, run migrations, then start server ─────────────────────────
db.connect()
  .then(async () => {
    console.log('[DB] Connected to PostgreSQL');
    await runMigrations();
    app.listen(PORT, () => {
      console.log(`[SERVER] Auth service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[FATAL] Could not connect to database:', err.message);
    process.exit(1);
  });
