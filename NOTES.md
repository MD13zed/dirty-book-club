# Dialed.gg — Edit-in-place + Direct Message Link

## What changed
1. **Back to editing in place.** Submitting/improving a score now edits the existing daily leaderboard message instead of posting a new one each time (this reverts the "resend" behavior from the previous round). If that message was deleted or the edit fails for any reason, it automatically falls back to posting a fresh one so nothing is lost.
2. **Real clickable link to the leaderboard.** The ephemeral confirmation after `/dialed score:` now says "Check the leaderboard to see where you stand!" as a link that jumps straight to the exact edited message — not just a channel mention. This uses Discord's message-link format (`discord.com/channels/<guild>/<channel>/<message>`), built from the interaction's own `guild_id` — no new config needed.

## Files in this package
- `backend/dialed.js` — replace
- `backend/routes/interactions.js` — replace
- `CHANGELOG.md` — replace

No database migration, no new env vars, **no need to re-run `register-commands.js`** — the command shape (`/dialed score:` / `/dialed leaderboard`) hasn't changed, only the internal logic.

## Steps
1. Drag these 3 files into your project, overwriting the existing ones.
2. Commit and push:
   ```
   git add .
   git commit -m "edit Dialed.gg leaderboard in place, link submitters straight to it"
   git push origin master
   ```
3. Test:
   - `/dialed score: <value>` — the leaderboard message in `DIALED_CHANNEL_ID` should update in place (same message, no new post), and your ephemeral reply should contain a clickable "Check the leaderboard to see where you stand!" link that jumps directly to it.
   - Submit again with a higher score — same message keeps getting edited, doesn't spawn new ones.
   - `/dialed leaderboard` — unaffected, still a standalone on-demand pull.
