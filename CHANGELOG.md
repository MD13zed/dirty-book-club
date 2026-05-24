# Changelog

All notable changes to The Spicy Shelf are documented here.

---

## [3.0.0] — 2026-05-24

### Added
- **Book nominations** — members can nominate any book for the next Book of the Month directly from the library. Nominations tab shows the full shortlist with vote counts.
- **Nomination upvoting** — members upvote their favourite nominations. One vote per member per book.
- **TBR poll** — admin can select nominated books and post a native Discord poll to the server, letting the whole club vote on what to read next.
- **Trigger warnings** — books now support trigger warning tags (Dubious Consent, Violence, Dark Themes, SA, Cliffhanger, and 20+ more). Shown as a collapsed toggle on book cards and in the book modal so members who want to avoid spoilers can choose when to see them.
- **Total page count** — books now store total pages. Reading progress percentage is calculated automatically without members having to enter the total each time.
- **DNF reason** — when marking a book as Did Not Finish, members can leave a short note explaining why. Shows on their profile.
- **Review filter by member** — on any member's profile, reviews can be filtered to show only a specific member's take on books they've both read.
- **5 genres per book** — genre limit increased from 3 to 5.
- **Expanded genre list** — 100+ genres and tropes now available including subgenres (Mafia Romance, Why Choose, Omegaverse, Dark Erotica, Fae Romance, and more).
- **`/nominations` Discord command** — shows the current nomination shortlist with vote counts.
- **`/leaderboard` Discord command** — shows who has finished the most books, is currently reading, and left the most reviews. Top 3 get medals.

### Changed
- Library now has a tab bar switching between **Library** and **Nominations** views.
- Admin dashboard has a new **Nominations** tab alongside the existing BOTM tab.
- Book card nominate button appears inline on the library grid.
- Genre picker updated to support up to 5 selections and shows count as x/5.

---

## [2.1.0] — 2026-05-23

### Added
- **Book of the Month badge** — current BOTM displays a gold banner on its book card with the month name.
- **BOTM history** — admin dashboard lists all previous Books of the Month sorted newest first.
- **`/botm` fix** — Discord command now shows the most recent month instead of the oldest.
- **Admin nominations tab** — admin can manage and remove nominations.

### Fixed
- BOTM admin picker now saves `botm_month` to the database before firing the Discord announcement (previously only announced without saving).
- `setBookOfTheMonth` added to `api.js` (was called in Admin.jsx but not defined).
- `uploadCover` in `api.js` now uses `VITE_API_URL` correctly for split frontend/backend deployments.

---

## [2.0.0] — 2026-05-22

### Added
- **Discord OAuth login** — members sign in with their Discord account. Username and avatar synced automatically. No passwords.
- **PostgreSQL database via Neon** — fully persistent shared data replacing localStorage. Books, reviews, and progress shared across all members in real time.
- **Cloudinary image uploads** — book covers uploaded directly from the add book form, stored on Cloudinary CDN with auto-resize.
- **Reading progress sync** — per-member reading status (Want to Read, Reading, Finished, DNF) and current page tracked in the database and visible on book cards and profiles.
- **Admin dashboard** — stats overview, member management (grant/revoke admin, remove members), activity feed, genre breakdown chart, top rated books.
- **Member profiles** — bio, Discord avatar, reading stats, review history, reading progress list. Theme picker on own profile.
- **6 dark themes** — Dark Purple, Midnight, Rose Gold, Dark Forest, Deep Ocean, Blood Moon. Saved per member.
- **Book of the Month** — admin picks a book and month, fires a Discord embed announcement with a thread automatically created in the book discussions channel.
- **Discord webhook notifications** — new book added and new review left fire webhooks to the announcements channel.
- **7 Discord bot slash commands** — `/shelf`, `/botm`, `/stats`, `/search`, `/review`, `/reading`, `/myshelf`
- **PWA support** — installable as a home screen app on iOS and Android.
- **Deployed on Vercel** (frontend + backend) with Neon PostgreSQL and Cloudinary — fully free stack.
- **Custom domain** — thespicyshelf.vercel.app

### Changed
- Rebuilt from scratch as a full-stack app. Previous version used browser localStorage and Netlify Blobs.
- Backend: Node.js + Express deployed as Vercel serverless functions.
- Database: PostgreSQL (Neon) replacing localStorage/Netlify Blobs.

---

## [1.1.0] — 2026-05-20

### Added
- Standalone HTML version deployed on Netlify.
- Netlify Blobs for shared storage across members.
- Netlify serverless functions for books and reviews API.

---

## [1.0.0] — 2026-05-20

### Added
- Initial single-file HTML app.
- Book library with title, author, series, genres, date read, and cover URL.
- Star ratings and review notes per member.
- Reading progress tracking (status + page number).
- 6 dark colour themes.
- Genre colour strip and filter bar.
- Sort by recently added, recently read, highest rated, title, author, series.
- Data stored in browser localStorage.
- PWA manifest for mobile install.
