const alertService = require('../services/alertService');

// ─────────────────────────────────────────────────────────────────────────────
// Async error handler wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps an async route handler so thrown errors fall through to Express's
 * global error middleware instead of causing an unhandled promise rejection.
 */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ─────────────────────────────────────────────────────────────────────────────
// GET /alerts?user_id=&status=&severity=
// ─────────────────────────────────────────────────────────────────────────────

const getAlerts = wrap(async (req, res) => {
  const { status, severity } = req.query;
  const user_id = req.query.user_id || req.user?.userId || '00000000-0000-0000-0000-000000000001';

  const alerts = await alertService.getAlerts({ user_id, status, severity });
  return res.status(200).json({ alerts, count: alerts.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /alerts/:id
// ─────────────────────────────────────────────────────────────────────────────

const getAlertById = wrap(async (req, res) => {
  const alert = await alertService.getAlertById(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: `Alert ${req.params.id} not found.` });
  }
  return res.status(200).json({ alert });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /alerts/:id/resolve
// ─────────────────────────────────────────────────────────────────────────────

const resolveAlert = wrap(async (req, res) => {
  const alert = await alertService.resolveAlert(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: `Alert ${req.params.id} not found.` });
  }
  return res.status(200).json({ message: 'Alert resolved successfully.', alert });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /alerts/summary?user_id=
// ─────────────────────────────────────────────────────────────────────────────

const getSummary = wrap(async (req, res) => {
  const user_id = req.query.user_id || req.user?.userId || '00000000-0000-0000-0000-000000000001';

  const summary = await alertService.getSummary(user_id);
  return res.status(200).json(summary);
});

module.exports = { getAlerts, getAlertById, resolveAlert, getSummary };
