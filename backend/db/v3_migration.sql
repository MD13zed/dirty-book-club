-- v3 Migration — run in Neon SQL Editor

-- Books: add total_pages
ALTER TABLE books ADD COLUMN IF NOT EXISTS total_pages INT DEFAULT NULL;

-- Reading progress: add dnf_reason
ALTER TABLE reading_progress ADD COLUMN IF NOT EXISTS dnf_reason TEXT DEFAULT NULL;

-- Trigger warnings per book
CREATE TABLE IF NOT EXISTS book_tw (
  book_id UUID        NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag     VARCHAR(100) NOT NULL,
  PRIMARY KEY (book_id, tag)
);

-- Nominations
CREATE TABLE IF NOT EXISTS nominations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id      UUID        NOT NULL UNIQUE REFERENCES books(id) ON DELETE CASCADE,
  nominated_by UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  nominated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Nomination votes (one per member per nomination)
CREATE TABLE IF NOT EXISTS nomination_votes (
  nomination_id UUID NOT NULL REFERENCES nominations(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  voted_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (nomination_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_nom_votes ON nomination_votes(nomination_id);
CREATE INDEX IF NOT EXISTS idx_book_tw   ON book_tw(book_id);
