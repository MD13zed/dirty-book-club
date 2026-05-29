const express = require("express");
const router  = express.Router();
const pool    = require("../db/pool");

const WEBHOOK  = process.env.DISCORD_WEBHOOK_ANNOUNCEMENTS;
const SITE_URL = process.env.FRONTEND_URL || "https://thespicyshelf.vercel.app";
const CRON_SECRET = process.env.CRON_SECRET || "";

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
    JOIN members m ON m.id = b.added_by
    WHERE b.added_at >= $1
      AND (b.source IS NULL OR b.source = 'manual')
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
  const { rows: [botm] } = await pool.query(`
    SELECT title, author, botm_month FROM books
    WHERE botm_month IS NOT NULL
    ORDER BY added_at DESC LIMIT 1
  `);

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
      description: `**${botm.title}**${botm.author ? ` by ${botm.author}` : ""}`,
      color:       color.gold,
    });
  }

  // New books
  if (newBooks.length > 0) {
    embeds.push({
      title: `📚 Added this week — ${newBooks.length} book${newBooks.length!==1?"s":""}`,
      description: newBooks.map(b => {
        const who = b.display_name || b.username;
        return `**${b.title}**${b.author?` *by ${b.author}*`:""} — added by ${who}`;
      }).join("\n"),
      color: color.purple,
    });
  }

  // Currently reading
  if (reading.length > 0) {
    embeds.push({
      title: `📖 Currently reading`,
      description: reading.map(r => {
        const who  = r.display_name || r.username;
        let line   = `**${who}** — ${r.title}`;
        if (r.current_page && r.total_pages) {
          const pct    = Math.round((r.current_page / r.total_pages) * 100);
          const filled = Math.round(pct / 10);
          const bar    = "█".repeat(filled) + "░".repeat(10 - filled);
          line        += `\n\`${bar}\` ${pct}%`;
        }
        return line;
      }).join("\n\n"),
      color: color.green,
    });
  }

  // Reviews
  if (reviews.length > 0) {
    embeds.push({
      title: `⭐ Reviews this week`,
      description: reviews.map(r => {
        const who   = r.display_name || r.username;
        const stars = "⭐".repeat(r.rating);
        let line    = `**${r.title}** — ${stars} by ${who}`;
        if (r.notes) line += `\n*"${r.notes.slice(0, 100)}${r.notes.length > 100 ? "…" : ""}"*`;
        return line;
      }).join("\n\n"),
      color: color.pink,
    });
  }

  // Nominations
  if (noms.length > 0) {
    embeds.push({
      title: `🗳 Current nominations`,
      description: noms.map((n, i) =>
        `**${i+1}.** ${n.title} — ${n.vote_count} vote${n.vote_count!==1?"s":""}`
      ).join("\n"),
      color: color.purple,
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
  const res = await fetch(WEBHOOK, {
    method:  "POST",
    headers: { "Content-Type":"application/json" },
    body:    JSON.stringify({
      username:   "Spicy Shelf",
      embeds,
    }),
  });

  if (!res.ok) throw new Error(`Webhook failed: ${res.status} ${await res.text()}`);
  return { ok:true, sections: embeds.length };
}

// ── Route — called by Vercel cron ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  // Verify the request is from Vercel cron (or a manual trigger with the secret)
  const auth = req.headers["authorization"] || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await postDigest();
    res.json(result);
  } catch (e) {
    console.error("Digest error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
