const router = require("express").Router();
const pool   = require("../db/pool");
const { auth } = require("../middleware/auth");

const VALID_THEMES = ["dark-purple","midnight","rose-gold","forest","ocean","blood"];

// GET /api/members
router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.display_name, m.avatar_url, m.bio, m.is_admin, m.theme, m.joined_at,
            (SELECT COUNT(*) FROM reviews   WHERE member_id = m.id) AS review_count,
            (SELECT COUNT(*) FROM reading_progress WHERE member_id = m.id AND status='finished') AS books_finished
     FROM members m ORDER BY m.joined_at ASC`
  );
  res.json(rows);
});

// GET /api/members/:id
router.get("/:id", async (req, res) => {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/members/me
router.patch("/me", auth, async (req, res) => {
  const { display_name, bio, theme } = req.body;
  const safeTheme = VALID_THEMES.includes(theme) ? theme : "dark-purple";
  await pool.query(
    `UPDATE members SET display_name=$1, bio=$2, theme=$3, last_seen=CURRENT_TIMESTAMP WHERE id=$4`,
    [display_name||null, bio||null, safeTheme, req.user.id]
  );
  const { rows: [m] } = await pool.query(
    "SELECT id, display_name, avatar_url, bio, is_admin, theme FROM members WHERE id = $1",
    [req.user.id]
  );
  res.json(m);
});

module.exports = router;
