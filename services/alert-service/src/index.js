require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const db = require('./config/db');
const kafkaConsumer = require('./kafka/consumer');
const alertRoutes = require('./routes/alerts');
const { checkSilentServices } = require('./engine/alertEngine');

const app = express();
const PORT = process.env.PORT || 3003;

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

app.use('/alerts', alertRoutes);

// Global 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler (catches anything thrown in async routes)
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

async function shutdown(signal) {
  console.log(`\n[SERVER] Received ${signal} — shutting down gracefully...`);
  await kafkaConsumer.stop();
  console.log('[SERVER] Shutdown complete.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─────────────────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Database (creates alerts table if not exists)
  await db.connect();
  console.log('[DB] Connected to PostgreSQL');

  // 2. Kafka consumer — starts in background, retries internally.
  //    We don't await here so the HTTP server still starts even if Kafka
  //    is temporarily unavailable.
  kafkaConsumer.start().catch((err) => {
    console.error('[KAFKA] Fatal error in consumer start:', err.message);
  });

  // 3. Cron: check for silent services every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    console.log('[CRON] Running silent-service check...');
    try {
      await checkSilentServices();
    } catch (err) {
      console.error('[CRON] Silent service check failed:', err.message);
    }
  });

  // 4. HTTP server
  app.listen(PORT, () => {
    console.log(`[SERVER] Alert service running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
