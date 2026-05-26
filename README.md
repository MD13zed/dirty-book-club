# 🔥 The Spicy Shelf

A private book club library for tracking, reviewing, and discussing reads together — with full Discord integration.

**Live at [thespicyshelf.vercel.app](https://thespicyshelf.vercel.app)**

---

## Features

### Library
- Add books with title, author, series, cover image, date read, total pages
- **Search to pre-fill** — type a title or author to look up book details from Open Library automatically. Fills in title, author, cover, and page count in one click.
- **Import from Goodreads** — upload your Goodreads library export CSV to bulk-import your read books. Covers fetched automatically via ISBN. Available to all members.
- Up to **5 genres** per book from a list of 100+
- **Trigger warnings** — optional tags shown as a collapsed toggle on book cards. Once you expand and dismiss them, the toggle stays hidden for that book — per member, persists across sessions
- All book cards are uniform size — books without covers show a styled placeholder
- Sort by recently added, recently read, highest rated, title, author, series
- Filter by genre using the colour strip at the top — on mobile, tapping shows a label with the active genre and a clear button
- Filter by reading status — All / Reading / Finished / Want to Read / DNF
- Search by title, author, or series

### Reading Progress
- Per-member status: Want to Read, Currently Reading, Finished, Did Not Finish
- Page tracking with automatic percentage bar when total pages are set
- DNF reason — leave a note when you stop, shown on your profile
- Status filter on the library to see only books you're reading, finished, etc.

### Reviews
- Star ratings (1–5) and written notes per member per book
- Club average rating shown on each book card
- Member avatars shown on cards indicating who has reviewed
- Click a reviewer's name in the book modal to go to their profile
- Filter your reviews by star rating on your profile page

### Reading Now
- Dedicated tab showing every club member who is currently reading, with book cover, progress bar and percentage
- Updates in real time — tap any entry to open the book modal
- Tab label shows the active reader count at a glance

### Book Nominations & TBR Poll
- Nominate any library book for the next Book of the Month — button inside each card
- Previous BOTMs cannot be nominated again
- Upvote your favourite nominations (one vote per member) — nominations are always sorted by vote count so the most popular float to the top
- Nominations tab in the library shows the full shortlist with vote counts
- Admin posts a native Discord poll from the nominations shortlist
- Members vote directly in Discord on what to read next

### Book of the Month
- Admin picks a book and month, fires a Discord embed announcement
- Thread automatically created in the book discussions channel
- Gold BOTM banner on the book card with the month name
- **BOTM History tab** — all members can browse every past BOTM sorted newest first, with club average rating, review count, and page count per book

### Member Profiles
- Discord avatar and username synced automatically on login
- Custom display name and bio
- Reading stats: books finished, currently reading, review count, average rating
- Reviews filterable by star rating
- Reading progress list with DNF reasons shown
- Theme picker — saves per member

### Admin Dashboard
- Stats: total books, reviews, members, average rating, top rated books, genre breakdown
- Member management: grant/revoke admin, remove members
- Recent activity feed
- Book of the Month picker with Discord announcement and thread creation
- Nominations management and TBR poll posting to Discord

### Themes
6 dark themes per member: Dark Purple, Midnight, Rose Gold, Dark Forest, Deep Ocean, Blood Moon

### Discord Bot — 11 Slash Commands

| Command | What it does |
|---|---|
| `/shelf` | Shows the 5 most recently added books |
| `/botm` | Shows the current Book of the Month |
| `/stats` | Club stats — books, reviews, members, avg rating, total pages read, top rated book, most reviewed book, most active reader this month |
| `/search title:` | Search the library by title |
| `/review title: rating: notes:` | Submit or update a review |
| `/reading title: status: page:` | Update reading progress |
| `/myshelf` | See your full reading list, filterable by status |
| `/nominations` | See the current nomination shortlist with vote counts |
| `/leaderboard` | Who has read the most books and left the most reviews |
| `/members` | Everyone in the club with their reading stats. Add `user:@someone` to look up a specific member — shows their currently reading list with progress bars, recent reviews, and favourite genre |
| `/getting-started` | Full guide to everything you can do — only visible to you |

### Mobile
Installable as a PWA on iOS (Safari → Add to Home Screen) and Android (Chrome → Add to Home Screen)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router |
| Backend | Node.js, Express (Vercel serverless) |
| Database | PostgreSQL via Neon |
| Auth | Discord OAuth2 + JWT |
| Images | Cloudinary |
| Discord | Webhooks + Bot (slash commands via Interactions API) |
| Hosting | Vercel (frontend + backend, free) |

---

## Database Schema

```
members           — Discord ID, username, avatar, bio, theme, admin flag
books             — title, author, series, cover, date read, total pages, BOTM month
book_genres       — up to 5 genres per book
book_tw           — trigger warning tags per book
reviews           — rating + notes per member per book
reading_progress  — status, current page, DNF reason per member per book
nominations       — book nominations for BOTM voting
nomination_votes  — one vote per member per nomination
```

---

## Environment Variables

### Backend (Vercel)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Long random string for signing tokens |
| `DISCORD_CLIENT_ID` | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | Discord application client secret |
| `DISCORD_REDIRECT_URI` | OAuth callback URL |
| `DISCORD_BOT_TOKEN` | Bot token for announcements and slash commands |
| `DISCORD_APP_PUBLIC_KEY` | For verifying slash command signatures |
| `DISCORD_GUILD_ID` | Server ID for instant command registration |
| `DISCORD_WEBHOOK_ANNOUNCEMENTS` | Webhook for new books/reviews channel |
| `DISCORD_WEBHOOK_BOTM` | Webhook for book discussions channel |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `FRONTEND_URL` | Frontend deployment URL |
| `API_URL` | Backend deployment URL |

### Frontend (Vercel)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend deployment URL |

---

## Making Someone Admin

After they log in with Discord for the first time, run in Neon SQL Editor:

```sql
UPDATE members SET is_admin = TRUE WHERE discord_id = 'THEIR_DISCORD_USER_ID';
```

---

## Registering Bot Commands

Run once from the backend/ directory with .env filled in:

```bash
node register-commands.js
```

Re-run whenever new commands are added.

---

## Importing from Goodreads

Any member can import their read books from a Goodreads library export:

1. In Goodreads go to **My Books → Import/Export → Export Library** and download the CSV
2. In the app click **📥 Import from Goodreads** in the library header
3. Upload the CSV — only books from your "Read" shelf are shown
4. Deselect any books you don't want to import
5. Click Import — covers are fetched automatically using the ISBN

Genres and trigger warnings can be added to imported books by clicking into them afterwards.

---

## Deploying Updates

```bash
git add .
git commit -m "your update message"
git push origin master
```

Vercel auto-deploys both frontend and backend on every push.

---

## Free Services Used

| Service | What for | Free limit |
|---|---|---|
| Vercel | Frontend + backend hosting | Unlimited hobby projects |
| Neon | PostgreSQL database | 0.5GB, never pauses |
| Cloudinary | Book cover image storage | 25GB storage, 25GB bandwidth/month |
| Discord | OAuth login + bot + webhooks | Free |
| Open Library | Book metadata + cover lookup | Free, no API key needed |
