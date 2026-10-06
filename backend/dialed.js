// Dialed.gg daily score tracking — morning game reminder (no pings), end-of-day final leaderboard, and on-demand snapshot
const pool = require("./db/pool");
const { discordAPI } = require("./discord");

const CHANNEL_ID = process.env.DIALED_CHANNEL_ID;
const DIALED_URL = "https://dialed.gg";

// Discord "activity shortcut links" — clicking these launches the activity
// directly (same as hitting Copy Link from the 🎮 launcher). Requires being
// in a voice channel in the server to actually launch.
const WORDLE_ACTIVITY_ID     = "1211781489931452447";
const WORD_WHEEL_ACTIVITY_ID = "1414977398377545749";
const WORDLE_URL             = `https://discord.com/activities/${WORDLE_ACTIVITY_ID}`;
const WORD_WHEEL_URL         = `https://discord.com/activities/${WORD_WHEEL_ACTIVITY_ID}`;

const MEDALS = ["🥇","🥈","🥉","4️⃣","5️⃣"];

// Dialed leaderboard day is based on Eastern Time, not the server/UTC date.
// Override with DIALED_TIMEZONE if the deployment ever needs another zone.
const DIALED_TIMEZONE = process.env.DIALED_TIMEZONE || "America/New_York";

function getDialedDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DIALED_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fmtDate(dateStr = getDialedDate()) {
  // dateStr is YYYY-MM-DD; format it without allowing the server timezone
  // to shift the displayed calendar date.
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

async function getTodayLeaderboard(todayStr = getDialedDate()) {
  const { rows } = await pool.query(`
    SELECT m.discord_id, m.display_name, m.username, ds.score
    FROM dialed_scores ds JOIN members m ON m.id = ds.member_id
    WHERE ds.play_date = $1::date
    ORDER BY ds.score DESC
    LIMIT 5
  `, [todayStr]);
  return rows;
}

async function getYesterdayWinner(todayStr = getDialedDate()) {
  const { rows: [w] } = await pool.query(`
    SELECT m.discord_id, ds.score
    FROM dialed_scores ds JOIN members m ON m.id = ds.member_id
    WHERE ds.play_date = ($1::date - 1)
    ORDER BY ds.score DESC LIMIT 1
  `, [todayStr]);
  return w || null;
}

// Never ping anyone from bot posts — <@id> mentions still render as names.
const NO_PINGS = { parse: [] };

function buildContent({ yesterdayWinner, today, final = false }) {
  const lines = [];
  lines.push(final
    ? "🏆 **🎨 [DIALED.GG](https://dialed.gg) — FINAL RESULTS**"
    : "🏆 **🎨 [DIALED.GG](https://dialed.gg) — DAILY RESULTS**");
  if (!final) {
    if (yesterdayWinner) {
      lines.push(`🎉 **Yesterday's Winner:** <@${yesterdayWinner.discord_id}>    — **${Number(yesterdayWinner.score).toFixed(2)}** / 50 🎉`);
      lines.push("*gg to everyone who played!*");
    } else {
      lines.push("🎉 *Nobody played yesterday — be the one to beat today!*");
    }
  }
  lines.push("━━━━━━━━━━━━━━━");
  lines.push(final ? "🎨 **TODAY'S FINAL LEADERBOARD**" : "🎨 **TODAY'S LEADERBOARD**");
  lines.push(`*${fmtDate()}*`);
  for (let i = 0; i < 5; i++) {
    const entry = today[i];
    if (entry) {
      const name = entry.display_name || entry.username;
      lines.push(`${MEDALS[i]} **${name}** — \`${Number(entry.score).toFixed(2)}\` / 50`);
    } else {
      lines.push(`${MEDALS[i]} **TBD** — \`0\` / 50`);
    }
  }
  if (final) {
    lines.push(today[0]
      ? `🎉 **Today's Winner:** <@${today[0].discord_id}>  —  **${Number(today[0].score).toFixed(2)}** / 50 🎉\n*gg to everyone who played!*`
      : `🎉 *Nobody played today — see you tomorrow!*`);
  } else {
    lines.push(today[0]
      ? `🔥 **Current Leader:** <@${today[0].discord_id}>  —  **${Number(today[0].score).toFixed(2)}**`
      : `🔥 **Current Leader:** *Nobody yet — be the first!*`);
    lines.push("*Scores can change throughout the day — keep playing!* 🎨🧠");
  }
  return lines.join("\n");
}

// ── Morning post — a plain, no-ping reminder with the game links ────────────
async function postMorningReminder() {
  if (!CHANNEL_ID) { console.warn("DIALED_CHANNEL_ID not set"); return { ok: false }; }

  const content = [
    "📅 **Today's games are up — come play!**",
    `🎨 [Dialed.gg](${DIALED_URL}) — no Discord app for this one, visit the site then log your score with \`/dialed\``,
    `🟩 [Wordle](${WORDLE_URL}) — tap to launch`,
    `🔤 [Daily Word Wheel](${WORD_WHEEL_URL}) — tap to launch`,
    "",
    "*The final leaderboard posts tonight.* 🎨🧠",
  ].join("\n");

  const msg = await discordAPI("POST", `/channels/${CHANNEL_ID}/messages`, { content, allowed_mentions: NO_PINGS });
  if (!msg.id) { console.error("Dialed morning post failed:", JSON.stringify(msg)); return { ok: false }; }
  return { ok: true };
}

// ── End-of-day post — the ONE leaderboard post each day, no pings ───────────
async function postEveningLeaderboard() {
  if (!CHANNEL_ID) { console.warn("DIALED_CHANNEL_ID not set"); return { ok: false }; }
  const today = await getTodayLeaderboard(getDialedDate());
  const content = buildContent({ today, final: true });

  const msg = await discordAPI("POST", `/channels/${CHANNEL_ID}/messages`, { content, allowed_mentions: NO_PINGS });
  if (!msg.id) { console.error("Dialed evening post failed:", JSON.stringify(msg)); return { ok: false }; }
  return { ok: true };
}

// ── On-demand pull for `/dialed leaderboard` — always includes yesterday's
// winner for context since it's a standalone snapshot. No role ping.
async function getLeaderboardSnapshot() {
  const todayStr = getDialedDate();
  const [today, yesterdayWinner] = await Promise.all([
    getTodayLeaderboard(todayStr),
    getYesterdayWinner(todayStr),
  ]);
  return buildContent({ yesterdayWinner, today });
}

module.exports = { postMorningReminder, postEveningLeaderboard, getLeaderboardSnapshot };
