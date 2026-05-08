const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');
const { loginLimiter } = require('../middleware/rateLimiter');
const profileRoutes = require('./profile');
const mfaRoutes = require('./mfa');
const sessionRoutes = require('./sessions');
const auditRoutes = require('./audit');

// ── Public routes ────────────────────────────────────────────────────────────
router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.get('/health', authController.health);

// ── OAuth stubs (501 Not Implemented) ────────────────────────────────────────
router.get('/oauth/google', authController.oauthGoogle);
router.get('/oauth/github', authController.oauthGithub);
router.post('/sso/saml', authController.ssoSaml);

// ── Protected routes ─────────────────────────────────────────────────────────
router.get('/me', verifyToken, authController.getMe);
router.post('/logout', verifyToken, authController.logout);

// ── Mount sub-routers ────────────────────────────────────────────────────────
router.use('/', profileRoutes);   // /auth/profile, /auth/change-password, etc.
router.use('/', mfaRoutes);       // /auth/mfa/*
router.use('/', sessionRoutes);   // /auth/sessions/*
router.use('/', auditRoutes);     // /auth/audit-log

module.exports = router;
