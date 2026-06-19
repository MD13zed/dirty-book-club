require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
app.set("trust proxy", 1);

app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));

// Discord interactions — raw body BEFORE express.json()
app.use(
  "/discord/interactions",
  express.raw({ type: "application/json" }),
  require("./routes/interactions")
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", rateLimit({ windowMs: 15*60*1000, max: 300, standardHeaders: true, legacyHeaders: false, skip: (req) => req.originalUrl.includes("/booksearch/cover") }));
app.use("/auth", rateLimit({ windowMs: 15*60*1000, max: 20, standardHeaders: true, legacyHeaders: false }));

app.use("/auth",              require("./routes/auth"));
app.use("/api/books",         require("./routes/books"));
app.use("/api/reviews",       require("./routes/reviews"));
app.use("/api/progress",      require("./routes/progress"));
app.use("/api/members",       require("./routes/members"));
app.use("/api/admin",         require("./routes/admin"));
app.use("/api/uploads",       require("./routes/uploads"));
app.use("/api/booksearch",    require("./routes/booksearch"));
app.use("/api/nominations",   require("./routes/nominations"));
app.use("/api/reading-now",   require("./routes/reading-now"));
app.use("/api/digest",        require("./routes/digest"));
app.use("/api/yearend",       require("./routes/yearend"));

// Warm-up / liveness ping. DB-free on purpose: it keeps the Vercel function
// warm (which is what the prefill search needs) without waking Neon, so the
// DB can keep auto-suspending and preserve free-tier compute hours.
// Point a cron-job.org job at https://<backend>/api/health every ~5 min.
// `uptime` lets you see if a ping hit a warm instance (high) or cold (near 0).
app.get(["/health", "/api/health"], (req, res) =>
  res.json({ ok: true, ts: new Date(), uptime: Math.round(process.uptime()) })
);
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message }); });

if (require.main === module) {
  const PORT = parseInt(process.env.PORT || "3001");
  app.listen(PORT, () => console.log(`🔥 Running on http://localhost:${PORT}`));
}

module.exports = app;
