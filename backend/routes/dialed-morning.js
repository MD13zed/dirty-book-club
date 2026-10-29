const express = require("express");
const router  = express.Router();
const cronAuth = require("../middleware/cronAuth");
const cronOnce = require("../middleware/cronOnce");

const { postMorningReminder, getDialedDate } = require("../dialed");


// ── Route — called by cron-job.org, once every morning ─────────────────────
router.get("/", cronAuth, cronOnce("dialed-morning", getDialedDate), async (req, res) => {
  try {
    const result = await postMorningReminder();
    res.json(result);
  } catch (e) {
    console.error("Dialed morning post error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
