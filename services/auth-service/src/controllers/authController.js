const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const validator = require('validator');
const User = require('../models/User');

const SALT_ROUNDS = 12;
const JWT_EXPIRY = '7d';

/**
 * Generate a signed JWT for a given user.
 */
function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * POST /auth/register
 * Body: { email, password }
 */
async function register(req, res) {
  try {
    const { email, password } = req.body;

    // --- Validation ---
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    // --- Check for duplicate ---
    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // --- Create user ---
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create(email, passwordHash);
    const token = signToken(user);

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('[REGISTER ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /auth/login
 * Body: { email, password }
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // --- Validation ---
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // --- Find user ---
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // --- Check account lockout ---
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(429).json({
        error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`
      });
    }

    // --- Verify password ---
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await User.incrementFailedLogins(user.id);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // --- Reset failed login count on success ---
    await User.resetFailedLogins(user.id);

    const token = signToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || null,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * GET /auth/me  (protected — requires verifyToken middleware)
 * Returns the current authenticated user's info.
 */
async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.userId);
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
 * Simple health-check endpoint.
 */
function health(req, res) {
  return res.status(200).json({ status: 'ok' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /auth/logout
 * Blacklists the current JWT so it can't be reused.
 */
async function logout(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (token) {
      // Decode to get expiry without verifying (token is valid — came through verifyToken)
      const decoded = jwt.decode(token);
      const expiresAt = decoded?.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await User.blacklistToken(tokenHash, expiresAt);
    }

    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('[LOGOUT ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * GET /auth/profile
 * Returns current user profile with name field.
 */
async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.status(200).json({ user });
  } catch (err) {
    console.error('[GET_PROFILE ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * PATCH /auth/profile
 * Updates user name.
 */
async function updateProfile(req, res) {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    }
    const user = await User.updateProfile(req.user.userId, { name: name.trim() });
    return res.status(200).json({ message: 'Profile updated.', user });
  } catch (err) {
    console.error('[UPDATE_PROFILE ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /auth/change-password
 * Changes password after verifying current password.
 */
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = await User.findByEmail(req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await User.updatePassword(req.user.userId, newHash);

    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[CHANGE_PASSWORD ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /auth/forgot-password
 * Generates a reset token and logs it (email sending is future work).
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }

    // Always return success to prevent email enumeration
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(200).json({
        message: 'If an account exists with this email, a reset link has been sent.'
      });
    }

    // Generate secure reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await User.createResetToken(user.id, token, expiresAt);

    // In development: log to console. In production: send email via SMTP.
    const smtpConfigured = !!process.env.SMTP_HOST;
    if (smtpConfigured) {
      // TODO: Send email with reset link
      console.log('[AUTH] Reset email would be sent to:', email);
    } else {
      // Development mode — log token for testing
      console.log(`[AUTH][DEV] Password reset token for ${email}: ${token}`);
      console.log(`[AUTH][DEV] Reset URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`);
    }

    return res.status(200).json({
      message: 'If an account exists with this email, a reset link has been sent.',
      // Only expose token in development for testing
      ...(process.env.NODE_ENV !== 'production' && { dev_token: token })
    });
  } catch (err) {
    console.error('[FORGOT_PASSWORD ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /auth/reset-password
 * Verifies token and sets new password.
 */
async function resetPassword(req, res) {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const resetRecord = await User.findResetToken(token);
    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token. Please request a new one.' });
    }

    const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await User.updatePassword(resetRecord.user_id, newHash);
    await User.markResetTokenUsed(token);

    return res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('[RESET_PASSWORD ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { register, login, getMe, health, logout, getProfile, updateProfile, changePassword, forgotPassword, resetPassword };
