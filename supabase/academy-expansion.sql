-- Academy Expansion Tables

-- 1. Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for faster filtering by student and date
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);

-- 2. Rating History Table
CREATE TABLE IF NOT EXISTS rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  change_type TEXT DEFAULT 'manual', -- 'manual', 'tournament', 'lesson'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for history tracking
CREATE INDEX IF NOT EXISTS idx_rating_history_student ON rating_history(student_id, recorded_at);

-- 3. Resources Library Table
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('pgn', 'pdf', 'youtube', 'link')),
  url TEXT NOT NULL,
  level_requirement TEXT DEFAULT 'Beginner', -- To restrict high-level puzzles to advanced students
  created_by UUID REFERENCES coaches(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Tournament Management Table
CREATE TABLE IF NOT EXISTS internal_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
  type TEXT DEFAULT 'Swiss',
  results JSONB -- Stores pairings and scores
);

-- Enable RLS for all new tables
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_tournaments ENABLE ROW LEVEL SECURITY;

-- Allow all for now (simulating current open access pattern)
CREATE POLICY "Allow all on attendance" ON attendance FOR ALL USING (true);
CREATE POLICY "Allow all on rating_history" ON rating_history FOR ALL USING (true);
CREATE POLICY "Allow all on resources" ON resources FOR ALL USING (true);
CREATE POLICY "Allow all on tournaments" ON internal_tournaments FOR ALL USING (true);
