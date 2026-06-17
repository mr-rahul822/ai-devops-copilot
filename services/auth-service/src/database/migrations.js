const db = require('../config/db');

/**
 * Run database migrations for auth-service.
 * Creates/updates tables. Uses IF NOT EXISTS / IF NOT EXISTS for safety.
 */
async function runMigrations() {
  console.log('[MIGRATIONS] Running auth-service migrations...');

  // Original users table
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Add name column if not exists
  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
  `);

  // Add failed_login_attempts + locked_until for account lockout
  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
  `);
  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
  `);

  // Password reset tokens table
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      VARCHAR(64) UNIQUE NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used       BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Token blacklist for logout (invalidate JWTs)
  await db.query(`
    CREATE TABLE IF NOT EXISTS token_blacklist (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token_hash VARCHAR(64) UNIQUE NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Indexes for fast lookups
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist(token_hash);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);
  `);

  console.log('[MIGRATIONS] Auth-service migrations complete.');
}

module.exports = { runMigrations };
