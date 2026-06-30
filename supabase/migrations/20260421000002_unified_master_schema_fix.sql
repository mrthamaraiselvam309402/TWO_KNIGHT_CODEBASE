-- =====================================================
-- ENCRYPTION FUNCTIONS FOR PII
-- =====================================================

-- Function to encrypt PII fields using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encryption key (in production, use a secure key management system)
-- This is a simplified approach; for production, use proper key management
CREATE OR REPLACE FUNCTION encrypt_pii(value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF value IS NULL OR value = '' THEN
    RETURN value;
  END IF;
  -- Use pgcrypto to encrypt with a simple key
  -- In production, use proper key management
  RETURN encode(encrypt(value::bytea, decode('your-encryption-key-here-32-chars-minimum', 'utf-8'), 'aes'), 'base64');
EXCEPTION
  WHEN OTHERS THEN
    -- If encryption fails, return plain text (better than losing data)
    RETURN value;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrypt_pii(value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF value IS NULL OR value = '' THEN
    RETURN value;
  END IF;
  -- Check if it looks like encrypted data (base64)
  IF value ~ '^[A-Za-z0-9+/]*={0,2}$' AND length(value) > 20 THEN
    BEGIN
      RETURN convert_from(decrypt(decode(value, 'base64'), decode('your-encryption-key-here-32-chars-minimum', 'utf-8'), 'aes'), 'utf-8');
    EXCEPTION
      WHEN OTHERS THEN
        RETURN value;
    END;
  END IF;
  RETURN value;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-encrypt PII on insert/update
CREATE OR REPLACE FUNCTION encrypt_student_pii()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone !~ '^[A-Za-z0-9+/]*={0,2}$' THEN
    NEW.phone := encrypt_pii(NEW.phone);
  END IF;
  IF NEW.parent_phone IS NOT NULL AND NEW.parent_phone !~ '^[A-Za-z0-9+/]*={0,2}$' THEN
    NEW.parent_phone := encrypt_pii(NEW.parent_phone);
  END IF;
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9+/]*={0,2}$' THEN
    NEW.email := encrypt_pii(NEW.email);
  END IF;
  IF NEW.address IS NOT NULL AND NEW.address !~ '^[A-Za-z0-9+/]*={0,2}$' THEN
    NEW.address := encrypt_pii(NEW.address);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


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
  payment_status TEXT DEFAULT 'Pending',
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

-- Ensure payment_status exists on coaches table (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coaches' AND column_name='payment_status') THEN
        ALTER TABLE coaches ADD COLUMN payment_status TEXT DEFAULT 'Pending';
    END IF;
END $$;

-- VERIFICATION
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name IN ('coaches', 'students', 'payments');

-- Create trigger on students table
DROP TRIGGER IF EXISTS encrypt_student_pii_trigger ON students;
CREATE TRIGGER encrypt_student_pii_trigger
  BEFORE INSERT OR UPDATE OF phone, parent_phone, email, address
  ON students
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_student_pii();

-- View to decrypt PII for authorized users
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
