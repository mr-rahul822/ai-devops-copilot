const { Pool } = require('pg');

// Connection pool using environment variables
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

/**
 * Connects to PostgreSQL and initializes the alerts table + indexes.
 */
async function connect() {
  // Verify connection
  await pool.query('SELECT 1');

  // Create alerts table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID NOT NULL,
      service_name   VARCHAR(100) NOT NULL,
      alert_type     VARCHAR(50) NOT NULL,
      severity       VARCHAR(20) NOT NULL,
      message        TEXT NOT NULL,
      metric_value   FLOAT,
      status         VARCHAR(20) DEFAULT 'open',
      last_fired_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      resolved_at    TIMESTAMP WITH TIME ZONE,
      created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Indexes
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_alerts_user
      ON alerts(user_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_alerts_status
      ON alerts(status)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_alerts_type_service
      ON alerts(user_id, service_name, alert_type)
  `);

  console.log('[DB] alerts table ready');
}

/**
 * Execute a parameterized SQL query.
 */
function query(text, params) {
  return pool.query(text, params);
}

module.exports = { connect, query };
