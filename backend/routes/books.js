const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const pool   = require("../db/pool");
const { auth } = require("../middleware/auth");

async function attachGenres(books) {
  if (!books.length) return books;
  const ids = books.map(b => b.id);
  const { rows } = await pool.query(
    `SELECT book_id, genre FROM book_genres WHERE book_id = ANY($1)`, [ids]
  );
  const map = {};
  rows.forEach(r => { (map[r.book_id] = map[r.book_id] || []).push(r.genre); });
  return books.map(b => ({ ...b, genres: map[b.id] || [] }));
}

// GET /api/books
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*,
              m.display_name AS added_by_name,
              ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
              COUNT(r.id) AS review_count
       FROM books b
       LEFT JOIN members m ON m.id = b.added_by
       LEFT JOIN reviews r ON r.book_id = b.id AND r.rating > 0
       GROUP BY b.id, m.display_name
       ORDER BY b.added_at DESC`
    );
    res.json(await attachGenres(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/books/:id
router.get("/:id", async (req, res) => {
  try {
    const { rows: [book] } = await pool.query(
      `SELECT b.*, m.display_name AS added_by_name FROM books b
       LEFT JOIN members m ON m.id = b.added_by WHERE b.id = $1`,
      [req.params.id]
    );
    if (!book) return res.status(404).json({ error: "Not found" });

    const { rows: genres }   = await pool.query("SELECT genre FROM book_genres WHERE book_id = $1", [req.params.id]);
    const { rows: reviews }  = await pool.query(
      `SELECT r.*, m.display_name AS member_name, m.avatar_url AS member_avatar
       FROM reviews r JOIN members m ON m.id = r.member_id WHERE r.book_id = $1`,
      [req.params.id]
    );
    const { rows: progress } = await pool.query(
      `SELECT rp.*, m.display_name AS member_name
       FROM reading_progress rp JOIN members m ON m.id = rp.member_id WHERE rp.book_id = $1`,
      [req.params.id]
    );
    res.json({ ...book, genres: genres.map(g => g.genre), reviews, progress });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/books
router.post("/", auth, async (req, res) => {
  const { title, author, series, cover_url, date_read, genres = [] } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title required" });

  const id = uuidv4();
  try {
    await pool.query(
      `INSERT INTO books (id, title, author, series, cover_url, date_read, added_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, title.trim(), author||"", series||"", cover_url||"", date_read||null, req.user.id]
    );
    for (const g of genres.slice(0, 3)) {
      await pool.query(
        "INSERT INTO book_genres (book_id, genre) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [id, g]
      );
    }
    const { rows: [book] } = await pool.query("SELECT * FROM books WHERE id = $1", [id]);
    res.status(201).json({ ...book, genres });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/books/:id
router.patch("/:id", auth, async (req, res) => {
  const { title, author, series, cover_url, date_read, genres } = req.body;
  try {
    await pool.query(
      `UPDATE books SET title=$1, author=$2, series=$3, cover_url=$4, date_read=$5 WHERE id=$6`,
      [title, author, series, cover_url||"", date_read||null, req.params.id]
    );
    if (Array.isArray(genres)) {
      await pool.query("DELETE FROM book_genres WHERE book_id = $1", [req.params.id]);
      for (const g of genres.slice(0, 3)) {
        await pool.query(
          "INSERT INTO book_genres (book_id, genre) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [req.params.id, g]
        );
      }
    }
    const { rows: [book] }  = await pool.query("SELECT * FROM books WHERE id = $1", [req.params.id]);
    const { rows: genreRows } = await pool.query("SELECT genre FROM book_genres WHERE book_id = $1", [req.params.id]);
    res.json({ ...book, genres: genreRows.map(g => g.genre) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/books/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const { rows: [book] } = await pool.query("SELECT added_by FROM books WHERE id = $1", [req.params.id]);
    if (!book) return res.status(404).json({ error: "Not found" });
    if (book.added_by !== req.user.id && !req.user.isAdmin)
      return res.status(403).json({ error: "Forbidden" });
    await pool.query("DELETE FROM books WHERE id = $1", [req.params.id]);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
