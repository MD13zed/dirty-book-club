const router = require("express").Router();
const { verifyKey } = require("discord-interactions");
const pool = require("../db/pool");
const { v4: uuidv4 } = require("uuid");

const SITE_URL = process.env.FRONTEND_URL || "https://thespicyshelf.vercel.app";

// ── Signature verification ────────────────────────────────────────────────────
function verify(req, res, next) {
  const sig  = req.headers["x-signature-ed25519"];
  const ts   = req.headers["x-signature-timestamp"];
  const body = req.body;
  if (!sig || !ts || !body) return res.status(401).end("Unauthorized");
  const isValid = verifyKey(body, sig, ts, process.env.DISCORD_APP_PUBLIC_KEY);
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

  // Top rated book (min 2 reviews)
  const { rows:[topRated] } = await pool.query(`
    SELECT b.title, b.author, ROUND(AVG(r.rating)::numeric,1) AS avg, COUNT(*)::int AS cnt
    FROM reviews r JOIN books b ON b.id = r.book_id
    WHERE r.rating > 0
    GROUP BY b.id, b.title, b.author
    HAVING COUNT(*) >= 2
    ORDER BY avg DESC, cnt DESC LIMIT 1
  `);

  // Most reviewed book
  const { rows:[mostReviewed] } = await pool.query(`
    SELECT b.title, COUNT(*)::int AS cnt
    FROM reviews r JOIN books b ON b.id = r.book_id
    WHERE r.rating > 0
    GROUP BY b.id, b.title
    ORDER BY cnt DESC LIMIT 1
  `);

  // Most active reader this month (most books finished)
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
  const { rows:[topReader] } = await pool.query(`
    SELECT m.display_name, m.username, COUNT(*)::int AS cnt
    FROM reading_progress rp JOIN members m ON m.id = rp.member_id
    WHERE rp.status = 'finished' AND rp.updated_at >= $1
    GROUP BY m.id, m.display_name, m.username
    ORDER BY cnt DESC LIMIT 1
  `, [startOfMonth.toISOString()]);

  // Total pages read across all members
  const { rows:[pages] } = await pool.query(`
    SELECT COALESCE(SUM(b.total_pages),0)::int AS total
    FROM reading_progress rp JOIN books b ON b.id = rp.book_id
    WHERE rp.status = 'finished' AND b.total_pages IS NOT NULL
  `);

  const fields = [
    { name:"📚 Books",              value:String(s.books),                        inline:true },
    { name:"⭐ Reviews",            value:String(s.reviews),                      inline:true },
    { name:"👥 Members",            value:String(s.members),                      inline:true },
    { name:"✅ Finished",           value:String(s.finished),                     inline:true },
    { name:"📖 Reading now",        value:String(s.reading_now),                  inline:true },
    { name:"📈 Club avg rating",    value:s.avg_rating?`${s.avg_rating}★`:"—",   inline:true },
    { name:"📄 Total pages read",   value:pages.total.toLocaleString(),           inline:true },
  ];

  if (topRated) fields.push({
    name:"🥇 Top rated",
    value:`**${topRated.title}**${topRated.author?` *by ${topRated.author}*`:""}  \n${topRated.avg}★ from ${topRated.cnt} review${topRated.cnt!==1?"s":""}`,
    inline:false,
  });
  if (mostReviewed) fields.push({
    name:"💬 Most reviewed",
    value:`**${mostReviewed.title}** — ${mostReviewed.cnt} review${mostReviewed.cnt!==1?"s":""}`,
    inline:false,
  });
  if (topReader) fields.push({
    name:"🔥 Most active this month",
    value:`**${topReader.display_name||topReader.username}** — ${topReader.cnt} book${topReader.cnt!==1?"s":""} finished`,
    inline:false,
  });

  return res.json(reply([embed(
    "📊 The Spicy Shelf — Stats",
    `[Open the library](${SITE_URL})`,
    color.purple,
    fields,
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
          const pct   = Math.round((b.current_page / b.total_pages) * 100);
          const filled = Math.round(pct / 10);
          const bar   = "█".repeat(filled) + "░".repeat(10 - filled);
          line += `\n\`${bar}\` ${pct}% · p.${b.current_page}/${b.total_pages}`;
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

// ── Members list ──────────────────────────────────────────────────────────────
async function handleMembers(res, options) {
  const targetDiscordId = options?.find(o => o.name === "user")?.value || null;

  // ── Single member view ──────────────────────────────────────────────────────
  if (targetDiscordId) {
    const { rows: [member] } = await pool.query(
      `SELECT m.id, m.display_name, m.username
       FROM members m WHERE m.discord_id = $1`, [targetDiscordId]
    );
    if (!member) return res.json(err("That person hasn't joined The Spicy Shelf yet."));

    const name = member.display_name || member.username;

    const { rows: [stats] } = await pool.query(`
      SELECT
        COUNT(DISTINCT rp.book_id) FILTER (WHERE rp.status = 'finished')::int  AS finished,
        COUNT(DISTINCT rp.book_id) FILTER (WHERE rp.status = 'reading')::int   AS reading,
        COUNT(DISTINCT rp.book_id) FILTER (WHERE rp.status = 'dnf')::int       AS dnf,
        COUNT(DISTINCT r.id)::int                                               AS reviews,
        ROUND(AVG(r.rating) FILTER (WHERE r.rating > 0), 1)::float             AS avg_rating
      FROM members m
      LEFT JOIN reading_progress rp ON rp.member_id = m.id
      LEFT JOIN reviews r ON r.member_id = m.id
      WHERE m.id = $1
    `, [member.id]);

    const { rows: currentlyReading } = await pool.query(`
      SELECT b.title, rp.current_page, rp.total_pages
      FROM reading_progress rp JOIN books b ON b.id = rp.book_id
      WHERE rp.member_id = $1 AND rp.status = 'reading'
      ORDER BY rp.updated_at DESC LIMIT 5
    `, [member.id]);

    const { rows: recentReviews } = await pool.query(`
      SELECT b.title, r.rating, r.notes
      FROM reviews r JOIN books b ON b.id = r.book_id
      WHERE r.member_id = $1 AND r.rating > 0
      ORDER BY r.updated_at DESC LIMIT 3
    `, [member.id]);

    const { rows: [topGenre] } = await pool.query(`
      SELECT bg.genre, COUNT(*)::int AS cnt
      FROM reading_progress rp
      JOIN book_genres bg ON bg.book_id = rp.book_id
      WHERE rp.member_id = $1 AND rp.status = 'finished'
      GROUP BY bg.genre ORDER BY cnt DESC LIMIT 1
    `, [member.id]);

    const fields = [
      {
        name: "📊 Stats",
        value: [
          stats.finished   ? `📚 ${stats.finished} book${stats.finished!==1?"s":""} finished`     : "No books finished yet",
          stats.reading    ? `📖 ${stats.reading} currently reading`   : null,
          stats.dnf        ? `💀 ${stats.dnf} DNF`                    : null,
          stats.reviews    ? `⭐ ${stats.reviews} reviews · avg ${stats.avg_rating}★` : null,
          topGenre         ? `❤️ Fave genre: ${topGenre.genre}`        : null,
        ].filter(Boolean).join("\n") || "No activity yet",
        inline: false,
      },
    ];

    if (currentlyReading.length) {
      fields.push({
        name: "📖 Currently reading",
        value: currentlyReading.map(b => {
          let line = `**${b.title}**`;
          if (b.current_page && b.total_pages) {
            const pct = Math.round((b.current_page / b.total_pages) * 100);
            const bar = "█".repeat(Math.round(pct/10)) + "░".repeat(10 - Math.round(pct/10));
            line += `\n\`${bar}\` ${pct}%`;
          }
          return line;
        }).join("\n"),
        inline: false,
      });
    }

    if (recentReviews.length) {
      fields.push({
        name: "💬 Recent reviews",
        value: recentReviews.map(r =>
          `**${r.title}** — ${"⭐".repeat(r.rating)}${r.notes ? `\n*"${r.notes.slice(0,80)}${r.notes.length>80?"…":""}"*` : ""}`
        ).join("\n"),
        inline: false,
      });
    }

    return res.json(reply([embed(
      `👤 ${name}`,
      `[View full profile](${SITE_URL})`,
      color.purple, fields,
    )]));
  }

  // ── Full member list ────────────────────────────────────────────────────────
  const { rows } = await pool.query(`
    SELECT
      m.display_name, m.username,
      COUNT(DISTINCT rp.book_id) FILTER (WHERE rp.status = 'finished')::int  AS finished,
      COUNT(DISTINCT rp.book_id) FILTER (WHERE rp.status = 'reading')::int   AS reading,
      COUNT(DISTINCT r.id)::int                                               AS reviews,
      ROUND(AVG(r.rating) FILTER (WHERE r.rating > 0), 1)::float             AS avg_rating
    FROM members m
    LEFT JOIN reading_progress rp ON rp.member_id = m.id
    LEFT JOIN reviews r ON r.member_id = m.id
    GROUP BY m.id
    ORDER BY finished DESC, reviews DESC
  `);
  if (!rows.length) return res.json(reply([embed("👥 Members", "No members yet.", color.purple)]));
  const fields = rows.map((m, i) => {
    const name  = m.display_name || m.username;
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`;
    const stats = [
      m.finished   ? `📚 ${m.finished} finished`   : null,
      m.reading    ? `📖 ${m.reading} reading`     : null,
      m.reviews    ? `⭐ ${m.reviews} reviews`     : null,
      m.avg_rating ? `avg ${m.avg_rating}★`        : null,
    ].filter(Boolean).join(" · ") || "No activity yet";
    return { name:`${medal} ${name}`, value:stats, inline:false };
  });
  return res.json(reply([embed(
    `👥 Club Members — ${rows.length}`,
    `[View profiles on the site](${SITE_URL})`,
    color.purple, fields,
  )]));
}

// ── Getting started guide ─────────────────────────────────────────────────────
function handleGettingStarted(res) {
  const embed1 = embed(
    "🔥 Welcome to The Spicy Shelf",
    `Everything you can do on [thespicyshelf.vercel.app](${SITE_URL}) — a quick guide to getting the most out of the app.`,
    color.purple,
    [
      {
        name:  "🚀 Getting started",
        value: [
          `**1.** Log in with Discord — no account to create, just your existing Discord. Your username and avatar sync automatically.`,
          `**2.** Set up your profile — click your avatar in the top right to add a display name, bio, and pick a colour theme. Six dark themes available.`,
          `**3.** Start tracking — add books, leave reviews, and mark your reading progress. Everything syncs in real time across the whole club.`,
        ].join("\n"),
        inline: false,
      },
      {
        name:  "📚 The library",
        value: [
          "**Add books** — search to pre-fill title, author, cover & page count from Open Library automatically",
          "**Goodreads import** — upload your export CSV to bulk-import your entire read shelf, covers fetched automatically by ISBN",
          "**Genres & trigger warnings** — up to 5 genres per book from 100+ tags, TW collapsed behind a toggle on each card",
          "**Filter & sort** — by genre, reading status, rating, date read, or search by title/author/series",
          "",
          "> To import from Goodreads: **My Books → Import/Export → Export Library**, then click **Import from Goodreads** in the library header and upload the CSV.",
        ].join("\n"),
        inline: false,
      },
      {
        name:  "📖 Reading progress",
        value: [
          "Set a status for any book — **Want to Read**, **Currently Reading**, **Finished**, or **Did Not Finish**.",
          "Log your current page and watch the progress bar fill automatically when total pages are set.",
          "Leave a DNF note so the club knows why you stopped — shown on your profile.",
        ].join(" "),
        inline: false,
      },
      {
        name:  "⭐ Reviews & ratings",
        value: "Leave a star rating (1–5) and written notes on any book. The club average appears on every book card. Member avatars show who has reviewed — click any reviewer's name to visit their profile. Filter your own reviews by star rating on your profile page.",
        inline: false,
      },
      {
        name:  "🗳 Nominations & voting",
        value: [
          "Nominate any library book for next month's pick using the button inside each card.",
          "One upvote per member per nomination — vote counts shown on the nominations tab in the library.",
        ].join(" "),
        inline: false,
      },
    ],
  );

  const embed2 = embed(
    "🤖 Discord bot commands",
    "Use these slash commands directly in the server — no need to open the app.",
    color.indigo,
    [
      {
        name:  "Commands",
        value: [
          "`/shelf` — the 5 most recently added books",
          "`/botm` — current Book of the Month",
          "`/search` — search the library by title",
          "`/review` — submit or update a star rating and notes",
          "`/reading` — update your reading status and page number",
          "`/myshelf` — see your full reading list by status",
          "`/nominations` — current shortlist with vote counts",
          "`/leaderboard` — who has read the most and reviewed the most",
          "`/members` — everyone in the club with their stats",
          "`/members user:@someone` — a specific member's profile and reading list",
          "`/stats` — club-wide reading statistics",
        ].join("\n"),
        inline: false,
      },
      {
        name:  "👤 Your profile",
        value: "Your profile shows your reading stats, all your reviews (filterable by star rating), and your full progress list with any DNF notes. Edit your display name, bio, and colour theme any time.",
        inline: false,
      },
      {
        name:  "📱 Install as an app",
        value: "Open the site in **Safari on iOS** or **Chrome on Android** → Add to Home Screen for a native app experience.",
        inline: false,
      },
    ],
  );

  return res.json({ type:4, data:{ embeds:[embed1, embed2], flags:64 } }); // ephemeral
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
        case "leaderboard":      return await handleLeaderboard(res);
        case "members":          return await handleMembers(res, options);
        case "getting-started":  return handleGettingStarted(res);
        default:                 return res.json(err("Unknown command."));
      }
    }
  } catch (e) {
    console.error("Interaction error:", e);
    return res.json(err("Something went wrong — try again."));
  }
});

module.exports = router;
