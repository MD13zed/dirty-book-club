# Changelog

All notable changes to The Spicy Shelf are documented here.

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
