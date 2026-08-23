const express = require("express");
const router  = express.Router();
const { postMorningLeaderboard } = require("../dialed");

const CRON_SECRET = process.env.CRON_SECRET || "";

// ── Route — called by cron-job.org, once every morning ─────────────────────
router.get("/", async (req, res) => {
  const auth = req.headers["authorization"] || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await postMorningLeaderboard();
    res.json(result);
  } catch (e) {
    console.error("Dialed morning post error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
