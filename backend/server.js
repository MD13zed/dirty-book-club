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
// The cover proxy is public (<img> tags can't send a login) and skips the general limiter,
// so it gets its own: a page full of covers is fine, a hammering script is not.
app.use("/api/booksearch/cover", rateLimit({ windowMs: 60*1000, max: 240, standardHeaders: true, legacyHeaders: false }));
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
app.use("/api/dialed-morning", require("./routes/dialed-morning"));
app.use("/api/dialed-evening", require("./routes/dialed-evening"));

// Warm-up / liveness ping. DB-free on purpose: it keeps the Vercel function
// warm (which is what the prefill search needs) without waking Neon, so the
// DB can keep auto-suspending and preserve free-tier compute hours.
// Point a cron-job.org job at https://<backend>/api/health every ~5 min.
// `uptime` lets you see if a ping hit a warm instance (high) or cold (near 0).
app.get(["/health", "/api/health"], (req, res) =>
  res.json({ ok: true, ts: new Date(), uptime: Math.round(process.uptime()) })
);
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => {
  // Known "client did something wrong" errors get a real message; everything else is a generic 500
  if (err.type === "entity.parse.failed")  return res.status(400).json({ error: "Invalid JSON" });
  if (err.type === "entity.too.large")     return res.status(413).json({ error: "Request is too large" });
  if (err.name === "MulterError")          return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Image is too large (max 4 MB)" : "Upload failed" });
  if (err.message === "Images only")       return res.status(400).json({ error: "Images only" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong — please try again." });
});

if (require.main === module) {
  const PORT = parseInt(process.env.PORT || "3001");
  app.listen(PORT, () => console.log(`🔥 Running on http://localhost:${PORT}`));
}

module.exports = app;
