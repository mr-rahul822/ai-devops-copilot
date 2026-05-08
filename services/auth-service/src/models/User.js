const db = require('../config/db');

const User = {
  /**
   * Create a new user and return the created row (without password_hash).
   */
  async create(email, passwordHash, profile = {}) {
    const { full_name, phone, company, job_title } = profile;
    
    // We dynamically build the query because some fields might be undefined
    const fields = ['email', 'password_hash'];
    const values = [email, passwordHash];
    const placeholders = ['$1', '$2'];
    
    let idx = 3;
    if (full_name !== undefined) { fields.push('full_name'); values.push(full_name); placeholders.push(`$${idx++}`); }
    if (phone !== undefined) { fields.push('phone'); values.push(phone); placeholders.push(`$${idx++}`); }
    if (company !== undefined) { fields.push('company'); values.push(company); placeholders.push(`$${idx++}`); }
    if (job_title !== undefined) { fields.push('job_title'); values.push(job_title); placeholders.push(`$${idx++}`); }

    const result = await db.query(
      `INSERT INTO users (${fields.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING id, email, created_at`,
      values
    );
    return result.rows[0];
  },

  /**
   * Find a user by email.
   * Returns ALL columns needed for login + security checks.
   */
  async findByEmail(email) {
    const result = await db.query(
      `SELECT id, email, password_hash, full_name, avatar_url, phone,
              company, job_title, timezone, mfa_enabled, mfa_secret,
              mfa_backup_codes, failed_login_attempts, locked_until,
              last_login_at, last_login_ip, password_changed_at,
              email_verified, created_at, updated_at
       FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  },

  /**
   * Find a user by ID — safe columns only (no secrets).
   */
  async findById(id) {
    const result = await db.query(
      `SELECT id, email, full_name, avatar_url, phone, company,
              job_title, timezone, mfa_enabled, email_verified,
              last_login_at, last_login_ip, password_changed_at,
              created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update profile fields. Only accepts safe columns.
   */
  async updateProfile(id, fields) {
    const allowed = ['full_name', 'phone', 'company', 'job_title', 'timezone', 'avatar_url'];
    const updates = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }

    if (updates.length === 0) return null;

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, email, full_name, avatar_url, phone, company,
                 job_title, timezone, mfa_enabled, email_verified,
                 last_login_at, last_login_ip, password_changed_at,
                 created_at, updated_at`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Update password hash and password_changed_at.
   */
  async updatePassword(id, newHash) {
    await db.query(
      `UPDATE users SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [newHash, id]
    );
  },

  /**
   * Increment failed login attempts. Lock account if >= 5.
   */
  async incrementFailedLogins(id) {
    const result = await db.query(
      `UPDATE users SET
         failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE WHEN failed_login_attempts + 1 >= 5
                             THEN NOW() + INTERVAL '30 minutes'
                             ELSE locked_until END,
         updated_at = NOW()
       WHERE id = $1
       RETURNING failed_login_attempts, locked_until`,
      [id]
    );
    return result.rows[0];
  },

  /**
   * Reset failed login attempts and update last login info.
   */
  async loginSuccess(id, ip) {
    await db.query(
      `UPDATE users SET
         failed_login_attempts = 0,
         locked_until = NULL,
         last_login_at = NOW(),
         last_login_ip = $1,
         updated_at = NOW()
       WHERE id = $2`,
      [ip, id]
    );
  },

  /**
   * Enable MFA for a user.
   */
  async enableMFA(id, secret, hashedBackupCodes) {
    await db.query(
      `UPDATE users SET mfa_enabled = true, mfa_secret = $1, mfa_backup_codes = $2, updated_at = NOW() WHERE id = $3`,
      [secret, hashedBackupCodes, id]
    );
  },

  /**
   * Disable MFA for a user.
   */
  async disableMFA(id) {
    await db.query(
      `UPDATE users SET mfa_enabled = false, mfa_secret = NULL, mfa_backup_codes = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );
  },

  /**
   * Update MFA backup codes.
   */
  async updateBackupCodes(id, hashedCodes) {
    await db.query(
      `UPDATE users SET mfa_backup_codes = $1, updated_at = NOW() WHERE id = $2`,
      [hashedCodes, id]
    );
  },

  /**
   * Set password reset token and expiry.
   */
  async setResetToken(id, tokenHash, expires) {
    await db.query(
      `UPDATE users SET password_reset_token = $1, password_reset_expires = $2, updated_at = NOW() WHERE id = $3`,
      [tokenHash, expires, id]
    );
  },

  /**
   * Find user by reset token hash (only if not expired).
   */
  async findByResetToken(tokenHash) {
    const result = await db.query(
      `SELECT id, email FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()`,
      [tokenHash]
    );
    return result.rows[0] || null;
  },

  /**
   * Clear the password reset token after successful reset.
   */
  async clearResetToken(id) {
    await db.query(
      `UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );
  },
};

module.exports = User;
