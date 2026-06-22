-- SQL Migration for Productivity Sync & Tournament Discovery Engine
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/vseombfkrvpffnpgbsnk/sql

-- 1. Create Productivity Tasks table (For both admin and student goals)
CREATE TABLE IF NOT EXISTS public.productivity_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT, -- references students.id; NULL for admin/general tasks
  text TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for lookup optimization
CREATE INDEX IF NOT EXISTS idx_productivity_tasks_student ON public.productivity_tasks(student_id);

-- 2. Create Scheduled Meetings table
CREATE TABLE IF NOT EXISTS public.scheduled_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'gmeet', -- 'gmeet', 'zoom'
  time TIMESTAMP WITH TIME ZONE NOT NULL,
  link TEXT NOT NULL,
  attendee TEXT, -- 'general', 'student_{id}', 'coach_{id}'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for lookup optimization
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_attendee ON public.scheduled_meetings(attendee);

-- 3. Create Productivity Notes table (notepad)
CREATE TABLE IF NOT EXISTS public.productivity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT UNIQUE, -- NULL for admin notes, unique student ID for student notes
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Create Tournaments table for Discovery Engine
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  organizer TEXT,
  location TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  start_date DATE NOT NULL,
  end_date DATE,
  entry_fee NUMERIC(10,2) DEFAULT 0.00,
  tournament_type TEXT DEFAULT 'Swiss', -- 'Swiss', 'Arena', 'Rapid', 'Blitz'
  rating_required TEXT DEFAULT 'Open', -- 'U1200', 'U1600', 'Open'
  elo_limit INTEGER DEFAULT 9999,
  registration_url TEXT,
  source TEXT, -- 'FIDE', 'AICF', 'Chess.com', 'Lichess', 'Eventbrite', 'Meetup'
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.productivity_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productivity_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Allow all actions for client sync
DROP POLICY IF EXISTS "Allow all on productivity_tasks" ON public.productivity_tasks;
CREATE POLICY "Allow all on productivity_tasks" ON public.productivity_tasks FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on scheduled_meetings" ON public.scheduled_meetings;
CREATE POLICY "Allow all on scheduled_meetings" ON public.scheduled_meetings FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on productivity_notes" ON public.productivity_notes;
CREATE POLICY "Allow all on productivity_notes" ON public.productivity_notes FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on tournaments_discovery" ON public.tournaments;
CREATE POLICY "Allow all on tournaments_discovery" ON public.tournaments FOR ALL USING (true);

-- No seed data for Tournaments
