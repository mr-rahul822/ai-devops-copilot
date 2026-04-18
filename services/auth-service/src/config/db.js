const { Pool } = require('pg');

// Create a connection pool using environment variables
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

/**
 * Connects to PostgreSQL and initializes the users table if it doesn't exist.
 */
async function connect() {
  // Test the connection
  await pool.query('SELECT 1');

  // Create the users table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  console.log('[DB] users table ready');
}

/**
 * Execute a parameterized SQL query.
 * @param {string} text  - SQL query string
 * @param {Array}  params - Query parameters
 */
function query(text, params) {
  return pool.query(text, params);
}

module.exports = { connect, query };
