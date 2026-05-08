const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { sensitiveLimiter } = require('../middleware/rateLimiter');
const {
  auditLog,
  signAccessToken,
  createRefreshToken,
  setAuthCookies,
} = require('../controllers/authController');

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════════════
//  POST /auth/mfa/setup — Generate TOTP secret + QR code
// ══════════════════════════════════════════════════════════════════════════════
router.post('/mfa/setup', verifyToken, sensitiveLimiter, async (req, res) => {
  try {
    if (req.user.mfa_enabled) {
      return res.status(400).json({ error: 'MFA is already enabled.' });
    }

    const secret = speakeasy.generateSecret({
      name: `Sentinel AI (${req.user.email})`,
      issuer: 'SentinelAI',
      length: 32,
    });

    // Store secret in a short-lived signed JWT (not in DB yet — only after verification)
    const setupToken = jwt.sign(
      { userId: req.user.id, mfa_secret: secret.base32, purpose: 'mfa_setup' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Generate QR code as base64 PNG
    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Format secret for manual entry readability (groups of 4)
    const formatted = secret.base32.match(/.{1,4}/g).join(' ');

    return res.json({
      setup_token: setupToken,
      secret: formatted,
      qr_code: qrDataUrl,
    });
  } catch (err) {
    console.error('[MFA_SETUP]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  POST /auth/mfa/verify-setup — Verify TOTP code and enable MFA
// ══════════════════════════════════════════════════════════════════════════════
router.post('/mfa/verify-setup', verifyToken, async (req, res) => {
  try {
    const { totp_code, setup_token } = req.body;

    if (!totp_code || !setup_token) {
      return res.status(400).json({ error: 'TOTP code and setup token are required.' });
    }

    // Verify setup token
    let decoded;
    try {
      decoded = jwt.verify(setup_token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ error: 'Setup token expired. Please restart MFA setup.' });
    }

    if (decoded.purpose !== 'mfa_setup' || decoded.userId !== req.user.id) {
      return res.status(400).json({ error: 'Invalid setup token.' });
    }

    // Verify TOTP code
    const isValid = speakeasy.totp.verify({
      secret: decoded.mfa_secret,
      encoding: 'base32',
      token: totp_code,
      window: 2,
    });

    if (!isValid) {
      return res.status(400).json({ error: 'Incorrect code. Try again.' });
    }

    // Generate 10 backup codes
    const backupCodes = [];
    const hashedCodes = [];
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex'); // 8-char hex
      backupCodes.push(code);
      hashedCodes.push(await bcrypt.hash(code, 10));
    }

    // Enable MFA in database
    await User.enableMFA(req.user.id, decoded.mfa_secret, hashedCodes);
    await auditLog(req.user.id, req.user.email, 'MFA_ENABLED', true, req);

    return res.json({
      success: true,
      message: 'MFA enabled successfully.',
      backup_codes: backupCodes, // Shown ONCE only
    });
  } catch (err) {
    console.error('[MFA_VERIFY_SETUP]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  POST /auth/mfa/validate — Validate TOTP after login (uses temp_token)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/mfa/validate', async (req, res) => {
  try {
    const { totp_code, backup_code, temp_token } = req.body;

    if (!temp_token) {
      return res.status(400).json({ error: 'Temporary token is required.' });
    }
    if (!totp_code && !backup_code) {
      return res.status(400).json({ error: 'TOTP code or backup code is required.' });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(temp_token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'MFA session expired. Please log in again.' });
    }

    if (!decoded.mfa_pending) {
      return res.status(400).json({ error: 'Invalid MFA token.' });
    }

    // Get user with MFA secret
    const user = await User.findByEmail(decoded.email);
    if (!user || !user.mfa_enabled) {
      return res.status(400).json({ error: 'MFA is not configured.' });
    }

    let verified = false;

    if (totp_code) {
      // Verify TOTP
      verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: totp_code,
        window: 2,
      });
    } else if (backup_code) {
      // Try each backup code
      const codes = user.mfa_backup_codes || [];
      for (let i = 0; i < codes.length; i++) {
        const match = await bcrypt.compare(backup_code, codes[i]);
        if (match) {
          verified = true;
          // Remove used backup code
          codes.splice(i, 1);
          await User.updateBackupCodes(user.id, codes);
          break;
        }
      }
    }

    if (!verified) {
      // Track MFA failures
      const result = await User.incrementFailedLogins(user.id);
      const eventType = result.locked_until ? 'LOGIN_BLOCKED' : 'MFA_FAILED';
      await auditLog(user.id, user.email, eventType, false, req, 'Invalid MFA code');
      return res.status(401).json({ error: 'Invalid code.' });
    }

    // MFA verified — reset failed attempts and issue full tokens
    await User.loginSuccess(user.id, req.ip);
    const { token: accessToken } = signAccessToken(user);
    const { rawToken, expiresAt } = await createRefreshToken(user, req);
    setAuthCookies(res, rawToken, expiresAt);

    await auditLog(user.id, user.email, 'MFA_VERIFIED', true, req);

    return res.json({
      message: 'MFA verified. Login successful.',
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
    console.error('[MFA_VALIDATE]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  POST /auth/mfa/disable — Disable MFA (requires password + TOTP)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/mfa/disable', verifyToken, async (req, res) => {
  try {
    const { current_password, totp_code } = req.body;

    if (!current_password || !totp_code) {
      return res.status(400).json({ error: 'Password and TOTP code are required.' });
    }

    const user = await User.findByEmail(req.user.email);
    if (!user || !user.mfa_enabled) {
      return res.status(400).json({ error: 'MFA is not enabled.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Password is incorrect.' });

    // Verify TOTP
    const isValid = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: totp_code,
      window: 2,
    });
    if (!isValid) return res.status(401).json({ error: 'Invalid TOTP code.' });

    // Disable MFA
    await User.disableMFA(user.id);

    // Revoke all refresh tokens
    await db.query(`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1`, [user.id]);
    await db.query(`DELETE FROM active_sessions WHERE user_id = $1`, [user.id]);

    await auditLog(user.id, user.email, 'MFA_DISABLED', true, req);

    return res.json({ success: true, message: 'MFA disabled. All sessions have been logged out.' });
  } catch (err) {
    console.error('[MFA_DISABLE]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  POST /auth/mfa/backup-codes — Regenerate backup codes (requires password)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/mfa/backup-codes', verifyToken, async (req, res) => {
  try {
    const { current_password } = req.body;
    if (!current_password) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const user = await User.findByEmail(req.user.email);
    if (!user || !user.mfa_enabled) {
      return res.status(400).json({ error: 'MFA is not enabled.' });
    }

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Password is incorrect.' });

    // Generate 10 new backup codes
    const backupCodes = [];
    const hashedCodes = [];
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex');
      backupCodes.push(code);
      hashedCodes.push(await bcrypt.hash(code, 10));
    }

    await User.updateBackupCodes(user.id, hashedCodes);
    await auditLog(user.id, user.email, 'MFA_BACKUP_REGENERATED', true, req);

    return res.json({
      success: true,
      message: 'New backup codes generated. Old codes are invalidated.',
      backup_codes: backupCodes,
    });
  } catch (err) {
    console.error('[MFA_BACKUP_CODES]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
