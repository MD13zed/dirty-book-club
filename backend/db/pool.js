const { Pool } = require("pg");

console.log("DATABASE_URL:", process.env.DATABASE_URL ? "SET" : "NOT SET");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;