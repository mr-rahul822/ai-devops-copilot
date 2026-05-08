const express = require('express');
const db = require('../config/db');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════════════
//  GET /auth/audit-log — Returns login audit log for current user ONLY
// ══════════════════════════════════════════════════════════════════════════════
router.get('/audit-log', verifyToken, async (req, res) => {
  try {
    const { event_type, limit = 50 } = req.query;
    const maxLimit = Math.min(parseInt(limit, 10) || 50, 100);

    let query = `
      SELECT event_type, success, ip_address, failure_reason, timestamp, user_agent
      FROM login_audit_log
      WHERE user_id = $1
    `;
    const params = [req.user.id];

    if (event_type) {
      query += ` AND event_type = $2`;
      params.push(event_type);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(maxLimit);

    const result = await db.query(query, params);

    return res.json({ events: result.rows });
  } catch (err) {
    console.error('[AUDIT_LOG GET]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
