const express = require("express");
const router  = express.Router();
const cronAuth = require("../middleware/cronAuth");
const cronOnce = require("../middleware/cronOnce");
const pool    = require("../db/pool");
const { rolePing } = require("../config");
const { md } = require("../text");
const { clubMonthStart, clubToday, CLUB_TIMEZONE } = require("../clubtime");
const { monthValue } = require("../botmMonth");

const WEBHOOK  = process.env.DISCORD_WEBHOOK_ANNOUNCEMENTS;
const SITE_URL = process.env.FRONTEND_URL || "https://thespicyshelf.vercel.app";

const color = { purple:0xb08af0, pink:0xd060a0, gold:0xffd700, green:0x409060 };

async function postDigest() {
  const now      = new Date();
  const weekAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekStr  = weekAgo.toISOString();

  // ── Books added manually this week ────────────────────────────────────────
  const { rows: newBooks } = await pool.query(`
    SELECT b.title, b.author, b.cover_url,
           m.display_name, m.username
    FROM books b
    LEFT JOIN members m ON m.id = b.added_by
    WHERE b.added_at >= $1
      AND (b.source IS NULL OR b.source <> 'csv')
    ORDER BY b.added_at DESC
  `, [weekStr]);

  // ── Currently reading ──────────────────────────────────────────────────────
  const { rows: reading } = await pool.query(`
    SELECT b.title, m.display_name, m.username,
           rp.current_page, rp.total_pages
    FROM reading_progress rp
    JOIN books b  ON b.id  = rp.book_id
    JOIN members m ON m.id = rp.member_id
    WHERE rp.status = 'reading'
    ORDER BY rp.updated_at DESC
  `);

  // ── Finished this week ─────────────────────────────────────────────────────
  const { rows: finishedBooks } = await pool.query(`
    SELECT b.title, m.display_name, m.username
    FROM reading_progress rp
    JOIN books b   ON b.id = rp.book_id
    JOIN members m ON m.id = rp.member_id
    WHERE rp.status = 'finished'
      AND COALESCE(rp.finished_at, rp.updated_at::date) >= $1::date
    ORDER BY COALESCE(rp.finished_at, rp.updated_at::date) DESC, rp.updated_at DESC
  `, [weekStr]);

  // ── Reviews left this week ─────────────────────────────────────────────────
  const { rows: reviews } = await pool.query(`
    SELECT b.title, r.rating, r.notes,
           m.display_name, m.username
    FROM reviews r
    JOIN books b  ON b.id  = r.book_id
    JOIN members m ON m.id = r.member_id
    WHERE r.updated_at >= $1 AND r.rating > 0
    ORDER BY r.updated_at DESC
  `, [weekStr]);

  // ── Nominations ────────────────────────────────────────────────────────────
  const { rows: noms } = await pool.query(`
    SELECT b.title, COUNT(v.member_id)::int AS vote_count
    FROM nominations n
    JOIN books b ON b.id = n.book_id
    LEFT JOIN nomination_votes v ON v.nomination_id = n.id
    GROUP BY n.id, b.title
    ORDER BY vote_count DESC
    LIMIT 5
  `);

  // ── Current BOTM ──────────────────────────────────────────────────────────
  // Picked in JS rather than TO_DATE() in SQL: one oddly-typed month used to make the whole digest fail
  const { rows: botmRows } = await pool.query(`
    SELECT title, author, botm_month FROM books
    WHERE botm_month IS NOT NULL
    ORDER BY added_at DESC
  `);
  const botm = botmRows.reduce(
    (best, r) => (!best || monthValue(r.botm_month) > monthValue(best.botm_month)) ? r : best,
    undefined
  );

  // ── Monthly applause — top readers & reviewers (calendar month to date) ────
  // "This month" starts at midnight on the 1st in club time (Aruba), not server/UTC time
  const monthStartDay = clubMonthStart();   // YYYY-MM-01

  const { rows: topReaders } = await pool.query(`
    SELECT m.display_name, m.username, COUNT(*)::int AS books_finished
    FROM reading_progress rp
    JOIN members m ON m.id = rp.member_id
    WHERE rp.status = 'finished'
      AND COALESCE(rp.finished_at, rp.updated_at::date) >= $1::date
    GROUP BY m.id, m.display_name, m.username
    ORDER BY books_finished DESC, LOWER(COALESCE(m.display_name, m.username)) ASC
    LIMIT 3
  `, [monthStartDay]);

  const { rows: topReviewers } = await pool.query(`
    SELECT m.display_name, m.username, COUNT(*)::int AS review_count
    FROM reviews r
    JOIN members m ON m.id = r.member_id
    WHERE r.rating > 0
      AND r.updated_at >= ($1::date)::timestamp AT TIME ZONE $2
    GROUP BY m.id, m.display_name, m.username
    ORDER BY review_count DESC, LOWER(COALESCE(m.display_name, m.username)) ASC
    LIMIT 3
  `, [monthStartDay, CLUB_TIMEZONE]);

  // ── Build embeds ──────────────────────────────────────────────────────────
  const embeds = [];

  // Header embed
  const weekLabel = now.toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });
  embeds.push({
    title:       `📅 Weekly Digest — ${weekLabel}`,
    description: `Here's what's been happening on [The Spicy Shelf](${SITE_URL}) this week.`,
    color:       color.purple,
  });

  // BOTM
  if (botm) {
    embeds.push({
      title:       `🏆 Book of the Month — ${botm.botm_month}`,
      description: `**${md(botm.title)}**${botm.author ? ` by ${md(botm.author)}` : ""}`,
      color:       color.gold,
    });
  }

const truncate = (str, max = 4000) => str.length > max ? str.slice(0, max) + "\n…" : str;

  // New books
  if (newBooks.length > 0) {
    embeds.push({
      title: `📚 Added this week — ${newBooks.length} book${newBooks.length!==1?"s":""}`,
      description: truncate(newBooks.map(b => {
        const who = md(b.display_name || b.username || "someone");
        return `**${md(b.title)}**${b.author?` *by ${md(b.author)}*`:""} — added by ${who}`;
      }).join("\n")),
      color: color.purple,
    });
  }

  // Finished this week
  if (finishedBooks.length > 0) {
    embeds.push({
      title: `✅ Finished this week — ${finishedBooks.length} book${finishedBooks.length!==1?"s":""}`,
      description: truncate(finishedBooks.map(f => {
        const who = md(f.display_name || f.username || "someone");
        return `**${who}** finished **${md(f.title)}**`;
      }).join("\n")),
      color: color.green,
    });
  }

  // Currently reading
  if (reading.length > 0) {
    embeds.push({
      title: `📖 Currently reading`,
      description: truncate(reading.map(r => {
        const who  = md(r.display_name || r.username);
        let line   = `**${who}** — ${md(r.title)}`;
        if (r.current_page && r.total_pages) {
          const pct    = Math.round((r.current_page / r.total_pages) * 100);
          const filled = Math.round(pct / 10);
          const bar    = "█".repeat(filled) + "░".repeat(10 - filled);
          line        += `\n\`${bar}\` ${pct}%`;
        }
        return line;
      }).join("\n\n")),
      color: color.green,
    });
  }

  // Reviews
  if (reviews.length > 0) {
    embeds.push({
      title: `⭐ Reviews this week`,
      description: truncate(reviews.map(r => {
        const who   = md(r.display_name || r.username);
        const stars = "⭐".repeat(r.rating);
        let line    = `**${md(r.title)}** — ${stars} by ${who}`;
        if (r.notes) line += `\n*"${r.notes.slice(0, 100)}${r.notes.length > 100 ? "…" : ""}"*`;
        return line;
      }).join("\n\n")),
      color: color.pink,
    });
  }

  // Nominations
  if (noms.length > 0) {
    embeds.push({
      title: `🗳 Current nominations`,
      description: truncate(noms.map((n, i) =>
        `**${i+1}.** ${md(n.title)} — ${n.vote_count} vote${n.vote_count!==1?"s":""}`
      ).join("\n")),
      color: color.purple,
    });
  }

  // Club Applause — monthly shoutouts
  const monthLabel = now.toLocaleDateString("en-US", { month: "long" });
  const applauseLines = [];

  if (topReaders.length > 0) {
    applauseLines.push(`**📚 Top Readers — ${monthLabel}**`);
    topReaders.forEach((r, i) => {
      const who = md(r.display_name || r.username);
      const medal = ["🥇", "🥈", "🥉"][i] || "•";
      applauseLines.push(`${medal} **${who}** — ${r.books_finished} book${r.books_finished !== 1 ? "s" : ""} finished`);
    });
  }

  if (topReviewers.length > 0) {
    if (applauseLines.length > 0) applauseLines.push("");
    applauseLines.push(`**⭐ Top Reviewers — ${monthLabel}**`);
    topReviewers.forEach((r, i) => {
      const who = md(r.display_name || r.username);
      const medal = ["🥇", "🥈", "🥉"][i] || "•";
      applauseLines.push(`${medal} **${who}** — ${r.review_count} review${r.review_count !== 1 ? "s" : ""}`);
    });
  }

  if (applauseLines.length > 0) {
    embeds.push({
      title:       `🎉 Club Applause`,
      description: applauseLines.join("\n"),
      color:       color.gold,
    });
  }

  if (embeds.length <= 1) {
    embeds.push({
      title:       "Quiet week 🌙",
      description: "Nothing new added or reviewed this week — time to pick up a book!",
      color:       color.purple,
    });
  }

  // ── Post to Discord ───────────────────────────────────────────────────────
  // Discord limits: max 10 embeds per message, max 6000 total chars per message
  // Split into chunks that stay under the limit
  const chunks = [];
  let current = [], currentSize = 0;
  for (const embed of embeds) {
    const size = JSON.stringify(embed).length;
    if (current.length > 0 && (currentSize + size > 5500 || current.length >= 10)) {
      chunks.push(current);
      current = []; currentSize = 0;
    }
    current.push(embed);
    currentSize += size;
  }
  if (current.length) chunks.push(current);

  for (let i = 0; i < chunks.length; i++) {
    const payload = {
      username: "Spicy Shelf",
      embeds: chunks[i],
    };
    // Only ping the role on the first message
    { const ping = rolePing(); if (i === 0 && ping) payload.content = ping; }

    const r = await fetch(WEBHOOK, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`Webhook failed: ${r.status} ${await r.text()}`);

    // Small delay between messages to avoid rate limiting
    if (i < chunks.length - 1) await new Promise(res => setTimeout(res, 1000));
  }

  return { ok:true, sections: embeds.length };
}

// ── Route — called by Vercel cron ─────────────────────────────────────────────
router.get("/", cronAuth, cronOnce("digest", clubToday), async (req, res) => {
  try {
    const result = await postDigest();
    res.json(result);
  } catch (e) {
    console.error("Digest error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
