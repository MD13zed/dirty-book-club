const https = require("https");

const WEBHOOK_ANNOUNCEMENTS = process.env.DISCORD_WEBHOOK_ANNOUNCEMENTS;
const WEBHOOK_BOTM          = process.env.DISCORD_WEBHOOK_BOTM;
const BOT_TOKEN             = process.env.DISCORD_BOT_TOKEN;
const BOTM_CHANNEL_ID       = "1369670347229761614";

// Returns a promise that resolves once Discord has answered. Callers on Vercel
// MUST await this — serverless functions are frozen the moment the HTTP
// response is sent, so a fire-and-forget request is silently dropped.
function postWebhook(webhookUrl, payload) {
  return new Promise(resolve => {
    if (!webhookUrl) { console.warn("Webhook URL not set — skipping notification"); return resolve(false); }
    const body = JSON.stringify(payload);
    let url;
    try { url = new URL(webhookUrl); } catch { console.error("Invalid webhook URL"); return resolve(false); }
    const req  = https.request({
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   "POST",
      headers:  { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout:  8000,
    }, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        if (res.statusCode >= 300) console.error("Webhook failed:", res.statusCode, data);
        resolve(res.statusCode < 300);
      });
    });
    req.on("timeout", () => { console.error("Webhook timeout"); req.destroy(); });
    req.on("error", e => { console.error("Webhook error:", e.message); resolve(false); });
    req.write(body);
    req.end();
  });
}

function discordAPI(method, path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req  = https.request({
      hostname: "discord.com",
      path:     `/api/v10${path}`,
      method,
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Authorization":  `Bot ${BOT_TOKEN}`,
      },
    }, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data || "{}")); }
        catch { resolve({}); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Notify: book added ────────────────────────────────────────────────────────
async function notifyBookAdded({ title, author, series, genres, cover_url, added_by_name }) {
  const genreStr  = genres?.length ? genres.join(", ") : "Untagged";
  const seriesStr = series ? ` *(${series})*` : "";
  return postWebhook(WEBHOOK_ANNOUNCEMENTS, {
    embeds: [{
      title:       `📚 New Book Added!`,
      description: `**${title}**${seriesStr}\nby *${author || "Unknown"}*`,
      color:       0xb08af0,
      fields: [
        { name: "Genres",   value: genreStr,      inline: true },
        { name: "Added by", value: added_by_name, inline: true },
      ],
      thumbnail: cover_url ? { url: cover_url } : undefined,
      timestamp: new Date().toISOString(),
    }],
  });
}

// ── Notify: review left ───────────────────────────────────────────────────────
async function notifyReviewLeft({ book_title, member_name, rating, notes }) {
  const stars   = rating ? "⭐".repeat(rating) : "No rating";
  const preview = notes?.trim()
    ? (notes.length > 200 ? notes.slice(0, 197) + "…" : notes)
    : "*No notes left*";
  return postWebhook(WEBHOOK_ANNOUNCEMENTS, {
    embeds: [{
      title:       `✍️ New Review`,
      description: `**${member_name}** reviewed **${book_title}**`,
      color:       0xd060a0,
      fields: [
        { name: "Rating", value: stars,   inline: true },
        { name: "Notes",  value: preview, inline: false },
      ],
      timestamp: new Date().toISOString(),
    }],
  });
}

// ── Announce: book of the month + create thread ───────────────────────────────
async function announceBookOfTheMonth({ title, author, series, genres, cover_url, month }) {
  if (!BOT_TOKEN) { console.warn("DISCORD_BOT_TOKEN not set"); return; }

  const genreStr   = genres?.length ? genres.join(", ") : "Untagged";
  const seriesStr  = series ? ` *(${series})*` : "";
  const threadName = `${month} 📖 ${title}`;

  const msg = await discordAPI("POST", `/channels/${BOTM_CHANNEL_ID}/messages`, {
    content: "<@&1445035924227493928>",
    embeds: [{
      title:       `📔 Book of the Month — ${month}`,
      description: `**${title}**${seriesStr}\nby *${author || "Unknown"}*`,
      color:       0xa060d0,
      fields: [{ name: "Genres", value: genreStr, inline: true }],
      thumbnail: cover_url ? { url: cover_url } : undefined,
      footer:    { text: "Happy reading, DBC! 🔥" },
      timestamp: new Date().toISOString(),
    }],
  });

  if (msg.id) {
    try {
      await discordAPI("POST", `/channels/${BOTM_CHANNEL_ID}/messages/${msg.id}/threads`, {
        name:                  threadName,
        auto_archive_duration: 10080,
      });
    } catch (e) {
      console.error("Thread creation failed:", e.message);
    }
  } else {
    console.error("BOTM message post did not return an ID:", JSON.stringify(msg));
  }
}

// ── TBR Poll ──────────────────────────────────────────────────────────────────
async function postTbrPoll({ books, duration_hours = 48 }) {
  if (!BOT_TOKEN) { console.warn("DISCORD_BOT_TOKEN not set"); return; }

  await discordAPI("POST", `/channels/${BOTM_CHANNEL_ID}/messages`, {
    content: "<@&1445035924227493928>",
    poll: {
      question:         { text: "📚 Which book should we read next?" },
      answers:          books.map(b => ({
        poll_media: { text: b.author ? `${b.title} by ${b.author}` : b.title }
      })),
      duration:         duration_hours,
      allow_multiselect: false,
    },
  });
}

module.exports = { notifyBookAdded, notifyReviewLeft, announceBookOfTheMonth, postTbrPoll, discordAPI };
