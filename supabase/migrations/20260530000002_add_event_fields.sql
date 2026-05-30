-- Migration to add event fee, prize, map_url, and img_url columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS fee INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS prize TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS prize_pool TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS map_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS img_url TEXT;
