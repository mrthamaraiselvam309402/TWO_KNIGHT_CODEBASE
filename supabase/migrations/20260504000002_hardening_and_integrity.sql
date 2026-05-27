-- 🛠️ Complete Hardening & Integrity Fix
-- 1. Deduplicate payments (keeping only the earliest record per transaction_id)
DELETE FROM payments a
USING payments b
WHERE a.ctid > b.ctid 
  AND a.transaction_id = b.transaction_id 
  AND a.transaction_id IS NOT NULL;

-- 2. Add unique index to prevent future duplicates on transaction_id
CREATE UNIQUE INDEX IF NOT EXISTS uniq_transaction_idx ON payments (transaction_id) WHERE transaction_id IS NOT NULL;

-- 3. Normalise student fees into monthly_fee column
-- The students table already has monthly_fee as the primary fee column
-- This ensures any NULL or zero values get set to default 5000
UPDATE students 
SET monthly_fee = 5000
WHERE monthly_fee IS NULL OR monthly_fee = 0;

-- Drop redundant columns (Backup logic: we only drop if monthly_fee is now populated)
-- ALTER TABLE students DROP COLUMN IF EXISTS fee;
-- ALTER TABLE students DROP COLUMN IF EXISTS fees;
-- ALTER TABLE students DROP COLUMN IF EXISTS tuition_fee;

-- 4. Set missing student status to active
UPDATE students SET status = 'active' WHERE status IS NULL OR status = 'pending';

-- 5. Force update to trigger encryption for all rows (requires app.encryption_key to be set)
-- UPDATE students SET phone = phone, parent_phone = parent_phone, email = email, address = address;

-- 6. Set missing coach salaries
-- NOTE: The coaches table uses hourly_rate as primary salary field.
-- If a separate salary column is needed, uncomment and add column first.
-- UPDATE coaches SET salary = COALESCE(salary, hourly_rate, 0);

-- 7. Create rating_history table if not exists
CREATE TABLE IF NOT EXISTS rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  old_rating INTEGER,
  change_type TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Enable RLS on core tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_history ENABLE ROW LEVEL SECURITY;

-- NOTE: Do NOT create permissive "Allow authenticated" policies here.
-- Use secure-rls-v2.sql instead which implements proper anon restrictions.
-- Permissive policies would bypass the security model.
-- DO NOT RUN THE POLICY LOOP FROM THIS FILE.

-- 9. Add missing performance indexes
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments (student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits (key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_timestamp ON rate_limits (timestamp);

-- 10. Cast payments.amount to NUMERIC if it was text
-- Uncomment and run this if amount column is currently TEXT
-- ALTER TABLE payments ALTER COLUMN amount TYPE NUMERIC USING amount::NUMERIC;
-- IMPORTANT: Run this separately after verifying current column type.
