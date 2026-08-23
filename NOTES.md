# Dialed.gg — Resend Behavior + Leaderboard Pull Command

## What changed
1. **Score submissions now resend, not edit.** When someone submits a new best score, a fresh message with just the leaderboard (no role ping, no game reminders) posts to `DIALED_CHANNEL_ID`. The old behavior silently edited the previous message in place — this makes each update visible as it happens.
2. **New `/dialed leaderboard` subcommand.** Anyone can run this to pull a snapshot of today's standings (plus yesterday's winner) on demand, in whatever channel they run it from.
3. `/dialed` is now two subcommands instead of one flat command: `/dialed score:` and `/dialed leaderboard`.

## Files in this package
- `backend/dialed.js` — replace
- `backend/routes/interactions.js` — replace
- `backend/register-commands.js` — replace
- `CHANGELOG.md` — replace
- `README.md` — replace

No database migration, no new env vars, no cron changes.

## Steps
1. Drag these 5 files into your project, overwriting the existing ones.
2. Commit and push:
   ```
   git add .
   git commit -m "resend Dialed.gg leaderboard on submit, add /dialed leaderboard pull command"
   git push origin master
   ```
3. **Re-register commands** — this one matters this time, since `/dialed`'s shape changed from a flat command to subcommands:
   ```
   cd backend
   node register-commands.js
   ```
4. Test:
   - `/dialed score: <value>` — should behave as before (only updates on improvement), but now posts a *new* leaderboard message instead of editing the old one, and it won't ping the role or show the game reminders.
   - `/dialed leaderboard` — should reply with today's standings, visible to everyone in the channel it's run from, no role ping.
   - The morning cron post (`/api/dialed-morning`) is unaffected — still pings the role once a day with yesterday's winner, the reset board, and the game reminders.
