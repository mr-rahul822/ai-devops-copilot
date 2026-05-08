const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const validator = require('validator');
const UAParser = require('ua-parser-js');
const User = require('../models/User');
const db = require('../config/db');
const { revokeToken } = require('../middleware/verifyToken');
const { generateCsrfToken, signCsrfToken } = require('../middleware/security');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const MFA_TEMP_TOKEN_EXPIRY = '5m';

// ── Password strength regex ──────────────────────────────────────────────────
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]).{8,128}$/;

function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password must not exceed 128 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least 1 uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least 1 lowercase letter.';
  if (!/\d/.test(password)) return 'Password must contain at least 1 number.';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) return 'Password must contain at least 1 special character.';
  return null;
}

/**
 * Generate a signed JWT access token with a unique JTI.
 */
function signAccessToken(user) {
  const jti = crypto.randomUUID();
  return {
    token: jwt.sign(
      { userId: user.id, email: user.email, jti },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    ),
    jti,
  };
}

/**
 * Generate a short-lived MFA pending token.
 */
function signMfaTempToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, mfa_pending: true },
    process.env.JWT_SECRET,
    { expiresIn: MFA_TEMP_TOKEN_EXPIRY }
  );
}

/**
 * Generate, hash, and store a refresh token. Returns raw token for cookie.
 */
async function createRefreshToken(user, req) {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const ua = new UAParser(req.headers['user-agent']);
  const browser = ua.getBrowser();
  const os = ua.getOS();
  const deviceName = `${browser.name || 'Unknown'} on ${os.name || 'Unknown'}`;
  const deviceType = /mobile|tablet/i.test(ua.getDevice().type || '') ? 'mobile' : 'desktop';

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const result = await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_name, device_type, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [user.id, tokenHash, deviceName, deviceType, req.ip, req.headers['user-agent'], expiresAt]
  );

  const refreshTokenId = result.rows[0].id;

  // Create active session record
  await db.query(
    `INSERT INTO active_sessions (user_id, refresh_token_id, session_name, browser, os, ip_address, is_current)
     VALUES ($1, $2, $3, $4, $5, $6, true)`,
    [user.id, refreshTokenId, deviceName, browser.name || 'Unknown', os.name || 'Unknown', req.ip]
  );

  return { rawToken, expiresAt, refreshTokenId };
}

/**
 * Log an event to the audit trail.
 */
async function auditLog(userId, email, eventType, success, req, failureReason = null) {
  try {
    await db.query(
      `INSERT INTO login_audit_log (user_id, email_attempted, event_type, success, ip_address, user_agent, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, email, eventType, success, req.ip, req.headers['user-agent'], failureReason]
    );
  } catch (err) {
    console.error('[AUDIT_LOG] Error writing audit log:', err.message);
  }
}

/**
 * Helper to set refresh token as httpOnly cookie + CSRF cookie.
 */
function setAuthCookies(res, rawRefreshToken, expiresAt) {
  const isProduction = process.env.NODE_ENV === 'production';

  // httpOnly cookie for refresh token — JS cannot read this
  res.cookie('refresh_token', rawRefreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/auth',                // Only sent to /auth/* routes
    expires: expiresAt,
  });

  // Non-httpOnly CSRF cookie — JS CAN read this to send in headers
  const csrfToken = signCsrfToken(generateCsrfToken());
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,              // Frontend needs to read this
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Helper to clear auth cookies on logout.
 */
function clearAuthCookies(res) {
  res.clearCookie('refresh_token', { path: '/auth' });
  res.clearCookie('csrf_token', { path: '/' });
}

// ══════════════════════════════════════════════════════════════════════════════
//  ROUTE HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /auth/register
 */
async function register(req, res) {
  try {
    const { email, password, full_name, phone, company, job_title } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return res.status(400).json({ error: pwError });
    }

    // Check for duplicate — but NEVER reveal if email exists
    const existing = await User.findByEmail(email);
    if (existing) {
      // Return same success-shaped response to prevent email enumeration
      // but don't actually create a second account
      await auditLog(null, email, 'REGISTER_DUPLICATE', false, req, 'Email already registered');
      return res.status(201).json({
        message: 'Registration successful. Check your email to verify your account.',
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create(email, passwordHash, { full_name, phone, company, job_title });

    await auditLog(user.id, email, 'LOGIN_SUCCESS', true, req);

    // Generate tokens
    const { token: accessToken } = signAccessToken(user);
    const { rawToken, expiresAt } = await createRefreshToken(user, req);

    // Set httpOnly cookie for refresh token
    setAuthCookies(res, rawToken, expiresAt);

    return res.status(201).json({
      message: 'Registration successful. Check your email to verify your account.',
      accessToken,
      user: { id: user.id, email: user.email, created_at: user.created_at },
    });
  } catch (err) {
    console.error('[REGISTER ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Always give the SAME error regardless of reason
    const genericError = 'Invalid email or password.';

    const user = await User.findByEmail(email);
    if (!user) {
      await auditLog(null, email, 'LOGIN_FAILED', false, req, 'User not found');
      return res.status(401).json({ error: genericError });
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await auditLog(user.id, email, 'LOGIN_BLOCKED', false, req, 'Account locked');
      return res.status(423).json({ error: 'Account temporarily locked. Try again later.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const result = await User.incrementFailedLogins(user.id);
      const reason = result.locked_until ? 'Account locked after 5 failures' : 'Wrong password';
      const eventType = result.locked_until ? 'LOGIN_BLOCKED' : 'LOGIN_FAILED';
      await auditLog(user.id, email, eventType, false, req, reason);
      return res.status(401).json({ error: genericError });
    }

    // Password correct — reset failed attempts
    await User.loginSuccess(user.id, req.ip);

    // Check if MFA is enabled
    if (user.mfa_enabled) {
      const tempToken = signMfaTempToken(user);
      await auditLog(user.id, email, 'LOGIN_SUCCESS', true, req, 'MFA required');
      return res.status(200).json({
        requires_mfa: true,
        temp_token: tempToken,
        message: 'MFA verification required.',
      });
    }

    // No MFA — issue full tokens
    const { token: accessToken } = signAccessToken(user);
    const { rawToken, expiresAt } = await createRefreshToken(user, req);

    setAuthCookies(res, rawToken, expiresAt);
    await auditLog(user.id, email, 'LOGIN_SUCCESS', true, req);

    return res.status(200).json({
      message: 'Login successful.',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        mfa_enabled: user.mfa_enabled,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /auth/logout
 */
async function logout(req, res) {
  try {
    // Revoke the access token JTI
    if (req.tokenJti) {
      revokeToken(req.tokenJti);
    }

    // Revoke refresh token from cookie
    const refreshCookie = req.cookies?.refresh_token;
    if (refreshCookie) {
      const tokenHash = crypto.createHash('sha256').update(refreshCookie).digest('hex');
      await db.query(`UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1`, [tokenHash]);
      // Also remove the active session
      await db.query(
        `DELETE FROM active_sessions WHERE refresh_token_id = (
          SELECT id FROM refresh_tokens WHERE token_hash = $1
        )`,
        [tokenHash]
      );
    }

    clearAuthCookies(res);
    await auditLog(req.user.id, req.user.email, 'LOGOUT', true, req);

    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    console.error('[LOGOUT ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /auth/refresh
 * Reads refresh token from httpOnly cookie, validates, returns new access token.
 */
async function refresh(req, res) {
  try {
    const rawToken = req.cookies?.refresh_token;
    if (!rawToken) {
      return res.status(401).json({ error: 'No refresh token provided.' });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const result = await db.query(
      `SELECT rt.*, u.id AS uid, u.email, u.locked_until, u.mfa_enabled
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    const rt = result.rows[0];

    if (rt.is_revoked) {
      // Possible token theft — revoke ALL tokens for this user
      await db.query(`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1`, [rt.user_id]);
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh token has been revoked. All sessions terminated.' });
    }

    if (new Date(rt.expires_at) < new Date()) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh token expired.' });
    }

    if (rt.locked_until && new Date(rt.locked_until) > new Date()) {
      return res.status(403).json({ error: 'Account is temporarily locked.' });
    }

    // Update last used
    await db.query(`UPDATE refresh_tokens SET last_used_at = NOW() WHERE id = $1`, [rt.id]);
    await db.query(`UPDATE active_sessions SET last_active_at = NOW() WHERE refresh_token_id = $1`, [rt.id]);

    // Issue new access token
    const { token: accessToken } = signAccessToken({ id: rt.user_id, email: rt.email });

    return res.status(200).json({ accessToken });
  } catch (err) {
    console.error('[REFRESH ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * GET /auth/me  (protected)
 */
async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error('[GET_ME ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * GET /auth/health
 */
function health(req, res) {
  return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}

// ── OAuth stubs ──────────────────────────────────────────────────────────────
function oauthGoogle(req, res) {
  return res.status(501).json({ message: 'Google OAuth — coming soon.' });
}
function oauthGithub(req, res) {
  return res.status(501).json({ message: 'GitHub OAuth — coming soon.' });
}
function ssoSaml(req, res) {
  return res.status(501).json({ message: 'SAML SSO — coming soon.' });
}

module.exports = {
  register,
  login,
  logout,
  refresh,
  getMe,
  health,
  oauthGoogle,
  oauthGithub,
  ssoSaml,
  auditLog,
  createRefreshToken,
  signAccessToken,
  setAuthCookies,
  clearAuthCookies,
};
