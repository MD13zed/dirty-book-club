const { Pool, types } = require("pg");

// Return DATE columns (finished_at, started_at, date_read) as plain "YYYY-MM-DD"
// strings instead of JS Dates, which get shifted by the server timezone.
types.setTypeParser(1082, v => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;