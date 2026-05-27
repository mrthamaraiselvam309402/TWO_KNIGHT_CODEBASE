-- 1. Create Payments Table for History
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'paid',
  payment_method TEXT,
  transaction_id TEXT,
  description TEXT,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Add Due Date to Students
ALTER TABLE students ADD COLUMN IF NOT EXISTS due_date DATE;

-- 3. Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on payments" ON payments FOR ALL USING (true);
