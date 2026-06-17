const db = require('../config/db');

const User = {
  /**
   * Create a new user and return the created row (without password_hash).
   */
  async create(email, passwordHash) {
    const result = await db.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email, passwordHash]
    );
    return result.rows[0];
  },

  /**
   * Find a user by email. Returns full row including password_hash (for login verification).
   */
  async findByEmail(email) {
    const result = await db.query(
      `SELECT id, email, password_hash, name, failed_login_attempts, locked_until, created_at
       FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  },

  /**
   * Find a user by ID. Returns row WITHOUT password_hash (safe for API responses).
   */
  async findById(id) {
    const result = await db.query(
      `SELECT id, email, name, created_at FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  // ── Profile ────────────────────────────────────────────────────────────────

  /**
   * Update user profile (name).
   */
  async updateProfile(id, { name }) {
    const result = await db.query(
      `UPDATE users SET name = $1 WHERE id = $2
       RETURNING id, email, name, created_at`,
      [name, id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update password hash.
   */
  async updatePassword(id, passwordHash) {
    await db.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [passwordHash, id]
    );
  },

  // ── Account lockout ────────────────────────────────────────────────────────

  async incrementFailedLogins(id) {
    const result = await db.query(
      `UPDATE users 
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE 
             WHEN failed_login_attempts + 1 >= 5 
             THEN NOW() + INTERVAL '15 minutes'
             ELSE locked_until
           END
       WHERE id = $1
       RETURNING failed_login_attempts, locked_until`,
      [id]
    );
    return result.rows[0];
  },

  async resetFailedLogins(id) {
    await db.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [id]
    );
  },

  // ── Password reset tokens ─────────────────────────────────────────────────

  async createResetToken(userId, token, expiresAt) {
    // Invalidate any existing tokens for this user first
    await db.query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1`,
      [userId]
    );
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );
  },

  async findResetToken(token) {
    const result = await db.query(
      `SELECT prt.*, u.email FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = $1 AND prt.used = FALSE AND prt.expires_at > NOW()`,
      [token]
    );
    return result.rows[0] || null;
  },

  async markResetTokenUsed(token) {
    await db.query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE token = $1`,
      [token]
    );
  },

  // ── Token blacklist (for logout) ──────────────────────────────────────────

  async blacklistToken(tokenHash, expiresAt) {
    await db.query(
      `INSERT INTO token_blacklist (token_hash, expires_at)
       VALUES ($1, $2)
       ON CONFLICT (token_hash) DO NOTHING`,
      [tokenHash, expiresAt]
    );
  },

  async isTokenBlacklisted(tokenHash) {
    const result = await db.query(
      `SELECT 1 FROM token_blacklist 
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );
    return result.rows.length > 0;
  },
};

module.exports = User;
