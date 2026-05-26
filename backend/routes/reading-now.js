const router = require("express").Router();
const pool   = require("../db/pool");
const { auth } = require("../middleware/auth");

// GET /api/reading-now — all members currently reading, with book and progress info
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        rp.current_page,
        rp.total_pages,
        rp.updated_at,
        b.id          AS book_id,
        b.title,
        b.author,
        b.series,
        b.cover_url,
        b.total_pages AS book_total_pages,
        m.id          AS member_id,
        m.display_name,
        m.username,
        m.avatar_url
      FROM reading_progress rp
      JOIN books   b ON b.id = rp.book_id
      JOIN members m ON m.id = rp.member_id
      WHERE rp.status = 'reading'
      ORDER BY rp.updated_at DESC
    `);
    // Use book total_pages as fallback if progress doesn't have it
    const data = rows.map(r => ({
      ...r,
      total_pages: r.total_pages || r.book_total_pages,
    }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
