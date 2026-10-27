const router = require("express").Router();
const { randomUUID: uuidv4 } = require("crypto");
const pool   = require("../db/pool");
const { auth } = require("../middleware/auth");
const { notifyBookAdded } = require("../discord");
const { isAdmin } = require("../middleware/requireAdmin");
const { fail, uuidParam } = require("../http");
const { GENRES, TW_TAGS } = require("../taxonomy");

const MAX_GENRES = 8; // keep in sync with MAX_GENRES in frontend/src/components/ui.jsx
const GENRE_SET  = new Set(GENRES);
const TW_SET     = new Set(TW_TAGS);
const SOURCES    = new Set(["manual", "csv"]);

router.param("id", uuidParam);
router.use(auth);   // the whole library is members-only

// ── validation helpers ───────────────────────────────────────────────────────
// Returns { tags } (tags is undefined when the field wasn't sent) or { error }.
// Only tags from our lists are accepted — plus any the book already has, so
// editing an older book never fails because a tag was retired from the list.
function parseTags(value, allowed, label, { max = Infinity, extra = new Set() } = {}) {
  if (value === undefined) return { tags: undefined };
  if (!Array.isArray(value)) return { error: `${label}s must be a list` };
  const tags = [];
  for (const raw of value) {
    if (typeof raw !== "string") return { error: `${label}s must be text` };
    const t = raw.trim();
    if (!t) continue;
    if (!allowed.has(t) && !extra.has(t)) return { error: `Unknown ${label}: ${t.slice(0, 40)}` };
    if (!tags.includes(t)) tags.push(t);
  }
  if (tags.length > max) return { error: `Up to ${max} ${label}s per book` };
  return { tags };
}

function validDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !isNaN(d) && d.toISOString().slice(0, 10) === v;
}

// Cleans the plain book columns. `partial` = PATCH: only fields that were sent.
function cleanBookFields(b, { partial }) {
  const out = {};
  const has = (k) => !partial || Object.prototype.hasOwnProperty.call(b, k);

  if (has("title")) {
    const t = typeof b.title === "string" ? b.title.trim() : "";
    if (!t) return { error: "Title required" };
    if (t.length > 500) return { error: "Title is too long (max 500 characters)" };
    out.title = t;
  }
  for (const [key, label, max] of [["author", "Author", 300], ["series", "Series", 300]]) {
    if (has(key)) {
      const v = b[key] == null ? "" : String(b[key]).trim();
      if (v.length > max) return { error: `${label} is too long (max ${max} characters)` };
      out[key] = v;
    }
  }
  if (has("cover_url")) {
    const v = b.cover_url == null ? "" : String(b.cover_url).trim();
    if (v.length > 500) return { error: "Cover URL is too long" };
    if (v && !/^https?:\/\//i.test(v)) return { error: "Cover URL must start with http:// or https://" };
    out.cover_url = v;
  }
  if (has("date_read")) {
    const v = b.date_read || null;
    if (v !== null && !validDate(String(v))) return { error: "Date read must look like YYYY-MM-DD" };
    out.date_read = v;
  }
  if (has("total_pages")) {
    const v = b.total_pages ? Number(b.total_pages) : null;
    if (v !== null && (!Number.isInteger(v) || v < 1 || v > 20000)) return { error: "Total pages must be a whole number (1–20000)" };
    out.total_pages = v;
  }
  return { fields: out };
}

// Replace a book's tags (genres or trigger warnings) inside a transaction.
// `table`/`col` are fixed strings from this file, never user input.
async function setTags(db, table, col, bookId, tags) {
  await db.query(`DELETE FROM ${table} WHERE book_id=$1`, [bookId]);
  if (tags.length) {
    await db.query(`INSERT INTO ${table} (book_id, ${col}) SELECT $1, UNNEST($2::text[])`, [bookId, tags]);
  }
}

// Same title+author (ignoring case, punctuation and a trailing "(Series #1)") = same book
function dupKey(title, author) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${norm(String(title || "").replace(/\s*\([^)]*\)\s*$/, ""))}|${norm(author)}`;
}

async function attachExtras(books) {
  if (!books.length) return books;
  const ids = books.map(b => b.id);

  const { rows: genreRows } = await pool.query(
    `SELECT book_id, genre FROM book_genres WHERE book_id = ANY($1)`, [ids]
  );
  const { rows: twRows } = await pool.query(
    `SELECT book_id, tag FROM book_tw WHERE book_id = ANY($1)`, [ids]
  );

  const genreMap = {}, twMap = {};
  genreRows.forEach(r => { (genreMap[r.book_id] = genreMap[r.book_id] || []).push(r.genre); });
  twRows.forEach(r =>    { (twMap[r.book_id]    = twMap[r.book_id]    || []).push(r.tag);   });

  return books.map(b => ({ ...b, genres: genreMap[b.id] || [], trigger_warnings: twMap[b.id] || [] }));
}

// GET /api/books
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*,
              m.display_name AS added_by_name,
              ROUND(AVG(r.rating)::numeric,1) AS avg_rating,
              COUNT(r.id)::int AS review_count
       FROM books b
       LEFT JOIN members m ON m.id = b.added_by
       LEFT JOIN reviews r ON r.book_id = b.id AND r.rating > 0
       GROUP BY b.id, m.display_name
       ORDER BY b.added_at DESC`
    );
    res.json(await attachExtras(rows));
  } catch (e) { fail(res, e); }
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

    const { rows: genres }   = await pool.query("SELECT genre FROM book_genres WHERE book_id=$1", [req.params.id]);
    const { rows: tws }      = await pool.query("SELECT tag FROM book_tw WHERE book_id=$1", [req.params.id]);
    const { rows: reviews }  = await pool.query(
      `SELECT r.*, m.display_name AS member_name, m.avatar_url AS member_avatar
       FROM reviews r JOIN members m ON m.id=r.member_id WHERE r.book_id=$1`,
      [req.params.id]
    );
    const { rows: progress } = await pool.query(
      `SELECT rp.*, m.display_name AS member_name
       FROM reading_progress rp JOIN members m ON m.id=rp.member_id WHERE rp.book_id=$1`,
      [req.params.id]
    );

    res.json({
      ...book,
      genres:           genres.map(g => g.genre),
      trigger_warnings: tws.map(t => t.tag),
      reviews,
      progress,
    });
  } catch (e) { fail(res, e); }
});

// POST /api/books/import — many books in one request (Goodreads CSV import).
// Skips books already in the library; never posts to Discord.
router.post("/import", async (req, res) => {
  const list = req.body?.books;
  if (!Array.isArray(list) || list.length === 0) return res.status(400).json({ error: "books list required" });
  if (list.length > 200) return res.status(400).json({ error: "Send at most 200 books per request" });

  try {
    const { rows: existing } = await pool.query("SELECT title, author FROM books");
    const seen = new Set(existing.map(r => dupKey(r.title, r.author)));

    const rows = [];
    let skipped = 0, invalid = 0;
    for (const raw of list) {
      const { fields, error } = cleanBookFields(raw || {}, { partial: false });
      if (error) { invalid++; continue; }
      const key = dupKey(fields.title, fields.author);
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);
      rows.push({ id: uuidv4(), ...fields });
    }

    let added = [];
    if (rows.length) {
      const { rows: inserted } = await pool.query(
        `INSERT INTO books (id, title, author, series, cover_url, date_read, added_by, total_pages, source)
         SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[],
                              $6::date[], $7::uuid[], $8::int[], $9::text[])
         RETURNING *`,
        [
          rows.map(r => r.id), rows.map(r => r.title), rows.map(r => r.author), rows.map(r => r.series),
          rows.map(r => r.cover_url), rows.map(r => r.date_read), rows.map(() => req.user.id),
          rows.map(r => r.total_pages), rows.map(() => "csv"),
        ]
      );
      added = inserted.map(b => ({ ...b, genres: [], trigger_warnings: [] }));
    }
    res.status(201).json({ added, skipped, invalid });
  } catch (e) { fail(res, e); }
});

// POST /api/books
router.post("/", async (req, res) => {
  const body = req.body || {};
  const { fields, error } = cleanBookFields(body, { partial: false });
  if (error) return res.status(400).json({ error });
  const g = parseTags(body.genres ?? [], GENRE_SET, "genre", { max: MAX_GENRES });
  if (g.error) return res.status(400).json({ error: g.error });
  const t = parseTags(body.trigger_warnings ?? [], TW_SET, "trigger warning");
  if (t.error) return res.status(400).json({ error: t.error });

  const silent = !!body.silent;
  const source = SOURCES.has(body.source) ? body.source : "manual";
  const id = uuidv4();

  // The book and its tags are saved together or not at all
  let book;
  try {
    book = await pool.withTx(async (db) => {
      await db.query(
        `INSERT INTO books (id, title, author, series, cover_url, date_read, added_by, total_pages, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, fields.title, fields.author, fields.series, fields.cover_url, fields.date_read, req.user.id, fields.total_pages, source]
      );
      await setTags(db, "book_genres", "genre", id, g.tags);
      await setTags(db, "book_tw", "tag", id, t.tags);
      const { rows: [row] } = await db.query("SELECT * FROM books WHERE id=$1", [id]);
      return row;
    });
  } catch (e) { return fail(res, e); }

  // A Discord hiccup must never turn a saved book into an error (the user would retry → duplicate)
  if (!silent) {
    try {
      await notifyBookAdded({
        title:          book.title,
        author:         book.author,
        series:         book.series,
        genres:         g.tags,
        cover_url:      book.cover_url,
        added_by_name:  req.user.display_name || req.user.username,
      });
    } catch (e) { console.error("Discord notification failed:", e.message); }
  }

  res.status(201).json({ ...book, genres: g.tags, trigger_warnings: t.tags });
});

// PATCH /api/books/:id
router.patch("/:id", async (req, res) => {
  const body = req.body || {};
  const { fields, error } = cleanBookFields(body, { partial: true });
  if (error) return res.status(400).json({ error });
  const id = req.params.id;

  try {
    const { rows: [exists] } = await pool.query("SELECT id FROM books WHERE id=$1", [id]);
    if (!exists) return res.status(404).json({ error: "Not found" });

    const { rows: curG } = await pool.query("SELECT genre FROM book_genres WHERE book_id=$1", [id]);
    const { rows: curT } = await pool.query("SELECT tag FROM book_tw WHERE book_id=$1", [id]);
    const g = parseTags(body.genres, GENRE_SET, "genre", { max: MAX_GENRES, extra: new Set(curG.map(r => r.genre)) });
    if (g.error) return res.status(400).json({ error: g.error });
    const t = parseTags(body.trigger_warnings, TW_SET, "trigger warning", { extra: new Set(curT.map(r => r.tag)) });
    if (t.error) return res.status(400).json({ error: t.error });

    const result = await pool.withTx(async (db) => {
      const keys = Object.keys(fields);   // fixed column names from cleanBookFields, never user keys
      if (keys.length) {
        await db.query(
          `UPDATE books SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(", ")} WHERE id=$${keys.length + 1}`,
          [...keys.map(k => fields[k]), id]
        );
      }
      if (g.tags !== undefined) await setTags(db, "book_genres", "genre", id, g.tags);
      if (t.tags !== undefined) await setTags(db, "book_tw", "tag", id, t.tags);
      const { rows: [book] }    = await db.query("SELECT * FROM books WHERE id=$1", [id]);
      const { rows: genreRows } = await db.query("SELECT genre FROM book_genres WHERE book_id=$1", [id]);
      const { rows: twRows }    = await db.query("SELECT tag FROM book_tw WHERE book_id=$1", [id]);
      return { ...book, genres: genreRows.map(r => r.genre), trigger_warnings: twRows.map(r => r.tag) };
    });
    res.json(result);
  } catch (e) { fail(res, e); }
});

// DELETE /api/books/:id
router.delete("/:id", async (req, res) => {
  try {
    const { rows: [book] } = await pool.query("SELECT added_by FROM books WHERE id=$1", [req.params.id]);
    if (!book) return res.status(404).json({ error: "Not found" });
    if (book.added_by !== req.user.id && !(await isAdmin(req.user.id)))
      return res.status(403).json({ error: "Forbidden" });
    await pool.query("DELETE FROM books WHERE id=$1", [req.params.id]);
    res.json({ deleted: true });
  } catch (e) { fail(res, e); }
});

module.exports = router;
