const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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

    // --- Verify password ---
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
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

module.exports = { register, login, getMe, health };
