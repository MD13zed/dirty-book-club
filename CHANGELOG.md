# Changelog

All notable changes to The Spicy Shelf are documented here.

---

## [3.7.0] — 2026-10-27

> **Run `backend/db/v6_migration.sql` in the Neon SQL Editor** (creates the small `cron_runs` table). Until it's run everything still works — the cron jobs just don't have the double-post protection.

### Added
- **Slash commands no longer time out when the database is asleep.** A command still running after 1.8 s is answered straight away with "thinking…" and then edited with the real result (uses `@vercel/functions` `waitUntil` so Vercel keeps the function alive). Commands that answer faster behave exactly as before. `/dialed score` keeps its private reply. Turn off with `SLASH_DEFER_MS=0`.
- **Cron jobs run once per period** (`middleware/cronOnce.js`): digest once a day, year-end once a year, the two Dialed posts once per Dialed day. A retry or repeated call returns `{skipped}` and posts nothing; a failed run releases its claim so a retry works; `?force=1` runs it again on purpose.
- `GET /api/health?db=1` also wakes the database (optional — uses more Neon compute hours).

### Removed
- **Leftover root-level deploy files.** The API deploys from `backend/` and the frontend from `frontend/` (each Vercel project's Root Directory), so the repo root's `vercel.json`, `api/index.js` and `package.json` dependency list were never used and could only drift out of date. They're gone; the root `package.json` keeps just its scripts. Each project's own `vercel.json` (in `backend/` and `frontend/`) stays.

### Changed
- **Discord ids moved into config** (`backend/config.js`): the club role id and the Book-of-the-Month channel id can be set with `DISCORD_ROLE_BOOK_CLUB` and `DISCORD_BOTM_CHANNEL_ID`; the defaults are today's values, so nothing changes until you set them.
- **Role pings only happen from production.** On a Vercel Preview deployment (or with `DISCORD_ROLE_PINGS=off`) the role isn't pinged, so testing can't ping the club.
- The login button uses `VITE_API_URL` like the rest of the app (falls back to the production address if unset).
- Backend dependency ranges (the only list that matters now) raised to the patched versions (express, axios, cors, dotenv, express-rate-limit, jsonwebtoken) so an older, vulnerable version can't be installed; `@vercel/functions` pinned to 3.6.1 (newer releases pull in vulnerable packages). `npm audit`: 0 issues.

---

## [3.6.9] — 2026-10-27

### Fixed
- **A custom display name survives logging in again.** Every login used to overwrite it with the Discord name; now the Discord name is only used when the site has none.
- **A Book of the Month pick leaves the nominations list** (its nomination and votes are removed when you pick it, and already-picked books are hidden from the list), so it can't end up in a TBR poll again.
- **Failed saves are visible.** The reading-status buttons and finish-date box show "Couldn't save — please try again" instead of failing silently, and an expired login no longer lets the page keep running after it starts redirecting to the login page. The total-pages box shows the book's own page count as a placeholder (leaving it blank means "use the book's page count").
- **Default avatars use Discord's real formula** (the old maths lost precision on big Discord ids, so some members got the wrong default picture).
- **`/search`, `/review` and `/reading`:** `%` and `_` typed in a title now match literally instead of acting as wildcards.
- **Names and titles can't add formatting or links to Discord posts.** Member names, book titles, authors and series are escaped in the digest, year-end post, new-book/review/DNF/BOTM announcements, Dialed leaderboard and slash-command replies (review text is left as typed so spoiler tags still work).
- **Dialed ties are ordered by who submitted first** instead of arbitrarily.
- **Open Library / Google search results carry at most 40 subjects each** (some books came back with 100+), which makes search responses smaller.

### Docs
- Corrected the Dialed.gg description: the morning post pings `@here` (the 3.6.5 note said nothing pings), the evening post doesn't, and `/dialed score:` posts nothing public. README now has a "Daily Dialed.gg posts" section, lists `CRON_SECRET` for all four cron endpoints, and no longer lists the unused `DISCORD_ROLE_GAME_ON`.

### Removed
- Leftover files from the old Oracle/MySQL/pm2/nginx hosting setup (`nginx/`, `ecosystem.config.js`, `scripts/setup.sh`, `scripts/deploy.sh`, `scripts/duckdns.sh`) and the old one-off update notes (`NOTES.md`, `SETUP-GUIDE.md`, `TROUBLESHOOTING.md`). They're all still in git history.

---

## [3.6.8] — 2026-10-27

> **Run `backend/db/v5_migration.sql` in the Neon SQL Editor BEFORE deploying.** (Adds `reviews.created_at`; existing reviews are backfilled so past numbers don't change.)

### Changed
- **The library API is members-only.** `/api/books`, `/api/reviews` and `/api/members` (plus `/api/members/:id`) now need a login. Cover images stay public (browsers can't attach a login to an `<img>`).
- **Page-number boxes** save once — 0.7 s after you stop typing or when you leave the box — instead of on every keystroke.
- **Goodreads import** sends books in batches of 100 (`POST /api/books/import`) instead of one request per book, so big libraries no longer hit the rate limit, and books already in the library (same title + author) are skipped. The finish screen reports added / skipped / failed.
- **Book of the Month month** is picked from month + year dropdowns, and the server only accepts `"October 2026"`-style values.
- **Finish dates, "this month" and "last year" use club time (Aruba, `CLUB_TIMEZONE`)** instead of UTC. An evening finish on Dec 31 now counts for that year. Also applies to `/reading` in Discord.
- **Login token travels in the URL fragment** (`/login-success#token=…`) so it stays out of browser history, server logs and the service-worker cache. Service worker cache bumped to v6 (clears older caches) and never stores the login page.
- Adding/editing a book is all-or-nothing (transaction). A Discord notification failure no longer turns a saved book/review into an error (which led to duplicate retries).
- `PATCH /api/books/:id` now returns 404 for a missing book and accepts partial updates.
- `/stats` "most active this month" counts by finish date, matching the weekly digest, and its queries run in parallel (faster against Discord's 3-second limit).
- Cover proxy: its own rate limit, 2 MB size cap, image-only responses. Cover uploads are capped at 4 MB (Vercel rejects larger bodies anyway).

### Fixed
- **Year-end stats** now include all of Dec 31 (ranges were `BETWEEN … AND '…-12-31'`, which stopped at midnight at the start of that day), use club time, and count reviews by when they were first written, not last edited.
- **Year-end "Books of the Month" section was always empty** — it searched for text starting with the year, but months are stored as "June 2025". Fixed and sorted by month.
- **Weekly digest** no longer fails if a Book of the Month month is oddly typed (sorting moved out of SQL).
- Bad input now gets a clear 400 instead of a 500 with database text: ratings (whole number 0–5), notes length, progress status/pages/dates, bad ids, display name/bio length, unknown genres/trigger warnings (the API only accepts tags from the lists, plus tags a book already has). Raw error messages are no longer returned to the browser.
- `/auth/me` and profile saves return an error instead of hanging if the database fails. Profile updates only change fields that were sent.

### Notes
- The API validates genres/trigger warnings against `backend/taxonomy.js`, generated from the lists in `ui.jsx`. After editing those lists run `node scripts/sync-taxonomy.js` (or `npm run sync-taxonomy`).
- Optional new env var `CLUB_TIMEZONE` (default `America/Aruba`).
- Not changed on purpose: who is allowed to edit a book (any member still can).

---

## [3.6.7] — 2026-10-27

### Security
- **Login is now limited to members of the Discord server.** After Discord OAuth, the backend asks Discord (via the bot) whether the user is in `DISCORD_GUILD_ID`. Outsiders are sent back to the login page with an "invite-only" message and no account is created. Fails closed in production if the check can't run.
- **Cron endpoints fail closed.** `/api/digest`, `/api/yearend`, `/api/dialed-morning` and `/api/dialed-evening` now return 503 if `CRON_SECRET` isn't set (they used to be open to anyone) and compare the secret in constant time. Shared logic lives in `middleware/cronAuth.js`.
- **Admin checks read the database, not the login token.** Promotions and demotions take effect immediately instead of after the 30-day token expires. Applies to the admin routes plus "owner or admin" deletes of books and nominations.
- **Dependencies:** `npm audit fix` (express, axios, body-parser, qs, form-data, follow-redirects, proxy-addr), `multer` 1.x → 2.x, and `uuid` replaced with Node's built-in `crypto.randomUUID()`.

### Fixed
- **Book of the Month announcement now actually waits for Discord** before the request finishes (Vercel was free to drop it). The admin page reports what happened: announced, announced without a thread, or failed with Discord's reason. The pick itself is always saved.
- **TBR poll and BOTM thread names are trimmed to Discord's limits** (poll answers 55 characters, thread names 100) and Discord errors are no longer swallowed — a rejected poll now shows an error instead of "posted".
- Poll duration is clamped to Discord's 1–768 hours, and poll answers keep the order the admin picked.
- Discord REST calls time out after 8 seconds instead of hanging.

### Notes
- `.env.example` now lists every variable the app uses (added `CRON_SECRET`, `DISCORD_GUILD_ID`, `DISCORD_APP_PUBLIC_KEY`, webhooks, `GOOGLE_BOOKS_API_KEY`; removed unused `DISCORD_ROLE_GAME_ON`).

---

## [3.6.6] — 2026-10-26

### Added
- **Genres expanded from 140 to 350.** Pulled in the mainstream Goodreads categories we were missing (Classics, History, Psychology, Science, Philosophy, Religion, Business, Travel, Cookbook, Manga, Comics, Children's, Middle Grade, Western and more), plus many more romance subgenres and tropes (Historical, Regency, Romantic Comedy, Romantic Suspense, Fake Dating, Only One Bed, Rivals to Lovers, Fated Mates, Morally Grey, Touch Her and Die, MC/Biker, Bratva, Hockey and other sports romances), thriller/mystery/horror/fantasy/sci-fi subgenres (Legal Thriller, Cosmic Horror, Grimdark, LitRPG, Cozy Sci-Fi, Dark Academia, Xianxia and more), and extra kink/spice tags.
- **Trigger warnings expanded from 36 to 136.** Grouped by what they cover: violence, sexual violence, abuse types, loss and grief, mental health, medical and pregnancy, discrimination, phobias/squick, and ending warnings (No HEA, Major Character Death).
- Any genre without an explicit colour now gets a stable colour generated from its name, so new tags never all look the same.

### Changed
- **Up to 8 genres per book** (was 5). Limit is a single `MAX_GENRES` constant in `ui.jsx` and `routes/books.js` (frontend picker, Open Library auto-match and the backend all use it).
- **Open Library genre auto-match is now whole-word only**, and broad nonfiction words (Art, Science, History, War, Music…) only match an exact subject. Otherwise the old substring match would have tagged books by accident ("Particular" → Art, "Science fiction" → Science).

### Notes
- No database migration needed: `book_genres.genre` and `book_tw.tag` are already `VARCHAR(100)`. Existing tags are untouched.

---

## [3.6.5] — 2026-10-06

### Changed
- **Morning Dialed.gg post is now a quiet reminder.** `GET /api/dialed-morning` no longer pings the `@game on` role and no longer posts a leaderboard — it just posts the game links (Dialed.gg, Wordle, Daily Word Wheel) with a nudge to play. *(This release made the post ping nobody; a later one changed it to ping `@here` — see 3.6.9. Everything else here is still accurate.)*
- **Score submissions no longer post or edit a leaderboard.** `/dialed score:` just records the score and replies privately to the submitter.

### Added
- **End-of-day final leaderboard** — new `GET /api/dialed-evening` cron endpoint (same `CRON_SECRET` header pattern). Posts the day's final top 5 and winner once, with no pings. Schedule it in cron-job.org (timezone America/New_York) before midnight ET so it lands on the right Dialed date.

### Removed
- Leaderboard message editing/reposting (`refreshLeaderboardMessage`) and the role ping. `DISCORD_ROLE_GAME_ON` is no longer used.

---

## [3.6.4] — 2026-08-23

### Fixed
- **`/dialed score:` no longer hides leaderboard update failures.** Previously, if editing or posting the public leaderboard message failed (bad channel ID, missing bot permissions, etc.), the confirmation reply still showed a "check the leaderboard" link/mention that pointed nowhere real — masking the failure. It now checks the actual result and, on failure, tells the submitter plainly that the leaderboard couldn't be updated and logs the real Discord API error (message + error code) server-side for debugging.

---

## [3.6.3] — 2026-08-23

### Changed
- **Score submissions edit the daily leaderboard message again** instead of posting a new one each time — reverted from the previous "resend" behavior back to an in-place edit. Still no role ping and no game reminders on these. If the stored message was deleted or can no longer be edited, it falls back to posting a fresh one automatically.
- **"Check the leaderboard" is now a real link** — the confirmation reply after submitting a score links directly to the exact leaderboard message (jumps straight there when tapped) instead of just mentioning the channel.

---

## [3.6.2] — 2026-08-23

### Added
- **`/dialed leaderboard` subcommand** — pulls a live snapshot of today's standings (plus yesterday's winner) on demand, visible to whoever ran it. `/dialed` now has two subcommands: `score` and `leaderboard`.

### Changed
- **Score submissions resend instead of edit** — after a score is submitted or improved, a brand-new leaderboard-only message is posted rather than silently editing the previous one, so the update is visible in the channel as it happens. Still no role ping and no game reminders on these — those stay exclusive to the once-daily morning post.

---

## [3.6.1] — 2026-08-23

### Changed
- **`/dialed` only updates on improvement** — submitting a score no longer overwrites the day's leaderboard entry unless it's strictly higher than the member's existing score for today. Equal or lower scores get an ephemeral "not a new best" reply and the public leaderboard message is left untouched (no unnecessary edit).

---

## [3.6.0] — 2026-08-23

### Added
- **`/dialed` Discord command** — submit your daily [Dialed.gg](https://dialed.gg) score (0–50, decimals allowed). One score per member per day; resubmitting updates it.
- **Live Dialed.gg leaderboard** — submitting a score instantly edits a shared leaderboard message in `DIALED_CHANNEL_ID` (top 5 + current leader). Only the submitter is mentioned ("Just submitted: @you") — no role-wide ping on every score.
- **Daily Dialed.gg morning post** — new `GET /api/dialed-morning` cron endpoint (same `CRON_SECRET` header pattern as the weekly digest). Once a day it pings `DISCORD_ROLE_GAME_ON`, announces yesterday's winner, resets the leaderboard to TBD, and reminds the club to play Dialed.gg, Wordle, and the Daily Word Wheel — with clickable links. Wordle and Daily Word Wheel link straight into their Discord Activity via shortcut links (`discord.com/activities/<id>`); Dialed.gg links out to the website since it has no Discord activity.
- New tables: `dialed_scores`, `dialed_leaderboard_state` — see `backend/db/v4_migration.sql`.
- New env vars: `DIALED_CHANNEL_ID`, `DISCORD_ROLE_GAME_ON`.

### Notes
- Requires re-running `node register-commands.js` from the backend directory after deploying.
- Add a new cron-job.org job hitting `GET https://<your-backend>/api/dialed-morning` with header `Authorization: Bearer <CRON_SECRET>`, scheduled once each morning. Note Neon's `CURRENT_DATE` is UTC, so "today"/"yesterday" flip at UTC midnight — pick the cron time with that in mind.

---

## [3.4.1] — 2026-07-04

### Fixed
- **BOTM history was being wiped on every new pick** — `POST /api/admin/botm` ran `UPDATE books SET botm_month=NULL` on the whole table before setting the new book's month, clearing `botm_month` off every previous Book of the Month. This happened regardless of whether "Post announcement to Discord" was checked, since the backend never read that flag in the first place — every save hit the same code path. Now the route only sets `botm_month` on the newly picked book; older picks keep theirs.
- **"Post announcement to Discord" checkbox had no effect** — the backend ignored the `announce` flag entirely and posted to Discord on every BOTM save, checked or not. Now the route only calls `announceBookOfTheMonth` when `announce` is true.

---

## [3.4.0] — 2026-05-26

### Added
- **📖 Reading Now tab** — new tab in the library showing every member currently reading a book, with cover, progress bar, and percentage. Tapping any entry opens the book modal. Tab label shows the active reader count.
- **🏆 BOTM History tab** — new tab available to all members listing every past Book of the Month sorted newest first, with gold left border, club average rating, review count, and page count per book. Previously only admins could see this in the admin dashboard.
- **Genre colour strip label on mobile** — tapping a genre in the colour strip now shows a small coloured label below it with the active genre name and a ✕ clear button. Desktop still uses the hover tooltip.
- **Weekly digest** — posts to `library-updates` every Sunday at 4pm UTC. Includes manually added books (CSV imports excluded), who's currently reading with progress bars, reviews left that week, current nominations, and the active BOTM. Falls back to a "quiet week 🌙" message if nothing happened.

### Changed
- **`/stats` expanded** — now shows total pages read across all members, top rated book (minimum 2 reviews), most reviewed book, and most active reader this month, in addition to the existing counts.
- **Tab bar updated** — Library, Reading Now, Nominations, and BOTM History tabs. On mobile the labels shorten to icons and counts to save space.

---

## [3.3.0] — 2026-05-24

### Added
- **`/members` Discord command** — lists all club members ranked by books finished, with review count and average rating. Use `/members user:@someone` to view a specific member's full profile: currently reading list with progress bars, last 3 reviews with notes, and their favourite genre based on books finished.
- **TW dismiss per member** — trigger warnings now have a "dismiss — don't show again" link when expanded. Clicking it hides the toggle for that book permanently for that member (stored in localStorage, persists across sessions). A faint "TW dismissed — show again" link lets them restore it any time.

### Changed
- **Nominations sorted by vote count** — the nominations tab now always shows the most-voted book at the top, re-sorting live as votes come in.
- **Book card progress bar** — reading now shows a progress bar with percentage and current/total pages. Finished shows a full green bar with the date finished. DNF shows how far through the member got.
- **`/myshelf` progress bar** — books you're currently reading now show a `█████░░░░░ 52% · p.210/400` bar instead of just the page number.
- **Scroll snap on add form** — closing the add book form or successfully adding a book now smoothly scrolls back to the top of the library grid instead of leaving the page mid-scroll.
- **Genres expanded to 140 and alphabetized** — added Alien Romance, Alternate History, Anthology, Breeding Kink, Cozy Fantasy, Cyberpunk, Dark Fantasy, Essays, F/F Romance, Fairy Tale Retelling, Family Saga, Found Family, Free Use, Humor / Comedy, Isekai, M/M Romance, Mythology, Nonfiction, Novella, Obsessive Hero, Pet Play, Polyamory, Possessive Hero, Praise Kink, Prey / Predator, Queer Romance, Romance, Sapphic Romance, Size Difference, Slice of Life, Space Opera, Stalker Romance, Steampunk, Time Travel. All genres and trigger warnings alphabetized.
- **Trigger warnings expanded to 36** — added Death of a Child, Domestic Violence, Forced Pregnancy, Homophobia / Transphobia, Human Trafficking, Medical Trauma, Mental Illness, Racism / Racial Violence, Religious Trauma, Terminal Illness, War / Combat.
- **Per-member finished date** — when marking a book as Finished, a date picker appears so each member can log when they finished it. Saved separately per member.

---

## [3.2.0] — 2026-05-24

### Added
- **Open Library search prefill** — when adding a book, type a title or author in the new "Search to pre-fill" field to look up details automatically. Results appear in a dropdown with cover thumbnails; selecting one fills in the title, author, cover URL, and page count instantly.
- **Goodreads CSV import** — members can import their read books directly from a Goodreads library export. Available to all members via the "📥 Import from Goodreads" button in the library header.
  - Only imports books from the "Read" shelf — to-read and currently-reading are skipped
  - Preview screen lets members deselect any books before importing
  - Covers are automatically fetched from Open Library using the ISBN from the export
  - Progress bar shows which book is being imported
  - Genres and trigger warnings can be added to imported books afterwards
  - Imports: title, author, page count, date read, cover (via ISBN lookup)
- **`/getting-started` Discord command** — sends a full guide to everything members can do on The Spicy Shelf. Ephemeral (only visible to the person who ran it) so it doesn't spam the channel. Useful to point new members to the moment they join the server.

### Notes
- Open Library search prefill and Goodreads import are entirely frontend — no backend changes, no new environment variables, no dependencies added.
- `/getting-started` requires re-running `node register-commands.js` from the backend directory after deploying.

---

## [3.1.0] — 2026-05-24

### Fixed
- Book cards are now all uniform height — books without covers show a styled genre-coloured placeholder instead of a tiny 8px bar
- Nominate button moved inside the book card at the bottom (no longer floating in space beneath the card)
- Reading status filter (Reading / Finished / Want to Read / DNF) was always returning empty — `myProgressMap` was being built after the filter ran instead of before
- Status filter changed from buttons to a dropdown, matching the genre and sort dropdowns
- "Invalid Date" on book cards — date parsing now handles both string and Date object formats from PostgreSQL safely
- Discord signature verification broken for `discord-interactions` v4 — `verifyKey` is now async in v4 and was being called synchronously, causing all verifications to fail
- Reviewer names in the book modal are now clickable links to that member's profile
- Review filter on profile page fixed — was comparing fields that don't exist in the data. Replaced with a working star rating filter (All / 5★ / 4★ / 3★ / 2★ / 1★)
- BOTM history sort in admin fixed — `new Date("February 2026")` returns Invalid Date in JavaScript, replaced with a proper month name parser

---

## [3.0.0] — 2026-05-24

### Added
- **Book nominations** — members nominate any library book for the next Book of the Month. Nominate button is inside each book card at the bottom.
- **Nomination upvoting** — one vote per member per book. Vote counts shown on the nominations tab.
- **Previous BOTMs cannot be nominated** — blocked on both frontend and backend.
- **TBR poll** — admin selects nominated books and posts a native Discord poll to the server.
- **Trigger warnings** — separate tag system (Dubious Consent, Violence, Dark Themes, SA, Cliffhanger, and 20+ more). Collapsed toggle on book cards and in the book modal.
- **Total page count** — stored per book. Reading progress percentage calculated automatically.
- **DNF reason** — short note when marking a book Did Not Finish. Shown on the member's profile.
- **Reading status filter** — dropdown on the library to filter by Reading / Finished / Want to Read / DNF.
- **Review filter by star rating** — on any member's profile, filter reviews by 1–5 stars.
- **5 genres per book** — limit increased from 3.
- **100+ genre and trope tags** — expanded list including subgenres, romance tropes, erotica subgenres, and more.
- **`/nominations` Discord command** — current shortlist with vote counts.
- **`/leaderboard` Discord command** — who has finished the most books and left the most reviews, with medals for top 3.
- Nominations tab in the library.
- Nominations tab in the admin dashboard with TBR poll management.

### Changed
- Library has a tab bar switching between Library and Nominations views.
- Genre picker updated to 5 selections, shows x/5 count.

---

## [2.1.0] — 2026-05-23

### Added
- **Book of the Month badge** — gold banner on the book card with the month name.
- **BOTM history** — admin dashboard lists all previous BOTMs sorted newest first.
- **`/botm` fix** — Discord command now shows the most recent month, not the oldest.

### Fixed
- BOTM admin route now saves `botm_month` to the database before firing the Discord announcement.
- `setBookOfTheMonth` added to `api.js`.
- `uploadCover` uses `VITE_API_URL` correctly for split Vercel deployments.

---

## [2.0.0] — 2026-05-22

### Added
- **Discord OAuth login** — no passwords. Username and avatar synced automatically.
- **PostgreSQL via Neon** — fully shared persistent database replacing localStorage.
- **Cloudinary image uploads** — book covers uploaded directly, auto-stored on CDN.
- **Reading progress sync** — status and page tracking per member, shared in real time.
- **Admin dashboard** — stats, member management, activity feed, genre breakdown, top rated books.
- **Member profiles** — bio, Discord avatar, reading stats, review history, progress list. Theme picker.
- **6 dark themes** — Dark Purple, Midnight, Rose Gold, Dark Forest, Deep Ocean, Blood Moon.
- **Book of the Month** — admin picks book and month, Discord embed + thread created automatically.
- **Discord webhook notifications** — new book and new review fire to the announcements channel.
- **7 Discord bot slash commands** — `/shelf`, `/botm`, `/stats`, `/search`, `/review`, `/reading`, `/myshelf`.
- **PWA** — installable on iOS and Android.
- **Deployed on Vercel** — frontend and backend as separate deployments, fully free.
- **Custom domain** — thespicyshelf.vercel.app.

### Changed
- Complete rebuild as a full-stack app. Previous version used browser localStorage.

---

## [1.1.0] — 2026-05-20

### Added
- Standalone HTML version deployed on Netlify.
- Netlify Blobs for shared storage.
- Netlify serverless functions for books and reviews.

---

## [1.0.0] — 2026-05-20

### Added
- Initial single-file HTML app with localStorage.
- Book library with title, author, series, genres, date read, cover URL.
- Star ratings and review notes per member.
- Reading progress tracking.
- 6 dark colour themes.
- Genre filter strip and sort options.
- PWA manifest.
