const router  = require("express").Router();
const axios   = require("axios");
const jwt     = require("jsonwebtoken");
const pool    = require("../db/pool");

const DISCORD_API = "https://discord.com/api/v10";

router.get("/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id:     process.env.DISCORD_CLIENT_ID,
    redirect_uri:  process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope:         "identify",
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

router.get("/discord/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);

  try {
    const tokenRes = await axios.post(
      `${DISCORD_API}/oauth2/token`,
      new URLSearchParams({
        client_id:     process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type:    "authorization_code",
        code,
        redirect_uri:  process.env.DISCORD_REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });
    const { id: discordId, username, global_name, avatar } = userRes.data;

    const displayName = global_name || username;
    const avatarUrl   = avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${Number(discordId) % 5}.png`;

    await pool.query(
      `INSERT INTO members (discord_id, username, display_name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (discord_id) DO UPDATE SET
         username     = EXCLUDED.username,
         display_name = EXCLUDED.display_name,
         avatar_url   = EXCLUDED.avatar_url,
         last_seen    = CURRENT_TIMESTAMP`,
      [discordId, username, displayName, avatarUrl]
    );

    const { rows } = await pool.query(
      "SELECT id, is_admin, theme FROM members WHERE discord_id = $1",
      [discordId]
    );
    const member = rows[0];

    const token = jwt.sign(
      { id: member.id, discordId, username: displayName, is_admin: member.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.redirect(`${process.env.FRONTEND_URL}/login-success?token=${token}`);
  } catch (err) {
    console.error("Discord OAuth error:", err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}?error=oauth_failed`);
  }
});

router.get("/me", require("../middleware/auth").auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, discord_id, username, display_name, avatar_url, bio, is_admin, theme, joined_at
     FROM members WHERE id = $1`,
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

module.exports = router;
