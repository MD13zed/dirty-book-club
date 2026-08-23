-- v4 Migration — Dialed.gg daily scores — run in Neon SQL Editor

CREATE TABLE IF NOT EXISTS dialed_scores (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     UUID         NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  score         NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 50),
  play_date     DATE         NOT NULL DEFAULT CURRENT_DATE,
  submitted_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (member_id, play_date)
);
CREATE INDEX IF NOT EXISTS idx_dialed_scores_date ON dialed_scores(play_date);

-- Tracks the single live leaderboard message so it can be edited in place
CREATE TABLE IF NOT EXISTS dialed_leaderboard_state (
  id          SMALLINT PRIMARY KEY DEFAULT 1,
  channel_id  VARCHAR(64),
  message_id  VARCHAR(64),
  board_date  DATE,
  CONSTRAINT dialed_state_single_row CHECK (id = 1)
);
