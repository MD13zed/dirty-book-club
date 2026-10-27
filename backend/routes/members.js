const router = require("express").Router();
const pool   = require("../db/pool");
const { auth } = require("../middleware/auth");
const { fail, uuidParam } = require("../http");

router.param("id", uuidParam);

const VALID_THEMES = ["dark-purple","midnight","rose-gold","forest","ocean","blood"];

// GET /api/members
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.display_name, m.avatar_url, m.bio, m.is_admin, m.theme, m.joined_at,
              (SELECT COUNT(*) FROM reviews   WHERE member_id = m.id) AS review_count,
              (SELECT COUNT(*) FROM reading_progress WHERE member_id = m.id AND status='finished') AS books_finished
       FROM members m ORDER BY m.joined_at ASC`
    );
    res.json(rows);
  } catch (e) { fail(res, e); }
});

// GET /api/members/:id
router.get("/:id", auth, async (req, res) => {
  try {
    const { rows: [m] } = await pool.query(
      `SELECT id, display_name, avatar_url, bio, is_admin, theme, joined_at
       FROM members WHERE id = $1`,
      [req.params.id]
    );
    if (!m) return res.status(404).json({ error: "Not found" });

    const { rows: reviews }  = await pool.query(
      `SELECT r.*, b.title AS book_title, b.author AS book_author, b.cover_url
       FROM reviews r JOIN books b ON b.id = r.book_id
       WHERE r.member_id = $1 AND r.rating > 0 ORDER BY r.updated_at DESC`,
      [req.params.id]
    );
    const { rows: progress } = await pool.query(
      `SELECT rp.*, b.title AS book_title, b.cover_url
       FROM reading_progress rp JOIN books b ON b.id = rp.book_id
       WHERE rp.member_id = $1 ORDER BY rp.updated_at DESC`,
      [req.params.id]
    );
    res.json({ ...m, reviews, progress });
  } catch (e) { fail(res, e); }
});

// PATCH /api/members/me
router.patch("/me", auth, async (req, res) => {
  const body = req.body || {};
  const has  = (k) => Object.prototype.hasOwnProperty.call(body, k);

  // Only touch what was sent; blank display name / bio clears it (falls back to the Discord name)
  const sets = [], vals = [];
  if (has("display_name")) {
    const v = body.display_name == null ? "" : String(body.display_name).trim();
    if (v.length > 100) return res.status(400).json({ error: "Display name is too long (max 100 characters)" });
    vals.push(v || null); sets.push(`display_name=$${vals.length}`);
  }
  if (has("bio")) {
    const v = body.bio == null ? "" : String(body.bio).trim();
    if (v.length > 1000) return res.status(400).json({ error: "Bio is too long (max 1000 characters)" });
    vals.push(v || null); sets.push(`bio=$${vals.length}`);
  }
  if (has("theme")) {
    vals.push(VALID_THEMES.includes(body.theme) ? body.theme : "dark-purple"); sets.push(`theme=$${vals.length}`);
  }

  try {
    vals.push(req.user.id);
    await pool.query(
      `UPDATE members SET ${sets.concat("last_seen=CURRENT_TIMESTAMP").join(", ")} WHERE id=$${vals.length}`,
      vals
    );
    const { rows: [m] } = await pool.query(
      "SELECT id, display_name, avatar_url, bio, is_admin, theme FROM members WHERE id = $1",
      [req.user.id]
    );
    res.json(m);
  } catch (e) { fail(res, e); }
});

module.exports = router;
