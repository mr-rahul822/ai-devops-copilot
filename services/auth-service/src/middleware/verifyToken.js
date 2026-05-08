const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * In-memory set of revoked JWT IDs (JTI).
 * In production you'd use Redis; for a single-instance service this is fine.
 */
const revokedTokens = new Set();

/**
 * Add a JTI to the revoked set.
 */
function revokeToken(jti) {
  if (jti) revokedTokens.add(jti);
}

/**
 * Express middleware — verifies the JWT from the Authorization header.
 *
 *  1. Extracts Bearer token
 *  2. Verifies JWT signature + expiry
 *  3. Checks JTI is not revoked
 *  4. Verifies user still exists in DB and is not locked
 *  5. Attaches full user row (safe columns) to req.user
 *  6. Rejects mfa_pending tokens from accessing protected routes
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  // Reject mfa_pending tokens for normal routes
  if (decoded.mfa_pending) {
    return res.status(401).json({ error: 'MFA verification required.' });
  }

  // Check if JTI has been revoked (logout)
  if (decoded.jti && revokedTokens.has(decoded.jti)) {
    return res.status(401).json({ error: 'Token has been revoked.' });
  }

  // Check user still exists and is not locked
  try {
    const result = await db.query(
      `SELECT id, email, full_name, avatar_url, phone, company, job_title,
              timezone, mfa_enabled, email_verified, last_login_at,
              last_login_ip, password_changed_at, created_at, updated_at,
              locked_until, failed_login_attempts
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }

    const user = result.rows[0];

    // Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({ error: 'Account is temporarily locked.' });
    }

    // Attach full user to request
    req.user = user;
    req.tokenJti = decoded.jti;
    next();
  } catch (err) {
    console.error('[VERIFY_TOKEN] DB error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * Ownership assertion helper.
 * Call from any route handler: assertOwnership(req, res, resourceUserId)
 * Returns true if ownership matches, sends 403 and returns false otherwise.
 */
async function assertOwnership(req, res, resourceUserId) {
  if (req.user.id !== resourceUserId) {
    // Log security violation
    try {
      await db.query(
        `INSERT INTO login_audit_log (user_id, event_type, success, ip_address, user_agent, failure_reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user.id,
          'SECURITY_VIOLATION',
          false,
          req.ip,
          req.headers['user-agent'],
          `Attempted access to resource owned by ${resourceUserId}`,
        ]
      );
    } catch (logErr) {
      console.error('[AUDIT] Failed to log security violation:', logErr.message);
    }

    res.status(403).json({ error: 'Forbidden. You do not own this resource.' });
    return false;
  }
  return true;
}

module.exports = verifyToken;
module.exports.assertOwnership = assertOwnership;
module.exports.revokeToken = revokeToken;
module.exports.revokedTokens = revokedTokens;
