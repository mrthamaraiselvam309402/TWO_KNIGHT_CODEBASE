-- =====================================================
-- MASTER DATABASE INITIALIZATION & REPAIR
-- This script ensures all core academy tables exist and are properly mapped.
-- =====================================================

-- 1. COACHES TABLE
CREATE TABLE IF NOT EXISTS coaches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  specialization TEXT,
  experience INTEGER,
  rating INTEGER DEFAULT 0,
  bio TEXT,
  status TEXT DEFAULT 'active',
  hourly_rate INTEGER DEFAULT 0,
  availability TEXT,
  photo_url TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  parent_phone TEXT,
  email TEXT,
  age INTEGER,
  grade TEXT DEFAULT 'Beginner', -- Level
  parent_name TEXT,
  address TEXT,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pending',
  coach_id TEXT REFERENCES coaches(id) ON DELETE SET NULL,
  rating INTEGER DEFAULT 800,
  session_mode TEXT,
  session_time TEXT,
  monthly_fee INTEGER DEFAULT 5000,
  notes TEXT,
  account_status TEXT DEFAULT 'active',
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. PAYMENTS TABLE (History)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'paid',
  payment_method TEXT,
  transaction_id TEXT,
  description TEXT,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow all for easier admin access (Standard Academy pattern)
DO $$
BEGIN
    -- Coaches policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on coaches') THEN
        CREATE POLICY "Allow all on coaches" ON coaches FOR ALL USING (true);
    END IF;
    
    -- Students policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on students') THEN
        CREATE POLICY "Allow all on students" ON students FOR ALL USING (true);
    END IF;
    
    -- Payments policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on payments') THEN
        CREATE POLICY "Allow all on payments" ON payments FOR ALL USING (true);
    END IF;
END $$;

-- Ensure due_date exists (for cases where student table existed without it)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='due_date') THEN
        ALTER TABLE students ADD COLUMN due_date DATE;
    END IF;
END $$;

-- VERIFICATION
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name IN ('coaches', 'students', 'payments');
