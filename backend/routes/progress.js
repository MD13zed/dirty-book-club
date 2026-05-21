const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const pool   = require("../db/pool");
const { auth } = require("../middleware/auth");

// GET /api/progress?bookId=xxx  OR  own progress list
router.get("/", auth, async (req, res) => {
  try {
    if (req.query.bookId) {
      const { rows } = await pool.query(
        `SELECT rp.*, m.display_name AS member_name, m.avatar_url AS member_avatar
         FROM reading_progress rp JOIN members m ON m.id = rp.member_id
         WHERE rp.book_id = $1`,
        [req.query.bookId]
      );
      return res.json(rows);
    }
    const { rows } = await pool.query(
      `SELECT rp.*, b.title AS book_title, b.cover_url
       FROM reading_progress rp JOIN books b ON b.id = rp.book_id
       WHERE rp.member_id = $1 ORDER BY rp.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/progress — upsert
router.post("/", auth, async (req, res) => {
  const { book_id, status, total_pages, current_page, started_at, finished_at } = req.body;
  if (!book_id) return res.status(400).json({ error: "book_id required" });
  try {
    await pool.query(
      `INSERT INTO reading_progress (id, book_id, member_id, status, total_pages, current_page, started_at, finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (book_id, member_id) DO UPDATE SET
         status       = EXCLUDED.status,
         total_pages  = EXCLUDED.total_pages,
         current_page = EXCLUDED.current_page,
         started_at   = COALESCE(EXCLUDED.started_at, reading_progress.started_at),
         finished_at  = EXCLUDED.finished_at,
         updated_at   = CURRENT_TIMESTAMP`,
      [uuidv4(), book_id, req.user.id,
       status||"want_to_read", total_pages||null,
       current_page||0, started_at||null, finished_at||null]
    );
    const { rows: [row] } = await pool.query(
      "SELECT * FROM reading_progress WHERE book_id = $1 AND member_id = $2",
      [book_id, req.user.id]
    );
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
