const pool = require("../db/pool");

async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { rows } = await pool.query("SELECT is_admin FROM members WHERE id = $1", [req.user.id]);
  if (!rows.length || !rows[0].is_admin) return res.status(403).json({ error: "Admin only" });
  next();
}

module.exports = requireAdmin;
