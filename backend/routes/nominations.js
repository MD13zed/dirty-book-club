const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const pool   = require("../db/pool");
const { auth } = require("../middleware/auth");

// Helper — fetch nominations with vote counts
async function fetchNominations(memberId = null) {
  const { rows } = await pool.query(
    `SELECT n.id, n.nominated_at,
            b.id AS book_id, b.title, b.author, b.series, b.cover_url,
            array_agg(DISTINCT g.genre) FILTER (WHERE g.genre IS NOT NULL) AS genres,
            COUNT(DISTINCT v.member_id)::int AS vote_count,
            m.id AS nominated_by_id,
            m.display_name AS nominated_by_name,
            ${memberId ? `BOOL_OR(v.member_id = $1) AS i_voted,
            BOOL_OR(n.nominated_by = $1) AS i_nominated` : `FALSE AS i_voted, FALSE AS i_nominated`}
     FROM nominations n
     JOIN books b ON b.id = n.book_id
     JOIN members m ON m.id = n.nominated_by
     LEFT JOIN book_genres g ON g.book_id = b.id
     LEFT JOIN nomination_votes v ON v.nomination_id = n.id
     GROUP BY n.id, b.id, b.title, b.author, b.series, b.cover_url, m.id, m.display_name
     ORDER BY vote_count DESC, n.nominated_at ASC`,
    memberId ? [memberId] : []
  );
  return rows;
}

// GET /api/nominations
router.get("/", auth, async (req, res) => {
  try {
    res.json(await fetchNominations(req.user.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/nominations — nominate a book
router.post("/", auth, async (req, res) => {
  const { book_id } = req.body;
  if (!book_id) return res.status(400).json({ error: "book_id required" });

  try {
    // Check book exists and isn't already current BOTM
    const { rows: [book] } = await pool.query("SELECT id, botm_month FROM books WHERE id = $1", [book_id]);
    if (!book) return res.status(404).json({ error: "Book not found" });
    if (book.botm_month) return res.status(400).json({ error: "This book is already a past Book of the Month" });

    const id = uuidv4();
    await pool.query(
      `INSERT INTO nominations (id, book_id, nominated_by) VALUES ($1,$2,$3)
       ON CONFLICT (book_id) DO NOTHING`,
      [id, book_id, req.user.id]
    );
    res.status(201).json(await fetchNominations(req.user.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/nominations/:id/vote — upvote
router.post("/:id/vote", auth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO nomination_votes (nomination_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id]
    );
    res.json(await fetchNominations(req.user.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/nominations/:id/vote — remove vote
router.delete("/:id/vote", auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM nomination_votes WHERE nomination_id=$1 AND member_id=$2",
      [req.params.id, req.user.id]
    );
    res.json(await fetchNominations(req.user.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/nominations/:id — remove nomination (own or admin)
router.delete("/:id", auth, async (req, res) => {
  try {
    const { rows: [nom] } = await pool.query("SELECT nominated_by FROM nominations WHERE id=$1", [req.params.id]);
    if (!nom) return res.status(404).json({ error: "Not found" });
    if (nom.nominated_by !== req.user.id && !req.user.is_admin)
      return res.status(403).json({ error: "Forbidden" });
    await pool.query("DELETE FROM nominations WHERE id=$1", [req.params.id]);
    res.json(await fetchNominations(req.user.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
