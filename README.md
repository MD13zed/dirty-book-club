# 🔥 Dirty Book Club

A private, invite-only book tracking app for your spicy reading group. Built with React + Vite on the frontend and Node/Express on the backend, with Discord OAuth for authentication.

---

## What It Does

- Login with Discord — no passwords, no accounts to manage
- Track books your club has read with covers, genres, and dates
- Rate and review books privately within your group
- Track reading progress per member
- Admin panel to manage members and content
- 60+ genre and trope tags including smut subgenres
- Dark purple aesthetic because of course

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
│   │   ├── components/   # Navbar, BookCard, BookModal, UI primitives
│   │   ├── pages/        # Login, Library, Profile, Admin, LoginSuccess
│   │   ├── App.jsx       # Routing + auth context
│   │   ├── api.js        # All backend API calls
│   │   └── theme.js      # Color themes
│   └── vercel.json       # SPA routing fix for Vercel
└── backend/           # Express API
    ├── db/
    │   ├── pool.js       # PostgreSQL connection
    │   └── schema.sql    # Database schema (run once in Neon)
    ├── middleware/
    │   └── auth.js       # JWT middleware
    ├── routes/           # auth, books, reviews, progress, members, admin, uploads
    ├── server.js         # Entry point
    └── vercel.json       # Vercel serverless config
```

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
| `FRONTEND_URL` | Your frontend Vercel URL |
| `API_URL` | Your backend Vercel URL |

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

## Adding or Editing Genres

Genres are defined in `frontend/src/components/ui.jsx` in the `GENRES` array and `GENRE_COLORS` object. Add a new genre to the array and give it a hex color in the colors object, then push.

---

## Deploying Updates

Every update is just three commands from inside the `dbc` folder:

```bash
git add .
git commit -m "describe what you changed"
git push origin main
```

Vercel auto-deploys both the frontend and backend on every push. Takes about 1-2 minutes.

---

## First Time Setup

See the full setup guide for step-by-step instructions covering Neon, Cloudinary, Discord OAuth, GitHub, and Vercel deployment.
