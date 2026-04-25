-- SQL to fix missing tables and schema mismatches
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/vseombfkrvpffnpgbsnk/sql

-- 1. Create Rating History Table (Correcting student_id type to TEXT to match students table)
CREATE TABLE IF NOT EXISTS rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  change_type TEXT DEFAULT 'manual', -- 'manual', 'tournament', 'lesson'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for history tracking
CREATE INDEX IF NOT EXISTS idx_rating_history_student ON rating_history(student_id, recorded_at);

-- 2. Create Resources Library Table (Correcting created_by type to TEXT to match coaches table)
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('pgn', 'pdf', 'youtube', 'link')),
  url TEXT NOT NULL,
  level_requirement TEXT DEFAULT 'Beginner',
  created_by TEXT REFERENCES coaches(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create Tournament Management Table
CREATE TABLE IF NOT EXISTS internal_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
  type TEXT DEFAULT 'Swiss',
  results JSONB
);

-- Enable RLS for all new tables
ALTER TABLE rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_tournaments ENABLE ROW LEVEL SECURITY;

-- Allow all (matches existing academy pattern)
DROP POLICY IF EXISTS "Allow all on rating_history" ON rating_history;
CREATE POLICY "Allow all on rating_history" ON rating_history FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on resources" ON resources;
CREATE POLICY "Allow all on resources" ON resources FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on tournaments" ON internal_tournaments;
CREATE POLICY "Allow all on tournaments" ON internal_tournaments FOR ALL USING (true);
