-- v6 Migration — run in Neon SQL Editor BEFORE (or right after) deploying 3.7.0
-- Remembers which cron runs already happened so a retry or a repeated call can't post twice.
-- Safe to run more than once. Until it's run, the cron endpoints still work — they just
-- don't have duplicate protection.

CREATE TABLE IF NOT EXISTS cron_runs (
  job     TEXT        NOT NULL,
  run_key TEXT        NOT NULL,
  ran_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (job, run_key)
);
