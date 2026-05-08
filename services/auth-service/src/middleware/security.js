const helmet = require('helmet');
const crypto = require('crypto');

/**
 * Security middleware: Helmet + custom headers + CSRF protection for cookie-based auth.
 */

/** Helmet with sensible defaults for a React SPA backend. */
const helmetMiddleware = helmet({
  contentSecurityPolicy: false,       // React frontend handles CSP
  crossOriginEmbedderPolicy: false,   // Allows cross-origin resource loading
});

/** Additional hardening headers applied to every response. */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

/**
 * CSRF Protection for cookie-based auth.
 *
 * Strategy: Double-Submit Cookie pattern.
 *   1. On login/refresh the server sets a signed CSRF token in a non-httpOnly cookie
 *      (`csrf_token`) so the JS frontend can read it.
 *   2. For every state-changing request (POST/PATCH/PUT/DELETE) the frontend must send
 *      the same token in the `X-CSRF-Token` header.
 *   3. The server compares the cookie value with the header value.
 *
 * This works because an attacker on a different origin cannot read the cookie or set
 * custom headers on cross-origin requests.
 */
const CSRF_SECRET = process.env.JWT_SECRET || 'csrf-fallback-secret';

function generateCsrfToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return token;
}

function signCsrfToken(token) {
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(token);
  return `${token}.${hmac.digest('hex')}`;
}

function verifyCsrfToken(signedToken) {
  if (!signedToken || typeof signedToken !== 'string') return false;
  const parts = signedToken.split('.');
  if (parts.length !== 2) return false;
  const [token, sig] = parts;
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(token);
  const expected = hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
}

/**
 * Middleware that validates CSRF token on state-changing methods.
 * Skips for requests without the refresh_token cookie (they are not cookie-authed).
 */
function csrfProtection(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();

  // Only enforce CSRF if the request has a refresh_token cookie
  // (i.e., the user is using cookie-based auth)
  const refreshCookie = req.cookies?.refresh_token;
  if (!refreshCookie) return next();

  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies?.csrf_token;

  if (!headerToken || !cookieToken) {
    return res.status(403).json({ error: 'CSRF token missing.' });
  }

  // Both must be identical signed tokens and valid
  if (headerToken !== cookieToken || !verifyCsrfToken(headerToken)) {
    return res.status(403).json({ error: 'CSRF token invalid.' });
  }

  next();
}

module.exports = {
  helmetMiddleware,
  securityHeaders,
  csrfProtection,
  generateCsrfToken,
  signCsrfToken,
  verifyCsrfToken,
};
