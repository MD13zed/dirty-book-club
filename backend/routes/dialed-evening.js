const express = require("express");
const router  = express.Router();
const { postEveningLeaderboard } = require("../dialed");

const CRON_SECRET = process.env.CRON_SECRET || "";

// ── Route — called by cron-job.org, once every evening ─────────────────────
router.get("/", async (req, res) => {
  const auth = req.headers["authorization"] || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await postEveningLeaderboard();
    res.json(result);
  } catch (e) {
    console.error("Dialed evening post error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
