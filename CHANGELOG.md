# Changelog

All notable changes to The Spicy Shelf are documented here.

---

## [3.5.2] — 2026-06-18

### Performance
- **Search prefill feels faster** — debounce reduced 700 ms → 350 ms (half the wait before a search fires after you stop typing); client abort timeout tightened 8 s → 5 s (the search is now server-to-server so it reliably completes in well under 1 s); backend axios timeout tightened to match.

### Fixed
- **Search-to-prefill and Open Library covers now work on restricted mobile networks** — some client networks (carrier / DNS / content filters) close the connection to `openlibrary.org` and `covers.openlibrary.org` by hostname, so on those phones the prefill search returned nothing and Open Library cover thumbnails showed as broken images, while desktop on an unfiltered network was fine. Search and cover images are now proxied through our own backend (`backend/routes/booksearch.js` → `GET /api/booksearch`, `GET /api/booksearch/cover`), which reaches Open Library server-side. The client only ever talks to our own origin. New frontend helper `coverSrc()` (in `frontend/src/api.js`) rewrites any `openlibrary.org` cover URL to the proxy at render time, so existing books with stored Open Library covers fix themselves with no DB migration. Cover responses are cached a week (`Cache-Control: immutable`) and the cover route is exempt from the heavy `/api` rate limit so a large library's first load can't 429.
- **Search-to-prefill now works on mobile** — tapping a result in the "Search to pre-fill" dropdown when adding a book had no effect on phones (worked on desktop). The dropdown rows fired on touch-end, which on the mobile bottom sheet was lost to the soft-keyboard dismissal reflowing the layout out from under your finger (and to scroll-claim turning the tap into a `touchcancel`). Rows now select on `pointerdown` (press-down, before any reflow), unifying mouse + touch and matching the behaviour desktop already had. Added `touch-action: manipulation` on rows to suppress tap delay/double-tap zoom.
- **Mobile dropdown no longer clipped** — the add-book bottom sheet is an `overflow:auto` scroll container, which clips absolutely-positioned children; the results dropdown could render off the tappable area. On mobile the dropdown now renders inline (in normal flow, no nested scroll container) so it can't be clipped and can't swallow the tap. Desktop keeps the floating overlay.

### Changed
- **Service worker cache bumped** `spicy-shelf-v4` → `v5` so installed PWAs / phones evict the stale JS bundle and pick up the fixes on next load.

### Diagnostics (temporary — removed)
- `SEARCH_DEBUG` flag and `ol=` readout confirmed working (`ol=ok:6`); removed in this cleanup commit.

---

## [3.5.1] — 2026-06-17

### Added
- **PWA install banner on Android** — when Chrome detects the site is installable, a banner appears below the navbar with an Install button and a dismiss ✕. Tapping Install triggers the native browser prompt. Banner is hidden once installed or dismissed.

---

## [3.6.0] — 2026-06-14

### Added
- **Google Books merged into search-to-prefill** — adding a book now searches both Open Library and Google Books and merges the results. Open Library has good coverage for traditionally published books, but misses most indie and self-published titles (which make up a lot of what the club reads) — Google Books fills that gap.
- **Duplicate results removed** — if the same book appears in both sources, it's only shown once (matched by normalized title + author, with series/edition info stripped from the title first).
- **"In library" badge** — search results that match a book already in the library are flagged with a small badge, so you can spot accidental re-adds before adding. Matches even when the search result's title includes series info that your library entry doesn't (e.g. "Twisted Trails" vs "Twisted Trails (Rogue Riders Duet Book 2)").
- **Cleaner autofill for series titles** — picking a search result whose title embeds series info (e.g. "Book 2", "#1", "Duet", "Trilogy", "Saga") now splits that into the Series field automatically, leaving the Title field clean.

### Notes
- Google Books API requires no API key for basic search, same as Open Library — no new environment variables or backend changes.
- Series field for Google Books results is inferred from the subtitle (e.g. "Rogue Riders Duet, Book 2") since Google Books has no dedicated series field — may not always be present depending on how the publisher listed it.

---

## [3.5.0] — 2026-06-14

### Added
- **🎉 Club Applause** — weekly digest now includes a monthly shoutout section: top 3 readers (most books finished this calendar month) and top 3 reviewers (most reviews left this calendar month), with medal rankings. Section is skipped if nobody qualifies.

### Changed
- **Weekly digest schedule** — moved from Sundays 4pm UTC to **12pm UTC**, scheduled via cron-job.org.
- **Top readers query** — now based on `finished_at` (the date a book was actually marked finished) instead of `updated_at`, so editing an unrelated field on an old entry no longer affects which month a finish counts toward.
- **Leaderboard tie-breaking** — top readers and top reviewers now sort alphabetically by display name as a tiebreaker for equal counts, for deterministic ordering.

### Fixed
- **PWA icon** — `manifest.json` declared icons as `purpose: "any maskable"`, but the artwork is a circular badge with transparent padding that doesn't fill the maskable safe zone, causing the icon to appear cropped/wrong on Android home screens and in some browser contexts. Changed to `purpose: "any"` to match the actual artwork.

---

## [3.5.0] — 2026-06-17

### Changed (mobile only)
- **Bottom sheet modal** — book cards now slide up from the bottom as a sheet with a drag handle and rounded top corners instead of a floating card. Max height 92dvh with internal scroll.
- **Safe area insets** — body now respects `env(safe-area-inset-bottom)` so content isn't hidden behind the iPhone home bar. Modal sheet also pads for the home bar.
- **Larger star tap targets** — star rating in the review section is 32px on mobile (was 22px) for easier tapping.
- **Status change toast** — tapping a reading status button (Reading, Finished, DNF, etc.) now shows a brief confirmation toast at the bottom of the modal.
- **Theme picker in mobile navbar** — 🎨 pill next to the profile avatar opens a popover with all theme options. Admin ⚙ badge stays between theme and avatar.
- **Add book as bottom sheet** — tapping "+ Add Book" on mobile opens a bottom sheet overlay instead of expanding inline above the grid.
- **Nominations tighter layout** — nomination cards are more compact on mobile, vote button is larger (48×48px min) and stacks the arrow above the count for easier tapping. Title truncates cleanly.

## [3.4.1] — 2026-06-17

### Fixed
- **Mobile back button closes modal** — opening a book card now pushes a history entry so tapping back closes the modal instead of exiting the site/PWA.
- **Reading Now tab syncs on progress change** — updating your reading status or page count now instantly refreshes the Reading Now tab without needing a full page reload.

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
