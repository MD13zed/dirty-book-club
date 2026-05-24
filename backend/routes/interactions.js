const router = require("express").Router();
const { verifyKey } = require("discord-interactions");
const pool = require("../db/pool");
const { v4: uuidv4 } = require("uuid");

const SITE_URL = process.env.FRONTEND_URL || "https://thespicyshelf.vercel.app";

// ── Signature verification ────────────────────────────────────────────────────
async function verify(req, res, next) {
  const sig  = req.headers["x-signature-ed25519"];
  const ts   = req.headers["x-signature-timestamp"];
  const body = req.body;
  if (!sig || !ts || !body) return res.status(401).end("Unauthorized");
  const isValid = await verifyKey(body, sig, ts, process.env.DISCORD_APP_PUBLIC_KEY);
  if (!isValid) return res.status(401).end("Invalid signature");
  try { req.interaction = JSON.parse(body.toString()); }
  catch { return res.status(400).end("Bad JSON"); }
  next();
}

// ── Response helpers ──────────────────────────────────────────────────────────
const color = { purple:0xb08af0, pink:0xd060a0, gold:0xffd700, green:0x409060, red:0xe83030, indigo:0x7a54c8 };

function embed(title, desc, col = color.purple, fields = [], thumbnail = null, image = null) {
  const e = { title, description:desc, color:col, fields };
  if (thumbnail) e.thumbnail = { url:thumbnail };
  if (image)     e.image     = { url:image };
  return e;
}

function reply(embeds, ephemeral = false) {
  return { type:4, data:{ embeds, flags:ephemeral ? 64 : 0 } };
}

function err(msg) { return reply([embed("❌ Error", msg, color.red)], true); }

// ── DB helpers ────────────────────────────────────────────────────────────────
async function findBook(query) {
  const { rows } = await pool.query(
    `SELECT b.*, array_agg(g.genre) FILTER (WHERE g.genre IS NOT NULL) AS genres,
            ROUND(AVG(r.rating)::numeric,1) AS avg_rating,
            COUNT(r.id)::int AS review_count
     FROM books b
     LEFT JOIN book_genres g ON g.book_id = b.id
     LEFT JOIN reviews r ON r.book_id = b.id AND r.rating > 0
     WHERE b.title ILIKE $1
     GROUP BY b.id ORDER BY LENGTH(b.title) ASC LIMIT 1`,
    [`%${query}%`]
  );
  return rows[0] || null;
}

async function getMemberId(discordId) {
  const { rows } = await pool.query("SELECT id FROM members WHERE discord_id = $1", [discordId]);
  return rows[0]?.id || null;
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function handleShelf(res) {
  const { rows } = await pool.query(
    `SELECT b.title, b.author, b.cover_url,
            ROUND(AVG(r.rating)::numeric,1) AS avg_rating,
            COUNT(r.id)::int AS review_count
     FROM books b
     LEFT JOIN reviews r ON r.book_id = b.id AND r.rating > 0
     GROUP BY b.id ORDER BY b.added_at DESC LIMIT 5`
  );
  if (!rows.length) return res.json(reply([embed("📚 The Spicy Shelf", "No books yet!")]));
  const fields = rows.map(b => ({
    name:  b.title,
    value: [
      b.author ? `*by ${b.author}*` : "",
      b.avg_rating ? `⭐ ${b.avg_rating} (${b.review_count} review${b.review_count!==1?"s":""})` : "_No reviews yet_",
    ].filter(Boolean).join("\n"),
    inline: false,
  }));
  return res.json(reply([embed("📚 The Spicy Shelf", `[View full library](${SITE_URL}) — 5 most recent`, color.purple, fields, rows[0]?.cover_url||null)]));
}

async function handleBotm(res) {
  const { rows } = await pool.query(
    `SELECT b.*, array_agg(g.genre) FILTER (WHERE g.genre IS NOT NULL) AS genres,
            ROUND(AVG(r.rating)::numeric,1) AS avg_rating
     FROM books b
     LEFT JOIN book_genres g ON g.book_id = b.id
     LEFT JOIN reviews r ON r.book_id = b.id AND r.rating > 0
     WHERE b.botm_month IS NOT NULL
     GROUP BY b.id ORDER BY TO_DATE(b.botm_month, 'Month YYYY') DESC LIMIT 1`
  );
  if (!rows.length) return res.json(reply([embed("🏆 Book of the Month", "Not set yet.", color.gold)]));
  const b = rows[0];
  const desc = [
    `**${b.title}**`,
    b.author ? `*by ${b.author}*` : "",
    b.series ? `📚 ${b.series}` : "",
    b.genres?.length ? `\n**Genres:** ${b.genres.join(", ")}` : "",
    b.avg_rating ? `\n⭐ ${b.avg_rating} club rating` : "",
  ].filter(Boolean).join("\n");
  return res.json(reply([embed(`🏆 Book of the Month — ${b.botm_month}`, desc, color.gold, [], null, b.cover_url||null)]));
}

async function handleStats(res) {
  const { rows:[s] } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM books)                                        AS books,
      (SELECT COUNT(*)::int FROM reviews)                                      AS reviews,
      (SELECT COUNT(*)::int FROM members)                                      AS members,
      (SELECT ROUND(AVG(rating)::numeric,1) FROM reviews WHERE rating > 0)    AS avg_rating,
      (SELECT COUNT(*)::int FROM reading_progress WHERE status='finished')     AS finished,
      (SELECT COUNT(*)::int FROM reading_progress WHERE status='reading')      AS reading_now
  `);
  return res.json(reply([embed(
    "📊 The Spicy Shelf — Stats",
    `[Open the library](${SITE_URL})`,
    color.purple,
    [
      { name:"📚 Books",             value:String(s.books),                           inline:true },
      { name:"⭐ Reviews",           value:String(s.reviews),                         inline:true },
      { name:"👥 Members",           value:String(s.members),                         inline:true },
      { name:"✅ Finished",          value:String(s.finished),                        inline:true },
      { name:"📖 Currently reading", value:String(s.reading_now),                     inline:true },
      { name:"📈 Avg Rating",        value:s.avg_rating?`${s.avg_rating}★`:"—",      inline:true },
    ],
  )]));
}

async function handleSearch(res, options) {
  const query = options.find(o=>o.name==="title")?.value;
  if (!query) return res.json(err("Provide a title to search for."));
  const { rows } = await pool.query(
    `SELECT b.title, b.author, b.series, b.cover_url,
            array_agg(g.genre) FILTER (WHERE g.genre IS NOT NULL) AS genres,
            ROUND(AVG(r.rating)::numeric,1) AS avg_rating,
            COUNT(r.id)::int AS review_count
     FROM books b
     LEFT JOIN book_genres g ON g.book_id = b.id
     LEFT JOIN reviews r ON r.book_id = b.id AND r.rating > 0
     WHERE b.title ILIKE $1
     GROUP BY b.id ORDER BY LENGTH(b.title) ASC LIMIT 4`,
    [`%${query}%`]
  );
  if (!rows.length) return res.json(reply([embed("🔍 No results", `No books matching **"${query}"**`, color.indigo)]));
  const fields = rows.map(b => ({
    name:  b.title,
    value: [
      b.author ? `*by ${b.author}*` : "",
      b.series ? `📚 ${b.series}` : "",
      b.genres?.filter(Boolean).length ? b.genres.join(", ") : "",
      b.avg_rating ? `⭐ ${b.avg_rating} (${b.review_count} review${b.review_count!==1?"s":""})` : "_No reviews yet_",
    ].filter(Boolean).join("\n"),
    inline: false,
  }));
  return res.json(reply([embed(`🔍 "${query}" — ${rows.length} result${rows.length!==1?"s":""}`, "", color.purple, fields, rows[0]?.cover_url||null)]));
}

async function handleReview(res, options, discordId) {
  const titleQuery = options.find(o=>o.name==="title")?.value;
  const rating     = options.find(o=>o.name==="rating")?.value;
  const notes      = options.find(o=>o.name==="notes")?.value || "";
  const memberId   = await getMemberId(discordId);
  if (!memberId) return res.json(err(`You need to log in first: ${SITE_URL}`));
  const book = await findBook(titleQuery);
  if (!book) return res.json(err(`No book found matching **"${titleQuery}"**\nTry \`/search\` to find the exact title.`));
  await pool.query(
    `INSERT INTO reviews (id, book_id, member_id, rating, notes)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (book_id, member_id) DO UPDATE SET
       rating=EXCLUDED.rating, notes=EXCLUDED.notes, updated_at=CURRENT_TIMESTAMP`,
    [uuidv4(), book.id, memberId, rating, notes]
  );
  return res.json(reply([embed(
    "✅ Review saved!",
    [`**${book.title}**`, `${"⭐".repeat(rating)}`, notes?`*"${notes}"*`:""].filter(Boolean).join("\n"),
    color.green, [], book.cover_url||null,
  )]));
}

async function handleReading(res, options, discordId) {
  const titleQuery = options.find(o=>o.name==="title")?.value;
  const status     = options.find(o=>o.name==="status")?.value;
  const page       = options.find(o=>o.name==="page")?.value || 0;
  const memberId   = await getMemberId(discordId);
  if (!memberId) return res.json(err(`You need to log in first: ${SITE_URL}`));
  const book = await findBook(titleQuery);
  if (!book) return res.json(err(`No book found matching **"${titleQuery}"**\nTry \`/search\` to find the exact title.`));
  await pool.query(
    `INSERT INTO reading_progress (id, book_id, member_id, status, current_page)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (book_id, member_id) DO UPDATE SET
       status=EXCLUDED.status, current_page=EXCLUDED.current_page, updated_at=CURRENT_TIMESTAMP`,
    [uuidv4(), book.id, memberId, status, page]
  );
  const labels = { want_to_read:"📚 Want to read", reading:"📖 Currently reading", finished:"✅ Finished", dnf:"💀 Did not finish" };
  return res.json(reply([embed(
    "📖 Progress updated!",
    [`**${book.title}**`, `Status: ${labels[status]}`, status==="reading"&&page?`Page: ${page}`:""].filter(Boolean).join("\n"),
    color.indigo, [], book.cover_url||null,
  )]));
}

const STATUS_LABELS = { want_to_read:"📚 Want to read", reading:"📖 Currently reading", finished:"✅ Finished", dnf:"💀 Did not finish" };

async function handleMyShelf(res, options, discordId) {
  const status   = options.find(o=>o.name==="status")?.value || null;
  const memberId = await getMemberId(discordId);
  if (!memberId) return res.json(err(`You need to log in first: ${SITE_URL}`));
  const whereStatus = status ? "AND rp.status = $2" : "";
  const params      = status ? [memberId, status] : [memberId];
  const { rows } = await pool.query(
    `SELECT rp.status, rp.current_page, rp.total_pages, b.title, b.author, b.cover_url
     FROM reading_progress rp JOIN books b ON b.id = rp.book_id
     WHERE rp.member_id = $1 ${whereStatus}
     ORDER BY rp.updated_at DESC LIMIT 10`,
    params
  );
  if (!rows.length) {
    const label = status ? STATUS_LABELS[status] : "any books tracked";
    return res.json(reply([embed("📚 Your Shelf", `Nothing marked as ${label} yet.`, color.indigo)]));
  }
  const grouped = {};
  for (const r of rows) { (grouped[r.status] = grouped[r.status] || []).push(r); }
  const fields = [];
  for (const [st, books] of Object.entries(grouped)) {
    fields.push({
      name:  STATUS_LABELS[st],
      value: books.map(b => {
        let line = `**${b.title}**${b.author?` *by ${b.author}*`:""}`;
        if (st==="reading" && b.current_page && b.total_pages) {
          line += `\n└ p.${b.current_page}/${b.total_pages} (${Math.round((b.current_page/b.total_pages)*100)}%)`;
        }
        return line;
      }).join("\n"),
      inline: false,
    });
  }
  const title = status ? `📚 Your shelf — ${STATUS_LABELS[status]}` : "📚 Your Shelf";
  return res.json(reply([embed(title, `[View full profile](${SITE_URL})`, color.indigo, fields)]));
}

async function handleNominations(res) {
  const { rows } = await pool.query(
    `SELECT b.title, b.author, COUNT(v.member_id)::int AS votes, m.display_name AS nominated_by
     FROM nominations n
     JOIN books b ON b.id = n.book_id
     JOIN members m ON m.id = n.nominated_by
     LEFT JOIN nomination_votes v ON v.nomination_id = n.id
     GROUP BY n.id, b.title, b.author, m.display_name
     ORDER BY votes DESC, n.nominated_at ASC`
  );
  if (!rows.length) return res.json(reply([embed("🗳 Nominations", "No nominations yet! Add books on the website then nominate them.", color.indigo)]));
  const fields = rows.map((n, i) => ({
    name:  `${i+1}. ${n.title}`,
    value: [
      n.author ? `*by ${n.author}*` : "",
      `▲ ${n.votes} vote${n.votes!==1?"s":""} · nominated by ${n.nominated_by}`,
    ].filter(Boolean).join("\n"),
    inline: false,
  }));
  return res.json(reply([embed(
    `🗳 Nominations — ${rows.length} book${rows.length!==1?"s":""}`,
    `Vote on the website: ${SITE_URL}`,
    color.indigo, fields,
  )]));
}

async function handleLeaderboard(res) {
  const { rows } = await pool.query(
    `SELECT m.display_name, m.avatar_url,
            COUNT(DISTINCT rp.book_id) FILTER (WHERE rp.status='finished')::int AS books_finished,
            COUNT(DISTINCT r.id)::int AS reviews_left,
            COUNT(DISTINCT rp2.book_id) FILTER (WHERE rp2.status='reading')::int AS currently_reading
     FROM members m
     LEFT JOIN reading_progress rp  ON rp.member_id  = m.id
     LEFT JOIN reading_progress rp2 ON rp2.member_id = m.id
     LEFT JOIN reviews r ON r.member_id = m.id AND r.rating > 0
     GROUP BY m.id, m.display_name, m.avatar_url
     ORDER BY books_finished DESC, reviews_left DESC LIMIT 10`
  );
  if (!rows.length) return res.json(reply([embed("🏅 Leaderboard", "No activity yet!", color.gold)]));

  const medals = ["🥇","🥈","🥉"];
  const fields = rows.map((m, i) => ({
    name:  `${medals[i]||`${i+1}.`} ${m.display_name}`,
    value: [
      `✅ ${m.books_finished} finished`,
      `📖 ${m.currently_reading} reading`,
      `⭐ ${m.reviews_left} reviews`,
    ].join("  ·  "),
    inline: false,
  }));

  return res.json(reply([embed("🏅 Reading Leaderboard", `[View profiles](${SITE_URL})`, color.gold, fields)]));
}

// ── Router ────────────────────────────────────────────────────────────────────
router.post("/", verify, async (req, res) => {
  try {
    const { type, data, member, user } = req.interaction;
    const discordId = (member?.user || user)?.id;

    if (type === 1) return res.json({ type:1 });

    if (type === 2) {
      const { name, options = [] } = data;
      switch (name) {
        case "shelf":        return await handleShelf(res);
        case "botm":         return await handleBotm(res);
        case "stats":        return await handleStats(res);
        case "search":       return await handleSearch(res, options);
        case "review":       return await handleReview(res, options, discordId);
        case "reading":      return await handleReading(res, options, discordId);
        case "myshelf":      return await handleMyShelf(res, options, discordId);
        case "nominations":  return await handleNominations(res);
        case "leaderboard":  return await handleLeaderboard(res);
        default:             return res.json(err("Unknown command."));
      }
    }
  } catch (e) {
    console.error("Interaction error:", e);
    return res.json(err("Something went wrong — try again."));
  }
});

module.exports = router;
