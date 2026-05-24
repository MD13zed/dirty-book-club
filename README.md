# 🔥 The Spicy Shelf

A private book club library for tracking, reviewing, and discussing reads together — with full Discord integration.

**Live at [thespicyshelf.vercel.app](https://thespicyshelf.vercel.app)**

---

## Features

### Library
- Add books with title, author, series, up to **5 genres**, total page count, cover image, and date read
- **Trigger warnings** — optional tags (Dubious Consent, Dark Themes, SA, Cliffhanger, etc.) shown as a collapsed toggle on book cards
- Sort by recently added, recently read, highest rated, title, author, or series
- Filter by genre using the colour strip at the top
- Search by title, author, or series
- Book covers uploaded directly or via URL (stored on Cloudinary)

### Reading Progress
- Per-member status: Want to Read, Currently Reading, Finished, Did Not Finish
- Page tracking with automatic percentage calculation when total pages are set
- DNF reason — leave a note when you don't finish, shown on your profile
- Progress bar shown on book cards and in the book modal

### Reviews
- Star ratings (1–5) and written notes per member
- Club average rating shown on each book card
- Member avatars shown on cards to indicate who has reviewed
- All reviews visible in the book modal

### Book Nominations & TBR Poll
- Members nominate any book for the next Book of the Month
- Upvote your favourite nominations
- Admin posts a native Discord poll from the nominations shortlist
- Members vote directly in Discord on what to read next

### Book of the Month
- Admin picks a book and month, fires a Discord announcement embed
- Thread automatically created in the book discussions channel
- BOTM badge displayed on the book card with the month name
- Full history of previous BOTMs in the admin dashboard

### Member Profiles
- Discord avatar and username synced automatically on login
- Custom display name and bio
- Reading stats: books finished, currently reading, reviews left, average rating
- DNF reasons and reading progress visible on profile
- Filter any member's profile reviews to show only a specific member's ratings

### Admin Dashboard
- Stats: total books, reviews, members, average club rating
- Top rated books and genre breakdown chart
- Activity feed of recent reviews
- Member management: grant/revoke admin, remove members
- Book of the Month picker with Discord announcement
- Nominations management and TBR poll posting

### Themes
6 dark themes selectable per member: Dark Purple, Midnight, Rose Gold, Dark Forest, Deep Ocean, Blood Moon

### Discord Bot — 9 Slash Commands

| Command | What it does |
|---|---|
| `/shelf` | Shows the 5 most recently added books |
| `/botm` | Shows the current Book of the Month |
| `/stats` | Club statistics |
| `/search title:` | Search the library by title |
| `/review title: rating: notes:` | Submit or update a review |
| `/reading title: status: page:` | Update reading progress |
| `/myshelf` | See your full reading list |
| `/myshelf status:finished` | Filter by status (finished / reading / want_to_read / dnf) |
| `/nominations` | See the current nomination shortlist with vote counts |
| `/leaderboard` | Who has read the most books and left the most reviews |

### Mobile
Installable as a PWA home screen app on iOS (Safari → Add to Home Screen) and Android (Chrome → Add to Home Screen).

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
| Domain | thespicyshelf.vercel.app |

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

## Project Structure

```
dirty-book-club/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BookCard.jsx      Book card with TW toggle, BOTM badge, progress
│   │   │   ├── BookModal.jsx     Full book detail, reviews, progress, edit
│   │   │   ├── Navbar.jsx        Navigation, theme switcher, profile link
│   │   │   └── ui.jsx            StarRating, Avatar, GenrePicker, TwPicker, ProgressBar
│   │   ├── pages/
│   │   │   ├── Library.jsx       Main library grid + nominations tab
│   │   │   ├── Admin.jsx         Admin dashboard
│   │   │   ├── Profile.jsx       Member profile + review filter
│   │   │   ├── Login.jsx         Discord OAuth button
│   │   │   └── LoginSuccess.jsx  OAuth callback token handler
│   │   ├── App.jsx               Auth + theme context, routing
│   │   ├── api.js                All API calls
│   │   └── theme.js              6 theme definitions
│   └── vercel.json               SPA routing for Vercel
├── backend/
│   ├── routes/
│   │   ├── auth.js               Discord OAuth + /auth/me
│   │   ├── books.js              Book CRUD + genres + trigger warnings
│   │   ├── reviews.js            Review upsert
│   │   ├── progress.js           Reading progress upsert + DNF reason
│   │   ├── members.js            Member profiles + update
│   │   ├── nominations.js        Nominate, vote, list
│   │   ├── admin.js              Admin stats, BOTM, TBR poll
│   │   ├── uploads.js            Cloudinary image upload
│   │   └── interactions.js       Discord slash command handler
│   ├── middleware/
│   │   ├── auth.js               JWT verification
│   │   └── requireAdmin.js       Admin guard
│   ├── db/
│   │   ├── pool.js               Neon PostgreSQL connection
│   │   ├── schema.sql            Initial schema
│   │   ├── botm_migration.sql    v2.1 — botm_month column
│   │   └── v3_migration.sql      v3 — total_pages, dnf_reason, book_tw, nominations
│   ├── discord.js                Webhook notifications + BOTM announcement + TBR poll
│   ├── register-commands.js      One-time Discord slash command registration
│   ├── server.js                 Express app
│   └── vercel.json               Backend Vercel config
└── api/
    └── index.js                  Vercel serverless entry point
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
| `DISCORD_WEBHOOK_ANNOUNCEMENTS` | Webhook URL for new books/reviews channel |
| `DISCORD_WEBHOOK_BOTM` | Webhook URL for book discussions channel |
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

Get a Discord user ID: Discord → Settings → Advanced → Developer Mode ON → right-click their name → Copy User ID.

---

## Registering Bot Commands

Run once from the `backend/` directory with `.env` filled in:

```bash
node register-commands.js
```

Re-run whenever new commands are added.

---

## Deploying Updates

Push to GitHub — Vercel auto-deploys both frontend and backend on every push to `main`/`master`.

```bash
git add .
git commit -m "your update message"
git push origin master
```

---

## Free Services Used

| Service | What for | Free limit |
|---|---|---|
| Vercel | Frontend + backend hosting | Unlimited hobby projects |
| Neon | PostgreSQL database | 0.5GB, never pauses |
| Cloudinary | Book cover storage | 25GB storage, 25GB bandwidth/month |
| Discord | OAuth login + bot + webhooks | Free |
