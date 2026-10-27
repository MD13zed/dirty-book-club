const { Pool, types } = require("pg");

// Return DATE columns (finished_at, started_at, date_read) as plain "YYYY-MM-DD"
// strings instead of JS Dates, which get shifted by the server timezone.
types.setTypeParser(1082, v => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;

// Run several queries as one all-or-nothing unit:
//   await pool.withTx(async db => { await db.query(...); await db.query(...); })
pool.withTx = async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    throw e;
  } finally {
    client.release();
  }
};
