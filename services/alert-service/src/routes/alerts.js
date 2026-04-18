const express = require('express');
const router = express.Router();

const kafkaConsumer = require('../kafka/consumer');
const alertController = require('../controllers/alertController');
const verifyToken = require('../middleware/verifyToken');

// ─────────────────────────────────────────────────────────────────────────────
// Public
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /alerts/health
 * Returns service liveness + Kafka consumer status.
 * No auth required — used by Docker healthcheck and load balancers.
 */
router.get('/health', (req, res) => {
  const { connected, running } = kafkaConsumer.status();
  res.status(200).json({
    status: 'ok',
    kafka: connected ? 'connected' : 'disconnected',
    consumer: running ? 'running' : 'stopped',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Protected — require valid JWT
// ─────────────────────────────────────────────────────────────────────────────

// IMPORTANT: /summary and /:id must come BEFORE the root GET /
// otherwise Express matches "summary" and "resolve" as :id params.

/**
 * GET /alerts/summary?user_id=<uuid>
 * Returns dashboard badge counts.
 */
router.get('/summary', verifyToken, alertController.getSummary);

/**
 * GET /alerts/:id
 * Returns a single alert by UUID.
 */
router.get('/:id', verifyToken, alertController.getAlertById);

/**
 * POST /alerts/:id/resolve
 * Marks an alert as resolved.
 */
router.post('/:id/resolve', verifyToken, alertController.resolveAlert);

/**
 * GET /alerts?user_id=&status=&severity=
 * Returns list of alerts, newest first.
 */
router.get('/', verifyToken, alertController.getAlerts);

module.exports = router;
