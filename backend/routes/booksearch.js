const router = require("express").Router();
const axios  = require("axios");

// Open Library is unreachable from some client networks (carrier/DNS/content
// filters close the connection by hostname). These routes proxy the search and
// the cover images through our own server, which can reach Open Library fine,
// so the client only ever talks to our own origin.

const OL_SEARCH  = "https://openlibrary.org/search.json";
const COVER_HOST = "covers.openlibrary.org";
const UA         = "TheSpicyShelf/1.0 (private book club app)";

// GET /api/booksearch?q=...  → mapped Open Library results
router.get("/", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (q.length < 3) return res.json([]);
  try {
    const { data } = await axios.get(OL_SEARCH, {
      params: {
        q,
        limit:  6,
        fields: "key,title,author_name,cover_i,number_of_pages_median,first_publish_year,isbn,subject,series",
      },
      timeout: 8000,
      headers: { "User-Agent": UA },
    });
    const docs = Array.isArray(data && data.docs) ? data.docs : [];
    const results = docs.map(d => ({
      title:       d.title,
      author:      (d.author_name || [])[0] || "",
      cover_url:   d.cover_i ? `https://${COVER_HOST}/b/id/${d.cover_i}-M.jpg` : "",
      total_pages: d.number_of_pages_median || "",
      isbn:        (d.isbn || [])[0] || "",
      series:      (d.series || [])[0] || "",
      subjects:    d.subject || [],
      source:      "openlibrary",
    }));
    res.json(results);
  } catch (e) {
    res.status(502).json({ error: "search upstream failed", detail: e.code || e.message });
  }
});

// GET /api/booksearch/cover?u=<encoded covers.openlibrary.org url>
// Image <img> tags can't send an auth header, so this is intentionally
// unauthenticated but host-locked to covers.openlibrary.org (no open proxy).
router.get("/cover", async (req, res) => {
  const u = (req.query.u || "").toString();
  let parsed;
  try { parsed = new URL(u); } catch { return res.status(400).send("bad url"); }
  if (parsed.protocol !== "https:" || parsed.hostname !== COVER_HOST) {
    return res.status(400).send("host not allowed");
  }
  try {
    const upstream = await axios.get(parsed.toString(), {
      responseType: "arraybuffer",
      timeout: 8000,
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
