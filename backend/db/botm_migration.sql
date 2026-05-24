-- Run once in Neon SQL Editor
-- Adds the Book of the Month column to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS botm_month VARCHAR(50) DEFAULT NULL;
