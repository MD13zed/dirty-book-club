// Discord ids that used to be written directly into the code. Each can be overridden with an
// environment variable; the defaults are your current server's values, so nothing changes
// until you decide to set them.

// The role pinged for Book of the Month, TBR polls, the weekly digest and the year-end post
const BOOK_CLUB_ROLE_ID = process.env.DISCORD_ROLE_BOOK_CLUB || "1445035924227493928";

// Channel for Book of the Month announcements and TBR polls
const BOTM_CHANNEL_ID = process.env.DISCORD_BOTM_CHANNEL_ID || "1369670347229761614";

// Role pings only happen from the real (production) deployment, so a Preview deployment or a
// local run that has the bot token can't ping the club by accident.
// Set DISCORD_ROLE_PINGS=off to silence them everywhere.
function rolePing() {
  if (process.env.DISCORD_ROLE_PINGS === "off") return "";
  const env = process.env.VERCEL_ENV;            // "production" | "preview" | "development" on Vercel; unset elsewhere
  if (env && env !== "production") return "";
  return `<@&${BOOK_CLUB_ROLE_ID}>`;
}

module.exports = { BOOK_CLUB_ROLE_ID, BOTM_CHANNEL_ID, rolePing };
