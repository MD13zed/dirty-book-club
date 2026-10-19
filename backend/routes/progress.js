const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const pool   = require("../db/pool");
const { auth } = require("../middleware/auth");
const { notifyDnf } = require("../discord");

// GET /api/progress?bookId=xxx  OR  own progress list
router.get("/", auth, async (req, res) => {
  try {
    if (req.query.bookId) {
      const { rows } = await pool.query(
        `SELECT rp.*, m.display_name AS member_name, m.avatar_url AS member_avatar
         FROM reading_progress rp JOIN members m ON m.id=rp.member_id
         WHERE rp.book_id=$1`,
        [req.query.bookId]
      );
      return res.json(rows);
    }
    const { rows } = await pool.query(
      `SELECT rp.*, b.title AS book_title, b.cover_url
       FROM reading_progress rp JOIN books b ON b.id=rp.book_id
       WHERE rp.member_id=$1 ORDER BY rp.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/progress — upsert
router.post("/", auth, async (req, res) => {
  const { book_id, status, total_pages, current_page, started_at, finished_at, dnf_reason } = req.body;
  if (!book_id) return res.status(400).json({ error: "book_id required" });

  try {
    // A finished book always needs a finish date, otherwise it is invisible to
    // the digest / leaderboards. Default to today if none was picked.
    const today = new Date().toISOString().slice(0, 10);
    const finishedValue = status === "finished" ? (finished_at || today) : (finished_at || null);

    // Previous state, so we only announce a DNF once (not on every save)
    const { rows: [prev] } = await pool.query(
      "SELECT status, dnf_reason FROM reading_progress WHERE book_id=$1 AND member_id=$2",
      [book_id, req.user.id]
    );

    await pool.query(
      `INSERT INTO reading_progress (id, book_id, member_id, status, total_pages, current_page, started_at, finished_at, dnf_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (book_id, member_id) DO UPDATE SET
         status       = EXCLUDED.status,
         total_pages  = EXCLUDED.total_pages,
         current_page = EXCLUDED.current_page,
         started_at   = COALESCE(EXCLUDED.started_at, reading_progress.started_at),
         finished_at  = EXCLUDED.finished_at,
         dnf_reason   = EXCLUDED.dnf_reason,
         updated_at   = CURRENT_TIMESTAMP`,
      [uuidv4(), book_id, req.user.id,
       status||"want_to_read", total_pages||null,
       current_page||0, started_at||null, finishedValue,
       dnf_reason||null]
    );
    const { rows: [row] } = await pool.query(
      "SELECT * FROM reading_progress WHERE book_id=$1 AND member_id=$2",
      [book_id, req.user.id]
    );

    // Discord: announce when someone newly DNFs a book, and once more if they
    // add a reason afterwards. Later edits to the reason stay quiet.
    if (row.status === "dnf") {
      const newlyDnf    = prev?.status !== "dnf";
      const reasonAdded = prev?.status === "dnf" && !(prev.dnf_reason || "").trim() && !!(row.dnf_reason || "").trim();
      if (newlyDnf || reasonAdded) {
        const { rows: [info] } = await pool.query(
          `SELECT b.title, COALESCE(m.display_name, m.username) AS member_name
           FROM books b, members m WHERE b.id=$1 AND m.id=$2`,
          [book_id, req.user.id]
        );
        if (info) await notifyDnf({
          book_title:  info.title,
          member_name: info.member_name,
          reason:      row.dnf_reason,
          reasonOnly:  reasonAdded,
        });
      }
    }

    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
