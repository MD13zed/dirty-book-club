const router = require("express").Router();
const axios  = require("axios");

// Open Library (and Google Books' image host) are unreachable from some client
// networks (carrier/DNS/content filters close the connection by hostname) and
// Google thumbnails are often http (mixed-content on an https page). These
// routes proxy the search and the cover images through our own server, which
// can reach them fine, so the client only ever talks to our own origin.
//
// Google Books also requires an API key to avoid unkeyed rate limits/403s.
// Set GOOGLE_BOOKS_API_KEY in the backend environment to enable it; if it's
// absent, search gracefully falls back to Open Library only.

const OL_SEARCH   = "https://openlibrary.org/search.json";
const GB_SEARCH   = "https://www.googleapis.com/books/v1/volumes";
const COVER_OL    = "covers.openlibrary.org";
const UA          = "TheSpicyShelf/1.0 (private book club app)";
const TIMEOUT     = 5000;

// ── helpers ────────────────────────────────────────────────────────────────
function stripSeries(rawTitle) {
  if (!rawTitle) return { title: "", series: "" };
  const m = rawTitle.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (!m) return { title: rawTitle.trim(), series: "" };
  const inside = m[2].trim();
  if (/book\s*\d|#\s*\d|\bseries\b|\bduet\b|\btrilogy\b|\bsaga\b/i.test(inside)) {
    return { title: m[1].trim(), series: inside };
  }
  return { title: rawTitle.trim(), series: "" };
}

function normKey(title, author) {
  const norm = s => (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const { title: core } = stripSeries(title);
  return `${norm(core)}|${norm(author)}`;
}

function mapOpenLibrary(docs) {
  return (docs || []).map(d => ({
    title:       d.title || "",
    author:      (d.author_name || [])[0] || "",
    cover_url:   d.cover_i ? `https://${COVER_OL}/b/id/${d.cover_i}-M.jpg` : "",
    total_pages: d.number_of_pages_median || "",
    isbn:        (d.isbn || [])[0] || "",
    series:      (d.series || [])[0] || "",
    subjects:    d.subject || [],
    source:      "openlibrary",
  }));
}

function mapGoogle(items) {
  return (items || []).map(it => {
    const v   = it.volumeInfo || {};
    const ids = v.industryIdentifiers || [];
    const i13 = ids.find(x => x.type === "ISBN_13");
    const i10 = ids.find(x => x.type === "ISBN_10");
    let cover = (v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || "";
    if (cover) cover = cover.replace(/^http:/, "https:"); // proxied client-side via coverSrc()
    return {
      title:       v.title || "",
      author:      (v.authors || [])[0] || "",
      cover_url:   cover,
      total_pages: v.pageCount || "",
      isbn:        (i13 && i13.identifier) || (i10 && i10.identifier) || "",
      series:      "",
      subjects:    v.categories || [],
      source:      "google",
    };
  });
}

// OL is canonical (first-seen wins) but a Google duplicate backfills any
// cover / page count / isbn that OL was missing. Capped at 8.
function merge(ol, google) {
  const byKey = new Map();
  const order = [];
  for (const r of [...ol, ...google]) {
    if (!r.title) continue;
    const k = normKey(r.title, r.author);
    if (!byKey.has(k)) { byKey.set(k, { ...r }); order.push(k); }
    else {
      const kept = byKey.get(k);
      if (!kept.cover_url   && r.cover_url)   kept.cover_url   = r.cover_url;
      if (!kept.total_pages && r.total_pages) kept.total_pages = r.total_pages;
      if (!kept.isbn        && r.isbn)        kept.isbn        = r.isbn;
    }
  }
  return order.slice(0, 8).map(k => byKey.get(k));
}

// ── GET /api/booksearch?q=... ───────────────────────────────────────────────
router.get("/", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (q.length < 3) return res.json([]);

  const olReq = axios.get(OL_SEARCH, {
    params:  { q, limit: 6, fields: "key,title,author_name,cover_i,number_of_pages_median,first_publish_year,isbn,subject,series" },
    timeout: TIMEOUT,
    headers: { "User-Agent": UA },
  });

  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const gbReq = key
    ? axios.get(GB_SEARCH, {
        params:  { q, maxResults: 6, printType: "books", country: process.env.GOOGLE_BOOKS_COUNTRY || "US", key },
        timeout: TIMEOUT,
        headers: { "User-Agent": UA },
      })
    : Promise.reject(new Error("no google books key"));

  const [olRes, gbRes] = await Promise.allSettled([olReq, gbReq]);

  const ol = olRes.status === "fulfilled" ? mapOpenLibrary(olRes.value.data && olRes.value.data.docs) : [];
  const gb = gbRes.status === "fulfilled" ? mapGoogle(gbRes.value.data && gbRes.value.data.items)      : [];

  // If both upstreams failed, surface a 502 so the client can show an error.
  if (olRes.status === "rejected" && gbRes.status === "rejected" && key) {
    return res.status(502).json({ error: "search upstream failed" });
  }
  res.json(merge(ol, gb));
});

// ── GET /api/booksearch/cover?u=<encoded cover url> ─────────────────────────
// <img> tags can't send an auth header, so this is unauthenticated but
// host-locked (covers.openlibrary.org + Google's book image hosts). Always
// fetched over https (Google thumbnails are frequently http).
router.get("/cover", async (req, res) => {
  const u = (req.query.u || "").toString();
  let parsed;
  try { parsed = new URL(u); } catch { return res.status(400).send("bad url"); }
  const host = parsed.hostname;
  const allowed =
    host === COVER_OL ||
    host === "books.google.com" ||
    host.endsWith(".googleusercontent.com");
  if (!allowed) return res.status(400).send("host not allowed");
  parsed.protocol = "https:";
  try {
    const upstream = await axios.get(parsed.toString(), {
      responseType: "arraybuffer",
      timeout: TIMEOUT,
      headers: { "User-Agent": UA },
    });
    res.set("Content-Type", upstream.headers["content-type"] || "image/jpeg");
    res.set("Cache-Control", "public, max-age=604800, immutable");
    res.send(Buffer.from(upstream.data));
  } catch (e) {
    res.status(502).send("cover upstream failed");
  }
});

module.exports = router;
