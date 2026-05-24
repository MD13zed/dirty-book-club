const router       = require("express").Router();
const pool         = require("../db/pool");
const { auth }     = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const { announceBookOfTheMonth, postTbrPoll } = require("../discord");

router.use(auth, requireAdmin);

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  try {
    const { rows: [{ total_books }] }   = await pool.query("SELECT COUNT(*) AS total_books FROM books");
    const { rows: [{ total_reviews }] } = await pool.query("SELECT COUNT(*) AS total_reviews FROM reviews");
    const { rows: [{ total_members }] } = await pool.query("SELECT COUNT(*) AS total_members FROM members");
    const { rows: [{ avg_rating }] }    = await pool.query("SELECT ROUND(AVG(rating)::numeric,2) AS avg_rating FROM reviews WHERE rating>0");

    const { rows: top_books } = await pool.query(
      `SELECT b.title, b.author, ROUND(AVG(r.rating)::numeric,1) AS avg, COUNT(r.id) AS reviews
       FROM books b JOIN reviews r ON r.book_id=b.id AND r.rating>0
       GROUP BY b.id, b.title, b.author ORDER BY avg DESC, reviews DESC LIMIT 5`
    );
    const { rows: genre_counts } = await pool.query(
      `SELECT genre, COUNT(*) AS count FROM book_genres GROUP BY genre ORDER BY count DESC`
    );
    const { rows: recent_activity } = await pool.query(
      `SELECT 'review' AS type, r.updated_at AS ts, m.display_name AS member, b.title AS book
       FROM reviews r JOIN members m ON m.id=r.member_id JOIN books b ON b.id=r.book_id
       ORDER BY ts DESC LIMIT 10`
    );

    res.json({ total_books, total_reviews, total_members, avg_rating, top_books, genre_counts, recent_activity });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/members
router.get("/members", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, discord_id, username, display_name, is_admin, joined_at, last_seen,
              (SELECT COUNT(*) FROM reviews WHERE member_id=members.id) AS reviews
       FROM members ORDER BY joined_at DESC`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/admin/members/:id/admin
router.patch("/members/:id/admin", async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Cannot change own admin status" });
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

// POST /api/admin/botm
router.post("/botm", async (req, res) => {
  try {
    const { book_id, month } = req.body;
    if (!book_id || !month) return res.status(400).json({ error: "book_id and month required" });

    const { rows: [book] } = await pool.query("SELECT * FROM books WHERE id=$1", [book_id]);
    if (!book) return res.status(404).json({ error: "Book not found" });

    await pool.query("UPDATE books SET botm_month=NULL");
    await pool.query("UPDATE books SET botm_month=$1 WHERE id=$2", [month, book_id]);

    const { rows: genreRows } = await pool.query("SELECT genre FROM book_genres WHERE book_id=$1", [book_id]);
    const genres = genreRows.map(g => g.genre);

    announceBookOfTheMonth({
      title: book.title, author: book.author, series: book.series,
      genres, cover_url: book.cover_url, month,
    }).catch(e => console.error("Discord announce error:", e.message));

    res.json({ announced: true, month, book_title: book.title });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/tbr-poll — post a Discord poll from nominations
router.post("/tbr-poll", async (req, res) => {
  try {
    const { book_ids, duration_hours = 48 } = req.body;
    if (!book_ids?.length) return res.status(400).json({ error: "book_ids required" });
    if (book_ids.length < 2) return res.status(400).json({ error: "Need at least 2 books for a poll" });
    if (book_ids.length > 10) return res.status(400).json({ error: "Max 10 books per poll" });

    const { rows: books } = await pool.query(
      "SELECT id, title, author FROM books WHERE id=ANY($1)", [book_ids]
    );

    await postTbrPoll({ books, duration_hours });
    res.json({ posted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
