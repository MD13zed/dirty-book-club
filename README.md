# 🔥 Dirty Book Club v2 — Vercel Edition

Fully free, no credit card needed, no expiry.

| Service | What it does | Free limit |
|---|---|---|
| **Vercel** | Hosts frontend + backend | Unlimited hobby projects |
| **Neon** | PostgreSQL database | 0.5GB, never pauses |
| **Cloudinary** | Book cover image storage | 25GB, 25GB bandwidth/month |
| **Discord** | OAuth login | Free |

---

## Quick deploy (30 min total)

### 1. Neon — free database
1. Go to **neon.tech** → Sign up (GitHub login works)
2. Create a project → name it `dirty-book-club`
3. Go to **SQL Editor** → paste the entire contents of `backend/db/schema.sql` → Run
4. Go to **Dashboard** → **Connection Details** → copy the **Connection string** (looks like `postgresql://...`)

### 2. Cloudinary — free image hosting
1. Go to **cloudinary.com** → Sign up free
2. From the Dashboard copy: **Cloud name**, **API Key**, **API Secret**

### 3. Discord — OAuth app
1. Go to **discord.com/developers/applications** → New Application
2. Left sidebar → **OAuth2** → Add Redirect:
   `https://YOUR-APP-NAME.vercel.app/auth/discord/callback`
   (Use a placeholder for now — you'll update it after Vercel deploy)
3. Copy **Client ID** and **Client Secret**

### 4. GitHub — push the code
```bash
git init
git add .
git commit -m "Dirty Book Club v2"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOURNAME/dirty-book-club.git
git push -u origin main
```

### 5. Vercel — deploy
1. Go to **vercel.com** → Sign up with GitHub (free)
2. Click **Add New Project** → import your `dirty-book-club` repo
3. Vercel auto-detects the config. Before clicking Deploy, click **Environment Variables** and add ALL of these:

| Key | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | Any long random string (64+ chars) |
| `DISCORD_CLIENT_ID` | From Discord developer portal |
| `DISCORD_CLIENT_SECRET` | From Discord developer portal |
| `DISCORD_REDIRECT_URI` | `https://YOUR-APP.vercel.app/auth/discord/callback` |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | From Cloudinary dashboard |
| `FRONTEND_URL` | `https://YOUR-APP.vercel.app` |
| `API_URL` | `https://YOUR-APP.vercel.app` |

4. Click **Deploy** — takes ~2 minutes

### 6. Update Discord redirect URI
After deploy you know your real Vercel URL. Go back to Discord developer portal → OAuth2 → update the redirect URI to match exactly.

### 7. Make yourself admin
1. Open your app, click **Login with Discord** — this creates your account
2. Go to Neon → **SQL Editor**, run:
```sql
UPDATE members SET is_admin = TRUE WHERE discord_id = 'YOUR_DISCORD_USER_ID';
```
*(Get your Discord ID: Discord → Settings → Advanced → Developer Mode ON → right-click your name → Copy User ID)*

---

## Updating the app later
Just push to GitHub — Vercel auto-deploys every push to `main`.

```bash
git add .
git commit -m "Update"
git push
```

## Local development
```bash
# Terminal 1 — backend
cp backend/.env.example backend/.env  # fill in your values
npm install
node backend/server.js

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```
