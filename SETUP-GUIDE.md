# Dialed.gg Leaderboard — Setup Guide

Everything discussed is in this one package — nothing left over from earlier drafts, nothing missing.

## What this adds
- `/dialed score:` — Discord command to submit your daily Dialed.gg score
- A live leaderboard message that edits itself instantly when someone submits (no role ping on submit — only the submitter is mentioned)
- A once-a-day morning post that pings `@game on`, announces yesterday's winner, resets the board, and reminds everyone to play Dialed.gg, Wordle, and the Daily Word Wheel — with Wordle and Word Wheel as clickable links straight into their Discord Activity

## Step 1 — Drop in the files
Copy everything from this package into your `dirty-book-club` folder, keeping the same paths.

These files are **new**:
- `backend/dialed.js`
- `backend/routes/dialed-morning.js`
- `backend/db/v4_migration.sql`

These files **replace** your existing ones (they're the full file, already merged — no manual editing needed):
- `backend/discord.js`
- `backend/server.js`
- `backend/register-commands.js`
- `backend/routes/interactions.js`
- `backend/.env.example`
- `CHANGELOG.md`
- `README.md` (adds `/dialed` to the commands table and the two new env vars to the env table; also fixes a pre-existing markdown glitch where a missing line break had merged the `/stats` and `/search` table rows onto one line)

If your local `.env.example` or `README.md` have other changes you've made since, don't blind-overwrite — diff first and merge by hand.

## Step 2 — Run the DB migration
In the Neon SQL Editor, run the contents of `backend/db/v4_migration.sql`. This creates two tables: `dialed_scores` and `dialed_leaderboard_state`.

## Step 3 — Add environment variables (Vercel dashboard → your backend project → Settings → Environment Variables)
| Variable | Value |
|---|---|
| `DIALED_CHANNEL_ID` | The Discord channel ID where the leaderboard should live |
| `DISCORD_ROLE_GAME_ON` | `1506106813366407238` (your `@game on` role — change if it's different; this is also the built-in default if you skip setting it) |

To get a channel ID: right-click the channel in Discord → Copy Channel ID (enable Developer Mode in Discord settings if you don't see this option).

## Step 4 — Review before pushing
Diff at minimum, since these are full-file replacements:
- `backend/routes/interactions.js` — adds one `require("../dialed")` import, a new `handleDialed()` function, one new `case "dialed":` in the switch, and one new line in the `/getting-started` guide text. Everything else is untouched from your original file.
- `backend/server.js` — one new line mounting `/api/dialed-morning`.
- `backend/discord.js` — one word added to the final `module.exports` line (exports `discordAPI` too).
- `backend/register-commands.js` — one new command object appended to the `commands` array.

All six touched/new backend JS files have been syntax-checked with `node --check` — no errors.

## Step 5 — Commit and push
```
git add .
git commit -m "add Dialed.gg daily leaderboard command + morning cron"
git push origin master
```
Vercel auto-deploys both frontend and backend.

## Step 6 — Register the new slash command
From the `backend/` directory, with your local `.env` filled in:
```
node register-commands.js
```
This registers `/dialed` (and re-registers all existing commands — harmless).

## Step 7 — Add the cron job
On [cron-job.org](https://cron-job.org):
- **URL:** `GET https://<your-backend>.vercel.app/api/dialed-morning`
- **Header:** `Authorization: Bearer <your CRON_SECRET>` (same secret you already use for `/api/digest`)
- **Schedule:** once a day, whatever time you want the morning ping to fire

⚠️ Neon's `CURRENT_DATE` is UTC-based, so "today" and "yesterday" flip over at UTC midnight, not your local midnight. Pick a cron time that makes sense relative to UTC — e.g. if you want it to fire at 8am your local time and you're UTC-5, schedule it for 13:00 UTC.

## Step 8 — Test it
1. Run `/dialed score: 42.5` in Discord (you'll need to have logged into the web app at least once first, same as `/review`)
2. You should get a private (ephemeral) confirmation
3. Check `DIALED_CHANNEL_ID` — a leaderboard message should appear/update within a few seconds
4. Manually hit `https://<your-backend>.vercel.app/api/dialed-morning` with the `Authorization: Bearer <CRON_SECRET>` header (Postman, curl, or Insomnia) to test the morning post without waiting for the schedule

## Reference
- Wordle activity link: `https://discord.com/activities/1211781489931452447`
- Daily Word Wheel activity link: `https://discord.com/activities/1414977398377545749`
- These activity shortcut links reliably launch only when you're already in a voice channel in the server — that's Discord client behavior, not something this code controls. Test once after setup.
- Only one leaderboard message exists at a time — submitting a score edits it in place rather than spamming new messages.
- If nobody has posted the morning message yet and someone submits a score, the bot creates one itself (no role ping) rather than failing.
