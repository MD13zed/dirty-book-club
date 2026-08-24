# Dialed.gg Leaderboard — Not Updating / Not Posting: Troubleshooting

## What this update changes
Nothing about *why* it's failing — it fixes the symptom of the bug being invisible. Previously, if the leaderboard message couldn't be edited or posted, `/dialed score:` still showed a "check the leaderboard" link/mention that led nowhere real, because the code assumed success. Now it checks the actual Discord API result and, on failure, tells you plainly in the ephemeral reply, e.g.:

> ⚠️ Your score was saved, but the public leaderboard couldn't be updated (Missing Access). Let an admin know.

Your score is still saved either way — this only affects the public leaderboard message.

## Files in this package
- `backend/dialed.js` — replace
- `backend/routes/interactions.js` — replace
- `CHANGELOG.md` — replace

No migration, no env vars, no command re-registration needed.

## Steps
1. Drag these 3 files in, overwriting the existing ones.
2. `git add . && git commit -m "surface real Dialed.gg leaderboard update failures" && git push origin master`
3. Run `/dialed score: <value>` again — this time the ephemeral reply will tell you the *actual* Discord error if it's still failing (e.g. "Missing Access", "Missing Permissions", "Unknown Channel").

## Most likely root causes (check these regardless)

Given all three symptoms happened together — no update to an existing message, no new message ever posted, and a dead link — the bot is almost certainly failing every single call to Discord for this channel. In order of likelihood:

### 1. `DIALED_CHANNEL_ID` was added to Vercel but never redeployed
Adding an environment variable in the Vercel dashboard does **not** retroactively apply to already-running serverless functions — it only takes effect on the *next* deployment.
- **Fix:** Vercel dashboard → your backend project → Deployments → latest deployment → **Redeploy**. (Or just push any small commit, like this fix, which will redeploy automatically.)

### 2. Wrong channel ID
- Right-click the channel in Discord → **Copy Channel ID** (requires Developer Mode: User Settings → Advanced → Developer Mode).
- Compare it character-for-character against `DIALED_CHANNEL_ID` in Vercel. A common mistake is copying the *server* ID instead of the *channel* ID by right-clicking the wrong thing.

### 3. Bot doesn't have access to that channel
Bots don't automatically see every channel — if the channel has custom permission overwrites (private channel, restricted category, etc.), the bot's role needs explicit **View Channel** and **Send Messages** permission there, even if it has those permissions server-wide.
- **Fix:** Right-click the channel → Edit Channel → Permissions → make sure your bot's role (or the bot itself) has View Channel + Send Messages allowed, not just inherited/denied from a category.

### 4. The bot was never actually invited to this server, or its token changed
Unlikely since other bot features (BOTM announcements, TBR polls) already work — but if those don't work either, the shared `DISCORD_BOT_TOKEN` itself is the problem, not this feature.

## Checking the real error (after this fix)
1. Run `/dialed score: <value>` in Discord.
2. Look at the ephemeral reply — if it now shows a specific error like "Missing Access" (Discord error code 50001) or "Missing Permissions" (50013), that confirms it's a permissions issue (causes #2 or #3 above).
3. For more detail, check **Vercel dashboard → your backend project → your latest deployment → Logs (or Runtime Logs)** right after running the command — look for a line starting with `Dialed leaderboard update failed for <discord_id>:` which prints the exact error and code.

## Also worth checking
- Has the `/api/dialed-morning` cron job (Step 7 from setup) ever actually run successfully? Check its execution history on cron-job.org. If it's never run, there's no existing leaderboard message to edit — every `/dialed score:` submission should be trying to **post a new one** via the fallback path. If that's *also* failing, it points straight at causes #1–#3 above rather than anything specific to "editing."
