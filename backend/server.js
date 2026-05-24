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

app.use("/api", rateLimit({ windowMs: 15*60*1000, max: 300, standardHeaders: true, legacyHeaders: false }));

app.use("/auth",              require("./routes/auth"));
app.use("/api/books",         require("./routes/books"));
app.use("/api/reviews",       require("./routes/reviews"));
app.use("/api/progress",      require("./routes/progress"));
app.use("/api/members",       require("./routes/members"));
app.use("/api/admin",         require("./routes/admin"));
app.use("/api/uploads",       require("./routes/uploads"));
app.use("/api/nominations",   require("./routes/nominations"));

app.get("/health", (req, res) => res.json({ ok: true, ts: new Date() }));
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message }); });

if (require.main === module) {
  const PORT = parseInt(process.env.PORT || "3001");
  app.listen(PORT, () => console.log(`🔥 Running on http://localhost:${PORT}`));
}

module.exports = app;
