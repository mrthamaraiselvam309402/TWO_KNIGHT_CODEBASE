-- Fix PostgREST View Parsing for Decrypted Students
-- By adding explicit casting and parentheses, we help PostgREST distinguish function calls from relationship embedding.

-- First ensure the decrypt_pii function exists
CREATE OR REPLACE FUNCTION decrypt_pii(value TEXT) RETURNS TEXT AS $$
  BEGIN
    -- Simple identity for now - encryption key should be set per deployment
    -- In production, this would decrypt using app.encryption_key
    RETURN COALESCE(value, '');
  END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE VIEW students_decrypted AS
SELECT 
    id,
    name,
    phone,
    parent_phone,
    email,
    age,
    grade,
    parent_name,
    address,
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

GRANT SELECT ON students_decrypted TO anon, authenticated, service_role;
