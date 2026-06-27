const db = require('../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// Cooldown check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if an alert of this type for this service was fired within
 * the cooldown window, meaning we should NOT fire again yet.
 *
 * @param {string} userId
 * @param {string} serviceName
 * @param {string} alertType
 * @param {number} cooldownMinutes
 */
async function isInCooldown(userId, serviceName, alertType, cooldownMinutes) {
  const result = await db.query(
    `SELECT last_fired_at
     FROM alerts
     WHERE user_id = $1
       AND service_name = $2
       AND alert_type = $3
     ORDER BY last_fired_at DESC
     LIMIT 1`,
    [userId, serviceName, alertType]
  );

  if (!result.rows[0]) return false; // Never fired — not in cooldown

  const lastFired = new Date(result.rows[0].last_fired_at);
  const diffMinutes = (Date.now() - lastFired.getTime()) / 1000 / 60;
  return diffMinutes < cooldownMinutes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fire (insert) an alert
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts a new alert row and returns the created row.
 */
async function fireAlert({ user_id, service_name, alert_type, severity, message, metric_value }) {
  const result = await db.query(
    `INSERT INTO alerts
       (user_id, service_name, alert_type, severity, message, metric_value, last_fired_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [user_id, service_name, alert_type, severity, message, metric_value ?? null]
  );
  return result.rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Read operations — ALL scoped by user_id for multi-tenant isolation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns alerts for a user, optionally filtered by status and/or severity.
 * Always ordered newest-first. user_id is REQUIRED for tenant isolation.
 */
async function getAlerts({ user_id, status, severity } = {}) {
  const conditions = ['user_id = $1'];
  const params = [user_id];
  let idx = 2;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  if (severity) {
    conditions.push(`severity = $${idx++}`);
    params.push(severity);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const result = await db.query(
    `SELECT * FROM alerts
     ${whereClause}
     ORDER BY created_at DESC`,
    params
  );
  return result.rows;
}

/**
 * Returns a single alert by its UUID, scoped to the authenticated user.
 * Returns null if the alert doesn't exist OR doesn't belong to this user.
 */
async function getAlertById(id, userId) {
  const result = await db.query(
    'SELECT * FROM alerts WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return result.rows[0] || null;
}

/**
 * Marks an alert as resolved and records the resolution time.
 * Only resolves if the alert belongs to the authenticated user.
 */
async function resolveAlert(id, userId) {
  const result = await db.query(
    `UPDATE alerts
     SET status = 'resolved', resolved_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId]
  );
  return result.rows[0] || null;
}

/**
 * Returns aggregate counts for the dashboard summary badge,
 * scoped to the authenticated user.
 */
async function getSummary(userId) {
  const result = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'open')                                            AS open,
       COUNT(*) FILTER (WHERE status = 'open' AND severity = 'CRITICAL')                  AS critical,
       COUNT(*) FILTER (WHERE status = 'open' AND severity = 'HIGH')                      AS high,
       COUNT(*) FILTER (WHERE status = 'open' AND severity = 'MEDIUM')                    AS medium,
       COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at >= NOW() - INTERVAL '24 hours') AS resolved_today
     FROM alerts
     WHERE user_id = $1`,
    [userId]
  );

  // pg returns counts as strings — convert to numbers
  const row = result.rows[0];
  return {
    open: parseInt(row.open, 10),
    critical: parseInt(row.critical, 10),
    high: parseInt(row.high, 10),
    medium: parseInt(row.medium, 10),
    resolved_today: parseInt(row.resolved_today, 10),
  };
}

module.exports = { isInCooldown, fireAlert, getAlerts, getAlertById, resolveAlert, getSummary };
