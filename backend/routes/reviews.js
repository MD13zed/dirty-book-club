const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const pool   = require("../db/pool");
const { auth } = require("../middleware/auth");
const { notifyReviewLeft } = require("../discord");

// GET /api/reviews?bookId=xxx  OR  GET /api/reviews (all)
router.get("/", async (req, res) => {
  try {
    if (req.query.bookId) {
      const { rows } = await pool.query(
        `SELECT r.*, m.display_name AS member_name, m.avatar_url AS member_avatar
         FROM reviews r JOIN members m ON m.id = r.member_id
         WHERE r.book_id = $1 ORDER BY r.updated_at DESC`,
        [req.query.bookId]
      );
      return res.json(rows);
    }
    const { rows } = await pool.query(
      `SELECT r.*, m.display_name AS member_name, m.avatar_url AS member_avatar
       FROM reviews r JOIN members m ON m.id = r.member_id
       ORDER BY r.updated_at DESC`
    );
    const map = {};
    rows.forEach(r => { (map[r.book_id] = map[r.book_id] || []).push(r); });
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/reviews — upsert a review
router.post("/", auth, async (req, res) => {
  const { book_id, rating = 0, notes = "" } = req.body;
  if (!book_id) return res.status(400).json({ error: "book_id required" });

  try {
    await pool.query(
      `INSERT INTO reviews (id, book_id, member_id, rating, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (book_id, member_id)
       DO UPDATE SET rating=$4, notes=$5, updated_at=CURRENT_TIMESTAMP`,
      [uuidv4(), book_id, req.user.id, rating, notes]
    );
    const { rows: [r] } = await pool.query(
      `SELECT r.*, m.display_name AS member_name, m.avatar_url AS member_avatar,
              b.title AS book_title
       FROM reviews r
       JOIN members m ON m.id = r.member_id
       JOIN books b ON b.id = r.book_id
       WHERE r.book_id = $1 AND r.member_id = $2`,
      [book_id, req.user.id]
    );

    // Discord notification
    notifyReviewLeft({
      book_title:  r.book_title,
      member_name: r.member_name,
      rating:      r.rating,
      notes:       r.notes,
    });

    res.status(201).json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/reviews/:bookId — delete own review
router.delete("/:bookId", auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM reviews WHERE book_id = $1 AND member_id = $2",
      [req.params.bookId, req.user.id]
    );
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
