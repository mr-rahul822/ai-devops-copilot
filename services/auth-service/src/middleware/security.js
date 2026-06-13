const helmet = require('helmet');

// ── Helmet with sensible defaults ────────────────────────────────────────────
const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // disable CSP for API-only service
});

// ── Extra security headers ───────────────────────────────────────────────────
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

// ── CSRF protection (no-op for API — token-based auth covers this) ───────────
const csrfProtection = (req, res, next) => {
  // For a pure REST API using Bearer tokens, CSRF is not a concern.
  // This is a placeholder that can be swapped for csurf if cookies carry auth.
  next();
};

module.exports = { helmetMiddleware, securityHeaders, csrfProtection };
