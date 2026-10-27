const pool = require("../db/pool");

// Admin status is read from the database on every check, NOT from the login
// token — tokens last 30 days, so a token-based flag goes stale when someone
// is promoted or demoted.
async function isAdmin(memberId) {
  if (!memberId) return false;
  const { rows: [m] } = await pool.query("SELECT is_admin FROM members WHERE id = $1", [memberId]);
  return !!m?.is_admin;
}

async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    if (!(await isAdmin(req.user.id))) return res.status(403).json({ error: "Admin only" });
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = requireAdmin;
module.exports.isAdmin = isAdmin;
