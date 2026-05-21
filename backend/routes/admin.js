const router       = require("express").Router();
const pool         = require("../db/pool");
const { auth }     = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");

router.use(auth, requireAdmin);

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  const { rows: [{ total_books }]   } = await pool.query("SELECT COUNT(*) AS total_books FROM books");
  const { rows: [{ total_reviews }] } = await pool.query("SELECT COUNT(*) AS total_reviews FROM reviews");
  const { rows: [{ total_members }] } = await pool.query("SELECT COUNT(*) AS total_members FROM members");
  const { rows: [{ avg_rating }]    } = await pool.query("SELECT ROUND(AVG(rating)::numeric,2) AS avg_rating FROM reviews WHERE rating > 0");

  const { rows: top_books } = await pool.query(
    `SELECT b.title, b.author, ROUND(AVG(r.rating)::numeric,1) AS avg, COUNT(r.id) AS reviews
     FROM books b JOIN reviews r ON r.book_id = b.id AND r.rating > 0
     GROUP BY b.id ORDER BY avg DESC, reviews DESC LIMIT 5`
  );
  const { rows: genre_counts } = await pool.query(
    `SELECT genre, COUNT(*) AS count FROM book_genres GROUP BY genre ORDER BY count DESC`
  );
  const { rows: recent_activity } = await pool.query(
    `SELECT 'review' AS type, r.updated_at AS ts, m.display_name AS member, b.title AS book
     FROM reviews r JOIN members m ON m.id = r.member_id JOIN books b ON b.id = r.book_id
     ORDER BY ts DESC LIMIT 10`
  );

  res.json({ total_books, total_reviews, total_members, avg_rating, top_books, genre_counts, recent_activity });
});

// GET /api/admin/members
router.get("/members", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.discord_id, m.username, m.display_name, m.is_admin, m.joined_at, m.last_seen,
            (SELECT COUNT(*) FROM reviews WHERE member_id = m.id) AS reviews
     FROM members m ORDER BY m.joined_at DESC`
  );
  res.json(rows);
});

// PATCH /api/admin/members/:id/admin
router.patch("/members/:id/admin", async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Cannot change own admin" });
  await pool.query("UPDATE members SET is_admin=$1 WHERE id=$2", [!!req.body.is_admin, req.params.id]);
  res.json({ updated: true });
});

// DELETE /api/admin/members/:id
router.delete("/members/:id", async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Cannot delete yourself" });
  await pool.query("DELETE FROM members WHERE id=$1", [req.params.id]);
  res.json({ deleted: true });
});

// DELETE /api/admin/books/:id
router.delete("/books/:id", async (req, res) => {
  await pool.query("DELETE FROM books WHERE id=$1", [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
