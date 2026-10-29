const express = require("express");
const router  = express.Router();
const cronAuth = require("../middleware/cronAuth");
const cronOnce = require("../middleware/cronOnce");

const { postEveningLeaderboard, getDialedDate } = require("../dialed");


// ── Route — called by cron-job.org, once every evening ─────────────────────
router.get("/", cronAuth, cronOnce("dialed-evening", getDialedDate), async (req, res) => {
  try {
    const result = await postEveningLeaderboard();
    res.json(result);
  } catch (e) {
    console.error("Dialed evening post error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
