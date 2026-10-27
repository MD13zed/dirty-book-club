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

// Low-level Discord REST call. Resolves { status, data } (never rejects on an
// HTTP error status — callers decide what to do), and gives up after 8 seconds
// so a slow Discord can't hang the whole serverless function.
function discordRequest(method, path, payload) {
  return new Promise((resolve, reject) => {
    const body    = payload === undefined ? null : JSON.stringify(payload);
    const headers = { "Authorization": `Bot ${BOT_TOKEN}` };
    if (body) {
      headers["Content-Type"]   = "application/json";
      headers["Content-Length"] = Buffer.byteLength(body);
    }
    const req = https.request({
      hostname: "discord.com",
      path:     `/api/v10${path}`,
      method,
      headers,
      timeout:  8000,
    }, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        let parsed = {};
        try { parsed = JSON.parse(data || "{}"); } catch {}
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on("timeout", () => req.destroy(new Error("Discord request timed out")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// Same as before for existing callers: resolves just the parsed JSON body.
function discordAPI(method, path, payload) {
  return discordRequest(method, path, payload).then(r => r.data);
}

// Trim to Discord's character limits (counts characters, not UTF-16 units).
function clip(text, max) {
  const chars = Array.from(String(text ?? ""));
  return chars.length <= max ? chars.join("") : chars.slice(0, max - 1).join("") + "…";
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

// ── Notify: book DNF'd (reason is hidden behind a Discord spoiler) ────────────
async function notifyDnf({ book_title, member_name, reason, reasonOnly = false }) {
  const clean   = (reason || "").trim().replace(/\|\|/g, "| |");   // stop "||" from breaking the spoiler
  const trimmed = clean.length > 900 ? clean.slice(0, 897) + "…" : clean;
  const lines = [reasonOnly
    ? `**${member_name}** added why they DNF'd **${book_title}**`
    : `**${member_name}** didn't finish **${book_title}**`];
  if (trimmed) lines.push(`Why: ||${trimmed}||`);
  return postWebhook(WEBHOOK_ANNOUNCEMENTS, {
    embeds: [{
      title:       `💀 DNF`,
      description: lines.join("\n"),
      color:       0x904040,
      timestamp:   new Date().toISOString(),
    }],
  });
}

// ── Announce: book of the month + create thread ───────────────────────────────
// Returns { ok, thread, error } so the admin page can show what really happened.
async function announceBookOfTheMonth({ title, author, series, genres, cover_url, month }) {
  if (!BOT_TOKEN) { console.warn("DISCORD_BOT_TOKEN not set"); return { ok: false, thread: false, error: "DISCORD_BOT_TOKEN is not set" }; }

  const genreStr   = genres?.length ? genres.join(", ") : "Untagged";
  const seriesStr  = series ? ` *(${series})*` : "";
  const threadName = clip(`${month} 📖 ${title}`, 100);   // Discord thread names max 100 chars

  const { status, data: msg } = await discordRequest("POST", `/channels/${BOTM_CHANNEL_ID}/messages`, {
    content: "<@&1445035924227493928>",
    embeds: [{
      title:       `📔 Book of the Month — ${month}`,
      description: `**${title}**${seriesStr}\nby *${author || "Unknown"}*`,
      color:       0xa060d0,
      fields: [{ name: "Genres", value: clip(genreStr, 1024), inline: true }],
      thumbnail: cover_url ? { url: cover_url } : undefined,
      footer:    { text: "Happy reading, DBC! 🔥" },
      timestamp: new Date().toISOString(),
    }],
  });

  if (status >= 300 || !msg.id) {
    console.error("BOTM message post failed:", status, JSON.stringify(msg));
    return { ok: false, thread: false, error: msg.message || `Discord returned HTTP ${status}` };
  }

  let thread = false;
  try {
    const t = await discordRequest("POST", `/channels/${BOTM_CHANNEL_ID}/messages/${msg.id}/threads`, {
      name:                  threadName,
      auto_archive_duration: 10080,
    });
    thread = t.status < 300;
    if (!thread) console.error("Thread creation failed:", t.status, JSON.stringify(t.data));
  } catch (e) {
    console.error("Thread creation failed:", e.message);
  }
  return { ok: true, thread };
}

// ── TBR Poll ──────────────────────────────────────────────────────────────────
// Returns { ok, error }. Poll answers max 55 chars; duration is whole hours, 1–768.
async function postTbrPoll({ books, duration_hours = 48 }) {
  if (!BOT_TOKEN) { console.warn("DISCORD_BOT_TOKEN not set"); return { ok: false, error: "DISCORD_BOT_TOKEN is not set" }; }

  const hours = Math.min(768, Math.max(1, Math.round(Number(duration_hours)) || 48));

  const { status, data } = await discordRequest("POST", `/channels/${BOTM_CHANNEL_ID}/messages`, {
    content: "<@&1445035924227493928>",
    poll: {
      question:         { text: "📚 Which book should we read next?" },
      answers:          books.map(b => ({
        poll_media: { text: clip(b.author ? `${b.title} by ${b.author}` : b.title, 55) }
      })),
      duration:         hours,
      allow_multiselect: false,
    },
  });

  if (status >= 300 || !data.id) {
    console.error("TBR poll failed:", status, JSON.stringify(data));
    return { ok: false, error: data.message || `Discord returned HTTP ${status}` };
  }
  return { ok: true };
}

module.exports = { notifyBookAdded, notifyReviewLeft, notifyDnf, announceBookOfTheMonth, postTbrPoll, discordAPI, discordRequest };
