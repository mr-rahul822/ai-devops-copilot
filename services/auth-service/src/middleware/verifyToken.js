const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

/**
 * Express middleware that verifies the JWT from the Authorization header.
 * Attaches the decoded token payload (userId, email) to req.user.
 * Also checks if the token has been blacklisted (logged out).
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    // Check if token is blacklisted (logged out)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const isBlacklisted = await User.isTokenBlacklisted(tokenHash);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been invalidated. Please login again.' });
    }

    req.user = decoded; // { userId, email, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = verifyToken;
