const db = require('../config/db');

/**
 * Run all database migrations idempotently.
 * Every statement uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
 * so it is safe to run on every service startup.
 */
async function runMigrations() {
  console.log('[MIGRATIONS] Running database migrations...');

  // ── 1. Extend users table ───────────────────────────────────────────────
  const userColumns = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(100)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(100)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[]`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`,
    // OAuth preparation columns
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_user_id VARCHAR(255)`,
  ];

  for (const sql of userColumns) {
    await db.query(sql);
  }
  console.log('[MIGRATIONS] users table extended');

  // ── 2. refresh_tokens table ─────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      device_name VARCHAR(100),
      device_type VARCHAR(50),
      ip_address VARCHAR(45),
      user_agent TEXT,
      is_revoked BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)`);
  console.log('[MIGRATIONS] refresh_tokens table ready');

  // ── 3. login_audit_log table ────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS login_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      email_attempted VARCHAR(255),
      event_type VARCHAR(50) NOT NULL,
      success BOOLEAN NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      failure_reason VARCHAR(100),
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_user ON login_audit_log(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_event ON login_audit_log(event_type)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_time ON login_audit_log(timestamp DESC)`);
  console.log('[MIGRATIONS] login_audit_log table ready');

  // ── 4. active_sessions table ────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS active_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_id UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
      session_name VARCHAR(100),
      browser VARCHAR(100),
      os VARCHAR(100),
      ip_address VARCHAR(45),
      location VARCHAR(100),
      is_current BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  console.log('[MIGRATIONS] active_sessions table ready');

  console.log('[MIGRATIONS] All migrations completed successfully');
}

module.exports = { runMigrations };
