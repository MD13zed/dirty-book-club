const express = require("express");
const router  = express.Router();
const cronAuth = require("../middleware/cronAuth");
const pool    = require("../db/pool");
const { clubYear, CLUB_TIMEZONE } = require("../clubtime");
const { monthValue } = require("../botmMonth");

const WEBHOOK     = process.env.DISCORD_WEBHOOK_ANNOUNCEMENTS;
const SITE_URL    = process.env.FRONTEND_URL || "https://thespicyshelf.vercel.app";

const color = { purple:0xb08af0, pink:0xd060a0, gold:0xffd700, green:0x409060, red:0xe83030 };

async function postYearEnd() {
  const year = clubYear() - 1;                 // the year that just ended, in club time (Aruba)
  const yearStart     = `${year}-01-01`;
  const nextYearStart = `${year + 1}-01-01`;   // ranges are "from start up to, not including, next Jan 1"
  const TZ = CLUB_TIMEZONE;

  // Reviews are counted by when they were FIRST written (created_at, added in v5_migration.sql);
  // editing an old review later must not move it into a different year.
  // Falls back to updated_at for any row without created_at.

  // ── Books finished this year ───────────────────────────────────────────────
  const { rows: [{ books_read }] } = await pool.query(`
    SELECT COUNT(DISTINCT rp.book_id)::int AS books_read
    FROM reading_progress rp
    WHERE rp.status = 'finished'
      AND rp.finished_at >= $1::date AND rp.finished_at < $2::date
  `, [yearStart, nextYearStart]);

  // ── Total reviews left this year ───────────────────────────────────────────
  const { rows: [{ reviews_left }] } = await pool.query(`
    SELECT COUNT(*)::int AS reviews_left
    FROM reviews
    WHERE COALESCE(created_at, updated_at) >= ($1::date)::timestamp AT TIME ZONE $3
      AND COALESCE(created_at, updated_at) <  ($2::date)::timestamp AT TIME ZONE $3
      AND rating > 0
  `, [yearStart, nextYearStart, TZ]);

  // ── Total pages read this year ─────────────────────────────────────────────
  const { rows: [{ pages_read }] } = await pool.query(`
    SELECT COALESCE(SUM(b.total_pages), 0)::int AS pages_read
    FROM reading_progress rp
    JOIN books b ON b.id = rp.book_id
    WHERE rp.status = 'finished'
      AND rp.finished_at >= $1::date AND rp.finished_at < $2::date
      AND b.total_pages IS NOT NULL
  `, [yearStart, nextYearStart]);

  // ── Highest rated book of the year ────────────────────────────────────────
  const { rows: [topBook] } = await pool.query(`
    SELECT b.title, b.author, b.cover_url,
           ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
           COUNT(r.id)::int AS review_count
    FROM reviews r
    JOIN books b ON b.id = r.book_id
    WHERE COALESCE(r.created_at, r.updated_at) >= ($1::date)::timestamp AT TIME ZONE $3
      AND COALESCE(r.created_at, r.updated_at) <  ($2::date)::timestamp AT TIME ZONE $3
      AND r.rating > 0
    GROUP BY b.id, b.title, b.author, b.cover_url
    HAVING COUNT(r.id) >= 2
    ORDER BY avg_rating DESC, review_count DESC
    LIMIT 1
  `, [yearStart, nextYearStart, TZ]);

  // ── Most reviewed book ────────────────────────────────────────────────────
  const { rows: [mostReviewed] } = await pool.query(`
    SELECT b.title, b.author, COUNT(r.id)::int AS review_count,
           ROUND(AVG(r.rating)::numeric, 1) AS avg_rating
    FROM reviews r
    JOIN books b ON b.id = r.book_id
    WHERE COALESCE(r.created_at, r.updated_at) >= ($1::date)::timestamp AT TIME ZONE $3
      AND COALESCE(r.created_at, r.updated_at) <  ($2::date)::timestamp AT TIME ZONE $3
      AND r.rating > 0
    GROUP BY b.id, b.title, b.author
    ORDER BY review_count DESC
    LIMIT 1
  `, [yearStart, nextYearStart, TZ]);

  // ── Most active reader (most books finished) ───────────────────────────────
  const { rows: [topReader] } = await pool.query(`
    SELECT m.display_name, m.username, COUNT(*)::int AS books_finished
    FROM reading_progress rp
    JOIN members m ON m.id = rp.member_id
    WHERE rp.status = 'finished'
      AND rp.finished_at >= $1::date AND rp.finished_at < $2::date
    GROUP BY m.id, m.display_name, m.username
    ORDER BY books_finished DESC
    LIMIT 1
  `, [yearStart, nextYearStart]);

  // ── Top genre of the year ─────────────────────────────────────────────────
  const { rows: [topGenre] } = await pool.query(`
    SELECT bg.genre, COUNT(*)::int AS cnt
    FROM book_genres bg
    JOIN books b ON b.id = bg.book_id
    JOIN reading_progress rp ON rp.book_id = b.id
    WHERE rp.status = 'finished'
      AND rp.finished_at >= $1::date AND rp.finished_at < $2::date
    GROUP BY bg.genre
    ORDER BY cnt DESC
    LIMIT 1
  `, [yearStart, nextYearStart]);

  // ── Books of the Month this year ──────────────────────────────────────────
  const { rows: botms } = await pool.query(`
    SELECT title, author, botm_month
    FROM books
    WHERE botm_month LIKE $1
  `, [`% ${year}`]);   // botm_month looks like "June 2025" — the year comes last
  botms.sort((a, b) => monthValue(a.botm_month) - monthValue(b.botm_month));

  // ── Build embeds ──────────────────────────────────────────────────────────
  const embeds = [];

  // Header
  embeds.push({
    title:       `🎉 ${year} Year in Review — The Spicy Shelf`,
    description: `Another year of spicy reads wrapped up! Here's how the club did in ${year}. 🔥\n\n[Visit the library](${SITE_URL})`,
    color:       color.gold,
  });

  // Club stats
  embeds.push({
    title: `📊 Club Stats`,
    color: color.purple,
    fields: [
      { name: "📚 Books Finished",  value: books_read?.toString()   || "0", inline: true },
      { name: "⭐ Reviews Left",    value: reviews_left?.toString() || "0", inline: true },
      { name: "📄 Pages Read",      value: pages_read ? pages_read.toLocaleString() : "—", inline: true },
    ],
  });

  // Top rated book
  if (topBook) {
    embeds.push({
      title:       `🏆 Highest Rated Book of ${year}`,
      description: `**${topBook.title}**${topBook.author ? ` by ${topBook.author}` : ""}\n${topBook.avg_rating}★ average across ${topBook.review_count} review${topBook.review_count !== 1 ? "s" : ""}`,
      color:       color.gold,
      ...(topBook.cover_url ? { thumbnail: { url: topBook.cover_url } } : {}),
    });
  }

  // Most reviewed
  if (mostReviewed && mostReviewed.title !== topBook?.title) {
    embeds.push({
      title:       `💬 Most Discussed Book`,
      description: `**${mostReviewed.title}**${mostReviewed.author ? ` by ${mostReviewed.author}` : ""}\n${mostReviewed.review_count} reviews · ${mostReviewed.avg_rating}★ avg`,
      color:       color.pink,
    });
  }

  // Top reader
  if (topReader) {
    const who = topReader.display_name || topReader.username;
    embeds.push({
      title:       `📖 Most Voracious Reader`,
      description: `**${who}** finished ${topReader.books_finished} book${topReader.books_finished !== 1 ? "s" : ""} this year`,
      color:       color.green,
    });
  }

  // Top genre
  if (topGenre) {
    embeds.push({
      title:       `🎭 Favourite Genre`,
      description: `The club read the most **${topGenre.genre}** this year (${topGenre.cnt} book${topGenre.cnt !== 1 ? "s" : ""})`,
      color:       color.purple,
    });
  }

  // Books of the month
  if (botms.length > 0) {
    embeds.push({
      title:       `📔 Books of the Month`,
      description: botms.map(b => `**${b.botm_month}** — ${b.title}${b.author ? ` by ${b.author}` : ""}`).join("\n"),
      color:       color.gold,
    });
  }

  // Footer
  embeds.push({
    title:       `✨ Here's to ${year + 1}!`,
    description: `Thanks for another great year of reading together. Can't wait to see what we discover next. 📚🔥`,
    color:       color.purple,
  });

  // ── Post to Discord ───────────────────────────────────────────────────────
  // Split into chunks under Discord's 6000 char / 10 embed limits
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
    const payload = { username: "Spicy Shelf", embeds: chunks[i] };
    if (i === 0) payload.content = "<@&1445035924227493928>";
    const r = await fetch(WEBHOOK, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`Webhook failed: ${r.status} ${await r.text()}`);
    if (i < chunks.length - 1) await new Promise(res => setTimeout(res, 1000));
  }

  return { ok: true, year, sections: embeds.length };
}

// ── Route — called by Vercel cron ─────────────────────────────────────────────
router.get("/", cronAuth, async (req, res) => {
  try {
    const result = await postYearEnd();
    res.json(result);
  } catch (e) {
    console.error("Year-end digest error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
