-- v5 Migration — run in Neon SQL Editor BEFORE deploying 3.6.8
-- Remembers when a review was first written (updated_at changes on every edit),
-- so the year-end digest counts reviews by when they were written.
-- Existing reviews are backfilled with their updated_at, so past numbers don't change.

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
UPDATE reviews SET created_at = updated_at WHERE created_at IS NULL;
ALTER TABLE reviews ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
