const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/db');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { auditLog, clearAuthCookies } = require('../controllers/authController');
const { sensitiveLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ── Valid IANA timezones (subset for validation) ──────────────────────────────
function isValidTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

// Strip HTML tags to prevent XSS
function stripHtml(str) {
  if (!str) return str;
  return str.replace(/<[^>]*>/g, '');
}

// ══════════════════════════════════════════════════════════════════════════════
//  GET /auth/profile — Returns full profile for authenticated user
// ══════════════════════════════════════════════════════════════════════════════
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user });
  } catch (err) {
    console.error('[PROFILE GET]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  PATCH /auth/profile — Update profile fields
// ══════════════════════════════════════════════════════════════════════════════
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const { full_name, phone, company, job_title, timezone, avatar_url } = req.body;
    const fields = {};

    // Validate and sanitize each field
    if (full_name !== undefined) {
      const clean = stripHtml(full_name);
      if (clean.length > 100) return res.status(400).json({ error: 'Full name must be 100 characters or fewer.' });
      fields.full_name = clean;
    }
    if (phone !== undefined) {
      if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone.replace(/[\s\-()]/g, ''))) {
        return res.status(400).json({ error: 'Phone must be in valid E.164 format (e.g., +14155552671).' });
      }
      fields.phone = phone;
    }
    if (company !== undefined) {
      fields.company = stripHtml(company).slice(0, 100);
    }
    if (job_title !== undefined) {
      fields.job_title = stripHtml(job_title).slice(0, 100);
    }
    if (timezone !== undefined) {
      if (!isValidTimezone(timezone)) {
        return res.status(400).json({ error: 'Invalid timezone. Use IANA format (e.g., Asia/Kolkata).' });
      }
      fields.timezone = timezone;
    }
    if (avatar_url !== undefined) {
      fields.avatar_url = avatar_url;
    }

    const user = await User.updateProfile(req.user.id, fields);
    if (!user) return res.status(400).json({ error: 'No valid fields to update.' });

    await auditLog(req.user.id, req.user.email, 'PROFILE_UPDATED', true, req,
      `Updated: ${Object.keys(fields).join(', ')}`);

    return res.json({ message: 'Profile updated.', user });
  } catch (err) {
    console.error('[PROFILE PATCH]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  POST /auth/change-password
// ══════════════════════════════════════════════════════════════════════════════
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ error: 'All password fields are required.' });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({ error: 'New password and confirmation do not match.' });
    }

    // Validate strength
    const pwError = validatePasswordStrength(new_password);
    if (pwError) return res.status(400).json({ error: pwError });

    // Fetch user with password_hash
    const user = await User.findByEmail(req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Verify current password
    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect.' });

    // Ensure new password is different
    const isSame = await bcrypt.compare(new_password, user.password_hash);
    if (isSame) return res.status(400).json({ error: 'New password must be different from current password.' });

    // Hash and save
    const newHash = await bcrypt.hash(new_password, 12);
    await User.updatePassword(user.id, newHash);

    // Revoke ALL refresh tokens → forces re-login on all devices
    await db.query(`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1`, [user.id]);
    await db.query(`DELETE FROM active_sessions WHERE user_id = $1`, [user.id]);

    clearAuthCookies(res);
    await auditLog(user.id, user.email, 'PASSWORD_CHANGED', true, req);

    return res.json({
      success: true,
      message: 'Password changed. All sessions have been logged out.',
    });
  } catch (err) {
    console.error('[CHANGE_PASSWORD]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  POST /auth/forgot-password — rate limited
// ══════════════════════════════════════════════════════════════════════════════
router.post('/forgot-password', sensitiveLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    // Always return the SAME response
    const message = 'If this email exists, a password reset link was sent.';

    const user = await User.findByEmail(email);
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await User.setResetToken(user.id, tokenHash, expires);
      await auditLog(user.id, email, 'PASSWORD_RESET_REQUESTED', true, req);

      // In production: send email with reset link containing rawToken
      // For dev: include token in response
      return res.json({
        message,
        _dev_token: rawToken,
        _dev_note: 'In production, this token would be sent via email only.',
      });
    }

    return res.json({ message });
  } catch (err) {
    console.error('[FORGOT_PASSWORD]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  POST /auth/reset-password
// ══════════════════════════════════════════════════════════════════════════════
router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password, confirm_password } = req.body;

    if (!token || !new_password || !confirm_password) {
      return res.status(400).json({ error: 'Token, new password, and confirmation are required.' });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const pwError = validatePasswordStrength(new_password);
    if (pwError) return res.status(400).json({ error: pwError });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findByResetToken(tokenHash);

    if (!user) {
      return res.status(400).json({ error: 'Reset link is invalid or expired.' });
    }

    const newHash = await bcrypt.hash(new_password, 12);
    await User.updatePassword(user.id, newHash);
    await User.clearResetToken(user.id);

    // Revoke all refresh tokens
    await db.query(`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1`, [user.id]);
    await db.query(`DELETE FROM active_sessions WHERE user_id = $1`, [user.id]);

    await auditLog(user.id, user.email, 'PASSWORD_RESET_COMPLETED', true, req);

    return res.json({
      success: true,
      message: 'Password reset successful. Please log in with your new password.',
    });
  } catch (err) {
    console.error('[RESET_PASSWORD]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Password validation helper (same rules as authController) ────────────────
function validatePasswordStrength(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password must not exceed 128 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least 1 uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least 1 lowercase letter.';
  if (!/\d/.test(password)) return 'Password must contain at least 1 number.';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) return 'Password must contain at least 1 special character.';
  return null;
}

module.exports = router;
