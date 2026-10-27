const crypto = require("crypto");

// Protects the cron-job.org endpoints. Fails CLOSED: if CRON_SECRET isn't
// configured the endpoints refuse every request instead of being public.
function cronAuth(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing cron request");
    return res.status(503).json({ error: "Cron endpoint not configured" });
  }
  const given    = Buffer.from(req.headers["authorization"] || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

module.exports = cronAuth;
