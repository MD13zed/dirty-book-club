// Run this ONCE to register slash commands with Discord
// Usage: node register-commands.js
// Run from the backend/ directory with your .env filled in

require("dotenv").config();
const https = require("https");

const APP_ID  = process.env.DISCORD_CLIENT_ID;
const TOKEN   = process.env.DISCORD_BOT_TOKEN;
const GUILD   = process.env.DISCORD_GUILD_ID; // optional — set for instant registration

if (!APP_ID || !TOKEN) {
  console.error("❌ DISCORD_CLIENT_ID and DISCORD_BOT_TOKEN must be set in .env");
  process.exit(1);
}

const commands = [
  {
    name:        "shelf",
    description: "Show the 5 most recently added books 📚",
  },
  {
    name:        "botm",
    description: "Show the current Book of the Month 🏆",
  },
  {
    name:        "stats",
    description: "Show Spicy Shelf club statistics 📊",
  },
  {
    name:        "search",
    description: "Search for a book on the shelf 🔍",
    options: [{
      name:        "title",
      description: "Book title to search for",
      type:        3,
      required:    true,
    }],
  },
  {
    name:        "review",
    description: "Submit or update your review for a book ✍️",
    options: [
      { name: "title",  description: "Book title (partial match ok)", type: 3, required: true },
      { name: "rating", description: "Star rating (1–5)",            type: 4, required: true, min_value: 1, max_value: 5 },
      { name: "notes",  description: "Your thoughts (optional)",     type: 3, required: false },
    ],
  },
  {
    name:        "reading",
    description: "Update your reading progress for a book 📖",
    options: [
      { name: "title", description: "Book title (partial match ok)", type: 3, required: true },
      {
        name:        "status",
        description: "Your reading status",
        type:        3,
        required:    true,
        choices: [
          { name: "📚 Want to read",     value: "want_to_read" },
          { name: "📖 Currently reading", value: "reading"      },
          { name: "✅ Finished",          value: "finished"     },
          { name: "💀 Did not finish",    value: "dnf"          },
        ],
      },
      { name: "page", description: "Current page number", type: 4, required: false, min_value: 0 },
    ],
  },
  {
    name:        "myshelf",
    description: "See your reading list — finished, DNF, want to read 📖",
    options: [{
      name:        "status",
      description: "Filter by status (leave blank to see all)",
      type:        3,
      required:    false,
      choices: [
        { name: "📚 Want to read",      value: "want_to_read" },
        { name: "📖 Currently reading", value: "reading"      },
        { name: "✅ Finished",           value: "finished"     },
        { name: "💀 Did not finish",     value: "dnf"          },
      ],
    }],
  },
  {
    name:        "nominations",
    description: "See the current book nominations shortlist 🗳",
  },
  {
    name:        "leaderboard",
    description: "See who has read the most books and left the most reviews 🏅",
  },
  {
    name:        "getting-started",
    description: "A full guide to everything you can do on The Spicy Shelf 🔥",
  },
];

const path = GUILD
  ? `/api/v10/applications/${APP_ID}/guilds/${GUILD}/commands`
  : `/api/v10/applications/${APP_ID}/commands`;

const body = JSON.stringify(commands);

const reqOpts = {
  hostname: "discord.com",
  path,
  method:  "PUT",
  headers: {
    "Content-Type":   "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Authorization":  `Bot ${TOKEN}`,
  },
};

console.log(`Registering ${commands.length} commands ${GUILD ? `to guild ${GUILD}` : "globally"}...`);

const req = https.request(reqOpts, res => {
  let data = "";
  res.on("data", d => data += d);
  res.on("end", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const cmds = JSON.parse(data);
      console.log(`✓ Registered ${cmds.length} commands:`);
      cmds.forEach(c => console.log(`  /${c.name} — ${c.description}`));
      if (!GUILD) console.log("\n⚠  Global commands take up to 1 hour to appear. Set DISCORD_GUILD_ID for instant.");
    } else {
      console.error("❌ Failed:", res.statusCode, data);
    }
  });
});

req.on("error", e => console.error("Request error:", e.message));
req.write(body);
req.end();
