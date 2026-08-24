// Dialed.gg daily score tracking — builds/posts/edits the shared leaderboard message
const pool = require("./db/pool");
const { discordAPI } = require("./discord");

const CHANNEL_ID = process.env.DIALED_CHANNEL_ID;
const ROLE_ID    = process.env.DISCORD_ROLE_GAME_ON || "1506106813366407238";
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

function buildContent({ pingRole, yesterdayWinner, today, lastSubmitterDiscordId, lastSubmitterScore, includeReminder }) {
  const lines = [];
  if (pingRole) lines.push(`<@&${ROLE_ID}>`);
  lines.push("🏆 **🎨 [DIALED.GG](https://dialed.gg) — DAILY RESULTS**");
  if (yesterdayWinner) {
    lines.push(`🎉 **Yesterday's Winner:** <@${yesterdayWinner.discord_id}>    — **${Number(yesterdayWinner.score).toFixed(2)}** / 50 🎉`);
    lines.push("*gg to everyone who played!*");
  } else {
    lines.push("🎉 *Nobody played yesterday — be the one to beat today!*");
  }
  lines.push("━━━━━━━━━━━━━━━");
  lines.push("🎨 **TODAY'S LEADERBOARD**");
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
  lines.push(today[0]
    ? `🔥 **Current Leader:** <@${today[0].discord_id}>  —  **${Number(today[0].score).toFixed(2)}**`
    : `🔥 **Current Leader:** *Nobody yet — be the first!*`);
  if (lastSubmitterDiscordId) {
    lines.push("", `📝 *Just submitted:* <@${lastSubmitterDiscordId}> — **${Number(lastSubmitterScore).toFixed(2)}** / 50`);
  }
  lines.push("*Scores can change throughout the day — keep playing!* 🎨🧠");

  if (includeReminder) {
    lines.push(
      "",
      "📅 **Don't forget today's games:**",
      `🎨 [Dialed.gg](${DIALED_URL}) — no Discord app for this one, visit the site then log your score with \`/dialed\``,
      `🟩 [Wordle](${WORDLE_URL}) — tap to launch`,
      `🔤 [Daily Word Wheel](${WORD_WHEEL_URL}) — tap to launch`,
    );
  }

  return lines.join("\n");
}

async function getState() {
  const { rows: [s] } = await pool.query("SELECT * FROM dialed_leaderboard_state WHERE id = 1");
  return s || null;
}

async function saveState(channel_id, message_id, board_date) {
  await pool.query(`
    INSERT INTO dialed_leaderboard_state (id, channel_id, message_id, board_date)
    VALUES (1, $1, $2, $3)
    ON CONFLICT (id) DO UPDATE SET channel_id=$1, message_id=$2, board_date=$3
  `, [channel_id, message_id, board_date]);
}

// ── Morning post — the ONE role ping per day, plus reset + game reminders ──
async function postMorningLeaderboard() {
  if (!CHANNEL_ID) { console.warn("DIALED_CHANNEL_ID not set"); return { ok: false }; }
  const todayStr = getDialedDate();
  const yesterdayWinner = await getYesterdayWinner(todayStr);

  const content = buildContent({
    pingRole: true,
    yesterdayWinner,
    today: [],
    includeReminder: true,
  });

  const msg = await discordAPI("POST", `/channels/${CHANNEL_ID}/messages`, { content });
  if (!msg.id) { console.error("Dialed morning post failed:", JSON.stringify(msg)); return { ok: false }; }

  await saveState(CHANNEL_ID, msg.id, todayStr);
  return { ok: true };
}

// ── Called right after a score submission — edits the shared leaderboard
// message in place (no role ping, no game reminders). Yesterday's winner is
// only shown if this is the first leaderboard post of the day — once one
// exists (morning cron or an earlier submission), later edits skip straight
// to live standings. Always resolves to { ok, channelId, messageId } on
// success, or { ok:false, error, code } on failure — callers must check
// `ok` rather than assume a truthy return means it worked.
async function refreshLeaderboardMessage({ lastSubmitterDiscordId, lastSubmitterScore }) {
  if (!CHANNEL_ID) {
    console.warn("DIALED_CHANNEL_ID not set — leaderboard message not updated.");
    return { ok: false, error: "DIALED_CHANNEL_ID not configured" };
  }
  const todayStr = getDialedDate();
  const [today, state] = await Promise.all([getTodayLeaderboard(todayStr), getState()]);
  const haveTodayMessage = state && String(state.board_date).slice(0, 10) === todayStr && state.message_id;

  const yesterdayWinner = haveTodayMessage ? null : await getYesterdayWinner(todayStr);
  const content = buildContent({
    pingRole: false,
    yesterdayWinner,
    today,
    lastSubmitterDiscordId,
    lastSubmitterScore,
    includeReminder: false,
  });

  if (haveTodayMessage) {
    const edited = await discordAPI("PATCH", `/channels/${state.channel_id}/messages/${state.message_id}`, { content });
    if (edited && edited.id) {
      return { ok: true, channelId: state.channel_id, messageId: state.message_id };
    }
    // Edit failed (message deleted, permissions changed, etc.) — fall
    // through and post a fresh one below rather than losing the update.
    console.warn("Dialed leaderboard edit failed, posting a new message instead:", JSON.stringify(edited));
  }

  const msg = await discordAPI("POST", `/channels/${CHANNEL_ID}/messages`, { content });
  if (msg && msg.id) {
    await saveState(CHANNEL_ID, msg.id, todayStr);
    return { ok: true, channelId: CHANNEL_ID, messageId: msg.id };
  }
  console.error("Dialed leaderboard post failed — Discord API response:", JSON.stringify(msg));
  return { ok: false, error: msg?.message || "Unknown Discord API error", code: msg?.code };
}

// ── On-demand pull for `/dialed leaderboard` — always includes yesterday's
// winner for context since it's a standalone snapshot, not tied to the
// day's running thread of messages. No role ping, no game reminders.
async function getLeaderboardSnapshot() {
  const todayStr = getDialedDate();
  const [today, yesterdayWinner] = await Promise.all([
    getTodayLeaderboard(todayStr),
    getYesterdayWinner(todayStr),
  ]);
  return buildContent({ pingRole: false, yesterdayWinner, today, includeReminder: false });
}

module.exports = { postMorningLeaderboard, refreshLeaderboardMessage, getLeaderboardSnapshot };
