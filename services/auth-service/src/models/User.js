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
      `SELECT id, email, password_hash, created_at FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  },

  /**
   * Find a user by ID. Returns row WITHOUT password_hash (safe for API responses).
   */
  async findById(id) {
    const result = await db.query(
      `SELECT id, email, created_at FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },
};

module.exports = User;
