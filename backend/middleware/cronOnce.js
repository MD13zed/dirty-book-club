const pool = require("../db/pool");

// Stops a cron job from posting twice for the same period (a retry from cron-job.org after a
// slow response, someone opening the URL, etc.).
//
//   router.get("/", cronAuth, cronOnce("digest", () => clubToday()), handler)
//
// The first request for a (job, key) claims it and runs; later ones get {skipped} and post nothing.
// If the job then fails (HTTP error or {ok:false}) the claim is released so a retry can go through.
// Add ?force=1 to run again on purpose. If the cron_runs table doesn't exist yet
// (db/v6_migration.sql not run) the job simply runs without this protection.
function cronOnce(job, keyFn) {
  return async function (req, res, next) {
    if (req.query.force === "1") return next();

    const key = String(keyFn());
    try {
      const { rowCount } = await pool.query(
        "INSERT INTO cron_runs (job, run_key) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [job, key]
      );
      if (rowCount === 0) {
        console.log(`cron ${job} already ran for ${key} — skipping`);
        return res.json({ skipped: "already ran", job, key });
      }
    } catch (e) {
      console.error(`cron_runs unavailable — running ${job} without duplicate protection:`, e.message);
      return next();
    }

    const release = () =>
      pool.query("DELETE FROM cron_runs WHERE job=$1 AND run_key=$2", [job, key])
        .catch(e => console.error("Couldn't release cron claim:", e.message));

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const failed = res.statusCode >= 400 || body?.ok === false;
      if (!failed) return originalJson(body);
      release().finally(() => originalJson(body));   // free the claim first so a retry isn't blocked
      return res;
    };
    next();
  };
}

module.exports = cronOnce;
