const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { assertOwnership } = require('../middleware/verifyToken');
const { auditLog } = require('../controllers/authController');

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════════════
//  GET /auth/sessions — List all active sessions for current user
// ══════════════════════════════════════════════════════════════════════════════
router.get('/sessions', verifyToken, async (req, res) => {
  try {
    // Get current refresh token hash to identify "current" session
    const refreshCookie = req.cookies?.refresh_token;
    let currentRefreshHash = null;
    if (refreshCookie) {
      currentRefreshHash = crypto.createHash('sha256').update(refreshCookie).digest('hex');
    }

    const result = await db.query(
      `SELECT s.id, s.session_name, s.browser, s.os, s.ip_address,
              s.location, s.is_current, s.created_at, s.last_active_at,
              rt.token_hash
       FROM active_sessions s
       LEFT JOIN refresh_tokens rt ON s.refresh_token_id = rt.id
       WHERE s.user_id = $1
       ORDER BY s.last_active_at DESC`,
      [req.user.id]
    );

    const sessions = result.rows.map(s => ({
      id: s.id,
      session_name: s.session_name,
      browser: s.browser,
      os: s.os,
      ip_address: s.ip_address,
      location: s.location,
      is_current: currentRefreshHash ? s.token_hash === currentRefreshHash : s.is_current,
      created_at: s.created_at,
      last_active_at: s.last_active_at,
    }));

    return res.json({ sessions });
  } catch (err) {
    console.error('[SESSIONS GET]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  DELETE /auth/sessions/all — Revoke all sessions except current
// ══════════════════════════════════════════════════════════════════════════════
router.delete('/sessions/all', verifyToken, async (req, res) => {
  try {
    const refreshCookie = req.cookies?.refresh_token;
    let currentHash = null;
    if (refreshCookie) {
      currentHash = crypto.createHash('sha256').update(refreshCookie).digest('hex');
    }

    // Revoke all refresh tokens except current
    if (currentHash) {
      await db.query(
        `UPDATE refresh_tokens SET is_revoked = true
         WHERE user_id = $1 AND token_hash != $2`,
        [req.user.id, currentHash]
      );
      await db.query(
        `DELETE FROM active_sessions
         WHERE user_id = $1 AND refresh_token_id NOT IN (
           SELECT id FROM refresh_tokens WHERE token_hash = $2
         )`,
        [req.user.id, currentHash]
      );
    } else {
      await db.query(`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1`, [req.user.id]);
      await db.query(`DELETE FROM active_sessions WHERE user_id = $1`, [req.user.id]);
    }

    await auditLog(req.user.id, req.user.email, 'SESSION_REVOKED', true, req, 'All other sessions');

    return res.json({ success: true, message: 'All other sessions have been revoked.' });
  } catch (err) {
    console.error('[SESSIONS DELETE ALL]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  DELETE /auth/sessions/:session_id — Revoke a specific session
// ══════════════════════════════════════════════════════════════════════════════
router.delete('/sessions/:session_id', verifyToken, async (req, res) => {
  try {
    const { session_id } = req.params;

    // Check the session belongs to the current user
    const result = await db.query(
      `SELECT s.id, s.user_id, s.refresh_token_id
       FROM active_sessions s
       WHERE s.id = $1`,
      [session_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const session = result.rows[0];
    const isOwner = await assertOwnership(req, res, session.user_id);
    if (!isOwner) return; // assertOwnership already sent 403

    // Revoke the associated refresh token
    if (session.refresh_token_id) {
      await db.query(
        `UPDATE refresh_tokens SET is_revoked = true WHERE id = $1`,
        [session.refresh_token_id]
      );
    }

    // Remove the session
    await db.query(`DELETE FROM active_sessions WHERE id = $1`, [session_id]);

    await auditLog(req.user.id, req.user.email, 'SESSION_REVOKED', true, req,
      `Session ${session_id}`);

    return res.json({ success: true, message: 'Session revoked.' });
  } catch (err) {
    console.error('[SESSION DELETE]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
