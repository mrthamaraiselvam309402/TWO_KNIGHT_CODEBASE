-- 🇺🇸 Add country_code to students table for international phone support
-- This enables storing the selected country for each student's phone number
-- Default: 'IN' (India) for existing records

-- 1. Add column with default
ALTER TABLE students ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'IN';

-- 2. Backfill existing null values to 'IN'
UPDATE students 
SET country_code = 'IN' 
WHERE country_code IS NULL;

-- 3. Update the decrypt view to include country_code
DROP VIEW IF EXISTS students_decrypted;
CREATE OR REPLACE VIEW students_decrypted AS
SELECT 
  id,
  name,
  decrypt_pii(phone) as phone,
  decrypt_pii(parent_phone) as parent_phone,
  decrypt_pii(email) as email,
  age,
  grade,
  parent_name,
  decrypt_pii(address) as address,
  country_code,
  enrollment_date,
  status,
  coach_id,
  rating,
  session_mode,
  session_time,
  monthly_fee,
  notes,
  account_status,
  due_date,
  created_at,
  updated_at
FROM students;

-- 4. Ensure country_code is included in API responses by updating transform function if needed
-- (Frontend will read country_code from the API response)
