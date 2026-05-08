const rateLimit = require('express-rate-limit');

/**
 * LIMITER 1 — Login attempts
 * 10 attempts per IP per 15-minute window.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  keyGenerator: (req) => req.ip,
});

/**
 * LIMITER 2 — General API
 * 100 requests per IP per 1-minute window.
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  keyGenerator: (req) => req.ip,
});

/**
 * LIMITER 3 — Sensitive operations (forgot-password, MFA setup)
 * 5 attempts per IP per 1-hour window.
 */
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in an hour.' },
  keyGenerator: (req) => req.ip,
});

module.exports = { loginLimiter, generalLimiter, sensitiveLimiter };
