# 🔥 Dirty Book Club

A private, invite-only book tracking app for your spicy reading group. Built with React + Vite on the frontend and Node/Express on the backend, with Discord OAuth for authentication.

---

## What It Does

- Login with Discord — no passwords, no accounts to manage
- Track books your club has read with covers, genres, and dates
- Trigger warnings on books (dubious consent, dark themes, violence, etc.)
- Rate and review books privately within your group
- Track reading progress per member (want to read, reading, finished, DNF)
- Filter library by genre, progress status, or search
- Nominate books for future reads and vote on nominations
- TBR Poll — admin posts a Discord poll from nominated books
- Book of the Month — admin picks a book, Discord announcement + thread auto-created
- Discord notifications when books are added or reviews are left
- Member profiles with bio, display name, theme, and reading stats
- Admin panel to manage members, content, nominations, and stats
- 60+ genre and trope tags including smut subgenres
- Multiple color themes per member
- Dark purple aesthetic by default because of course

---

## Changelog

### v2.1 (May 2026)
- Added progress filter to library (reading, finished, DNF, want to read)
- Save button for reading progress page count (no longer auto-saves on every keystroke)
- Reviews now auto-refresh on the book card after saving without needing a page reload
- Book of the Month badge on book cards — gold banner showing which month it was picked
- Past books of the month keep their badge permanently
- Option to skip Discord announcement when setting a past Book of the Month
- Added 60+ genres and smut subgenres
- Added trigger warnings to books
- Discord bot notifications for new books and reviews
- Discord thread auto-created when Book of the Month is announced
- TBR Poll — admin selects nominated books and posts a Discord poll
- Nominations — members can nominate and vote on books
- Member profiles with bio, display name, and theme picker
- Fixed database connection (MySQL → PostgreSQL/Neon)
- Fixed Discord OAuth flow
- Fixed frontend routing on Vercel

### v2.0
- Initial release
- Discord OAuth login
- Library with book cards, covers, genres, ratings
- Reviews and reading progress tracking
- Admin dashboard with stats, member management
- Cloudinary image uploads
- Neon PostgreSQL database
- Deployed on Vercel (separate frontend + backend)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React, Vite, React Router |
| Backend | Node.js, Express |
| Database | Neon (PostgreSQL) |
| Auth | Discord OAuth2 + JWT |
| Image Storage | Cloudinary |
| Hosting | Vercel (two deployments — frontend + backend) |

---

## Project Structure

```
dbc/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── components/   # Navbar, BookCard, BookModal, UI primitives, TwPicker
│   │   ├── pages/        # Login, Library, Profile, Admin, LoginSuccess
│   │   ├── App.jsx       # Routing + auth context
│   │   ├── api.js        # All backend API calls
│   │   └── theme.js      # Color themes
│   └── vercel.json       # SPA routing + build config for Vercel
└── backend/           # Express API
    ├── db/
    │   ├── pool.js       # PostgreSQL connection
    │   └── schema.sql    # Database schema (run once in Neon)
    ├── middleware/
    │   └── auth.js       # JWT middleware
    ├── routes/           # auth, books, reviews, progress, members, admin, uploads, nominations
    ├── discord.js        # Discord webhook + bot notifications
    ├── server.js         # Entry point
    └── vercel.json       # Vercel serverless config
```

---

## First Time Setup

Everything is free. No credit card needed for any of these services.

### Step 1 — Neon (Database)

1. Go to [neon.tech](https://neon.tech) and sign up with GitHub
2. Create a project, name it `dirty-book-club`, pick the region closest to you
3. In the left sidebar click **SQL Editor**
4. Paste the entire contents of `backend/db/schema.sql` and click **Run**
5. Also run this to add the Book of the Month column:
   ```sql
   ALTER TABLE books ADD COLUMN IF NOT EXISTS botm_month VARCHAR(30) DEFAULT NULL;
   ```
6. Go to **Dashboard → Connection Details** → click **Show password** → copy the full **Connection string** — save it for later

### Step 2 — Cloudinary (Image Storage)

1. Go to [cloudinary.com](https://cloudinary.com) and sign up free
2. From the dashboard copy and save these three things:
   - **Cloud name**
   - **API Key**
   - **API Secret**

### Step 3 — Discord App

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application** → name it `Dirty Book Club`
2. Upload an app icon under **General Information**
3. Left sidebar → **OAuth2** → Add Redirect:
   ```
   https://your-backend.vercel.app/auth/discord/callback
   ```
   (use a placeholder for now, you'll update it after deploying)
4. Copy and save your **Client ID** and **Client Secret**
5. Left sidebar → **Bot** → **Add Bot** → copy the **Bot Token**
6. Under **Privileged Gateway Intents** turn on all three toggles → Save
7. Go to **OAuth2 → URL Generator** → check `bot` → check `Send Messages` and `Create Public Threads` → copy the URL → open it to add the bot to your server

### Step 4 — Discord Webhooks

1. In your Discord server, go to your announcements channel → **Edit Channel → Integrations → Webhooks → New Webhook** → copy the URL
2. Do the same for your book discussions channel
3. Save both webhook URLs for later

### Step 5 — GitHub

1. Install [Git](https://git-scm.com/download/win) if you don't have it
2. Install [Node.js](https://nodejs.org) (LTS version) if you don't have it
3. Go to [github.com](https://github.com) → New repository → name it `dirty-book-club` → Create
4. Open a terminal inside the `dbc` folder and run:
   ```bash
   git config --global user.email "you@example.com"
   git config --global user.name "Your Name"
   git init
   git add .
   git commit -m "Dirty Book Club v2"
   git remote add origin https://github.com/YOURNAME/dirty-book-club.git
   git push origin master
   ```
   > Replace `YOURNAME` with your GitHub username. If asked for a password, use a Personal Access Token from GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic) → check `repo` scope.

### Step 6 — Vercel Backend

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **Add New Project** → import your `dirty-book-club` repo
3. Set **Root Directory** to `backend`
4. Set **Framework Preset** to **Node**
5. Add these environment variables:

| Name | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | Any 64-character random string from [randomkeygen.com](https://randomkeygen.com) |
| `DISCORD_CLIENT_ID` | From Discord |
| `DISCORD_CLIENT_SECRET` | From Discord |
| `DISCORD_REDIRECT_URI` | `https://your-backend.vercel.app/auth/discord/callback` (placeholder for now) |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary |
| `CLOUDINARY_API_KEY` | From Cloudinary |
| `CLOUDINARY_API_SECRET` | From Cloudinary |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` (placeholder for now) |
| `API_URL` | `https://your-backend.vercel.app` (placeholder for now) |
| `DISCORD_WEBHOOK_ANNOUNCEMENTS` | Webhook URL from your announcements channel |
| `DISCORD_WEBHOOK_BOTM` | Webhook URL from your book discussions channel |
| `DISCORD_BOT_TOKEN` | Your Discord bot token |

6. Click **Deploy** — copy the URL Vercel gives you

### Step 7 — Vercel Frontend

1. Click **Add New Project** again → import the same `dirty-book-club` repo
2. Set **Root Directory** to `frontend`
3. Set **Framework Preset** to **Vite**
4. Add this environment variable:

| Name | Value |
|---|---|
| `VITE_API_URL` | Your backend Vercel URL from Step 6 (no trailing slash) |

5. Click **Deploy** — copy the URL Vercel gives you

### Step 8 — Update URLs Everywhere

Now that you have your real URLs, update them in three places:

**Discord Developer Portal** → your app → OAuth2 → update redirect to:
```
https://YOUR-BACKEND-URL.vercel.app/auth/discord/callback
```

**Backend Vercel** → Settings → Environment Variables → update:
- `DISCORD_REDIRECT_URI` → `https://YOUR-BACKEND-URL.vercel.app/auth/discord/callback`
- `FRONTEND_URL` → `https://YOUR-FRONTEND-URL.vercel.app`
- `API_URL` → `https://YOUR-BACKEND-URL.vercel.app`

Then redeploy the backend (Deployments → three dots → Redeploy).

### Step 9 — Make Yourself Admin

1. Open your app and click **Login with Discord** — this creates your account
2. Get your Discord ID: Discord → **Settings → Advanced → Developer Mode ON** → right-click your own name anywhere → **Copy User ID**
3. Go to Neon → **SQL Editor** and run:
   ```sql
   UPDATE members SET is_admin = TRUE WHERE discord_id = 'YOUR_DISCORD_ID';
   ```
4. Refresh the app — you now have admin access

---

## Environment Variables

### Backend (Vercel)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Random 64-character string |
| `DISCORD_CLIENT_ID` | From Discord Developer Portal |
| `DISCORD_CLIENT_SECRET` | From Discord Developer Portal |
| `DISCORD_REDIRECT_URI` | `https://your-backend.vercel.app/auth/discord/callback` |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | From Cloudinary dashboard |
| `FRONTEND_URL` | Your frontend Vercel URL (no trailing slash) |
| `API_URL` | Your backend Vercel URL (no trailing slash) |
| `DISCORD_WEBHOOK_ANNOUNCEMENTS` | Webhook for book/review notifications |
| `DISCORD_WEBHOOK_BOTM` | Webhook for Book of the Month announcements |
| `DISCORD_BOT_TOKEN` | Bot token for creating threads |

### Frontend (Vercel)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Your backend Vercel URL (no trailing slash) |

---

## Making Someone Admin

1. They log in with Discord first (creates their account)
2. Get their Discord ID: Discord → Settings → Advanced → Developer Mode ON → right-click their name → Copy User ID
3. Run in Neon SQL Editor:
   ```sql
   UPDATE members SET is_admin = TRUE WHERE discord_id = 'THEIR_DISCORD_ID';
   ```

---

## Book of the Month

1. Go to Admin panel → **Book of the Month** tab
2. Enter the month (e.g. `June 2026`)
3. Select the book from the dropdown
4. Check or uncheck **Post announcement to Discord** (uncheck for past books)
5. Click **Announce & Create Thread** or **Save Book of the Month**

The selected book will get a permanent gold 🔥 banner on its card in the library showing which month it was picked.

---

## Nominations & TBR Poll

Members can nominate books from the library for future reads and vote on other nominations. Admins can then:

1. Go to Admin panel → **Nominations** tab
2. Select 2–10 nominated books for the poll
3. Set poll duration (24, 48, or 72 hours)
4. Click **Post Poll to Discord** — a native Discord poll is posted to your announcements channel

---

## Trigger Warnings

When adding or editing a book, admins and members can tag trigger warnings including: Dubious Consent, Non-Con, SA, Dark Themes, Violence, Gore, Abuse, Self Harm, Suicide, Eating Disorder, Addiction, Trauma/PTSD, Grief, Death of Loved One, Pregnancy Loss, Cheating, Kidnapping, Stalking, Manipulation, Gaslighting, Torture, Cliffhanger, Open Ending.

---

## Member Profiles

Each member has a profile page showing their reading stats, reviews, and progress. Members can edit their display name, bio, and choose a color theme.

---

## Adding or Editing Genres

Genres are defined in `frontend/src/components/ui.jsx` in the `GENRES` array and `GENRE_COLORS` object. Add a new genre to the array and give it a hex color in the colors object, then push.

---

## Deploying Updates

Every update is just three commands from inside the `dbc` folder:

```bash
git add .
git commit -m "describe what you changed"
git push origin master
```

Vercel auto-deploys both the frontend and backend on every push. Takes about 1-2 minutes.