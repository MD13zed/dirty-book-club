-- Dirty Book Club — PostgreSQL Schema (Neon)
-- Run once in the Neon SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Members
CREATE TABLE IF NOT EXISTS members (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id    VARCHAR(64)  UNIQUE NOT NULL,
  username      VARCHAR(100) NOT NULL,
  display_name  VARCHAR(100),
  avatar_url    VARCHAR(500),
  bio           TEXT,
  is_admin      BOOLEAN      DEFAULT FALSE,
  theme         VARCHAR(30)  DEFAULT 'dark-purple',
  joined_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  last_seen     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- Books
CREATE TABLE IF NOT EXISTS books (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title      VARCHAR(500) NOT NULL,
  author     VARCHAR(300) DEFAULT '',
  series     VARCHAR(300) DEFAULT '',
  cover_url  VARCHAR(500) DEFAULT '',
  date_read  DATE,
  added_by   UUID         REFERENCES members(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- Book genres (up to 3 per book)
CREATE TABLE IF NOT EXISTS book_genres (
  book_id UUID         NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  genre   VARCHAR(100) NOT NULL,
  PRIMARY KEY (book_id, genre)
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id    UUID        NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  member_id  UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  rating     SMALLINT    DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  notes      TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (book_id, member_id)
);

-- Reading progress
CREATE TABLE IF NOT EXISTS reading_progress (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id      UUID        NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  member_id    UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status       VARCHAR(20) DEFAULT 'want_to_read'
                 CHECK (status IN ('want_to_read','reading','finished','dnf')),
  total_pages  INT         DEFAULT NULL,
  current_page INT         DEFAULT 0,
  started_at   DATE        DEFAULT NULL,
  finished_at  DATE        DEFAULT NULL,
  updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (book_id, member_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_books_added_at  ON books(added_at DESC);
CREATE INDEX IF NOT EXISTS idx_books_date_read ON books(date_read DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_book    ON reviews(book_id);
CREATE INDEX IF NOT EXISTS idx_progress_member ON reading_progress(member_id);
