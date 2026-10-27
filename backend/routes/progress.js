const router = require("express").Router();
const { randomUUID: uuidv4 } = require("crypto");
const pool   = require("../db/pool");
const { auth } = require("../middleware/auth");
const { notifyDnf } = require("../discord");
const { fail, isUuid } = require("../http");
const { clubToday } = require("../clubtime");

const STATUSES = new Set(["want_to_read", "reading", "finished", "dnf"]);
const validDate = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !isNaN(d) && d.toISOString().slice(0, 10) === v;
};

// GET /api/progress?bookId=xxx  OR  own progress list
router.get("/", auth, async (req, res) => {
  try {
    if (req.query.bookId) {
      if (!isUuid(req.query.bookId)) return res.status(400).json({ error: "Invalid id" });
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
  } catch (e) { fail(res, e); }
});

// POST /api/progress — upsert
router.post("/", auth, async (req, res) => {
  const { book_id, status, total_pages, current_page, started_at, finished_at, dnf_reason } = req.body || {};
  if (!isUuid(book_id)) return res.status(400).json({ error: "book_id required" });

  // Validate everything up front so bad input gets a clear message, not a database error
  if (status !== undefined && status !== null && !STATUSES.has(status))
    return res.status(400).json({ error: "Invalid status" });
  const page = current_page ? Number(current_page) : 0;
  if (!Number.isInteger(page) || page < 0 || page > 100000)
    return res.status(400).json({ error: "Current page must be a whole number" });
  const pages = total_pages ? Number(total_pages) : null;
  if (pages !== null && (!Number.isInteger(pages) || pages < 1 || pages > 100000))
    return res.status(400).json({ error: "Total pages must be a whole number" });
  for (const [label, v] of [["Start date", started_at], ["Finish date", finished_at]]) {
    if (v && !validDate(String(v))) return res.status(400).json({ error: `${label} must look like YYYY-MM-DD` });
  }
  if (dnf_reason != null && (typeof dnf_reason !== "string" || dnf_reason.length > 2000))
    return res.status(400).json({ error: "DNF reason must be text (max 2000 characters)" });

  try {
    // A finished book always needs a finish date, otherwise it is invisible to
    // the digest / leaderboards. Default to today (club time, not UTC) if none was picked.
    const today = clubToday();
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
       status||"want_to_read", pages,
       page, started_at||null, finishedValue,
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
  } catch (e) { fail(res, e); }
});

module.exports = router;
