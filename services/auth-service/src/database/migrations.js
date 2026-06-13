const db = require('../config/db');

/**
 * Run database migrations for auth-service.
 * Creates the users table if it doesn't exist.
 */
async function runMigrations() {
  console.log('[MIGRATIONS] Running auth-service migrations...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  console.log('[MIGRATIONS] Auth-service migrations complete.');
}

module.exports = { runMigrations };
