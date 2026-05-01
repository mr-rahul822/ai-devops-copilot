require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Mount auth routes
app.use('/auth', authRoutes);

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect to DB then start server
db.connect()
  .then(() => {
    console.log('[DB] Connected to PostgreSQL');
    app.listen(PORT, () => {
      console.log(`[SERVER] Auth service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[FATAL] Could not connect to database:', err.message);
    process.exit(1);
  });
