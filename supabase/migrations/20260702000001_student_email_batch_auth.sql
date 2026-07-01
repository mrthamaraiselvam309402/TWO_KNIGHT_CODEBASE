-- Add batch_id column to students table for batch-based passwords
ALTER TABLE students ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT;

-- Create table for batch-based default passwords
CREATE TABLE IF NOT EXISTS batch_passwords (
    batch_id TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON batch_passwords TO service_role;
GRANT SELECT ON batch_passwords TO authenticated, anon;

-- Create function to verify student credentials (email + individual or batch password)
CREATE OR REPLACE FUNCTION verify_student_credentials(
    p_email TEXT,
    p_password TEXT
) RETURNS JSON AS $$
DECLARE
    v_student RECORD;
    v_is_valid BOOLEAN;
    v_batch_password TEXT;
BEGIN
    -- Match student by email
    SELECT id, name, email, password_hash, batch_id INTO v_student
    FROM students
    WHERE email = p_email
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object('valid', false, 'error', 'Student not found with this email');
    END IF;

    -- Check individual password first
    IF v_student.password_hash IS NOT NULL THEN
        v_is_valid := v_student.password_hash = extensions.crypt(p_password, v_student.password_hash);
        IF v_is_valid THEN
            RETURN json_build_object('valid', true, 'id', v_student.id, 'name', v_student.name);
        END IF;
    END IF;

    -- Check batch password as fallback
    IF v_student.batch_id IS NOT NULL THEN
        SELECT password INTO v_batch_password
        FROM batch_passwords
        WHERE batch_id = v_student.batch_id;
        
        IF v_batch_password IS NOT NULL THEN
            v_is_valid := v_batch_password = p_password;
            IF v_is_valid THEN
                RETURN json_build_object('valid', true, 'id', v_student.id, 'name', v_student.name);
            END IF;
        END IF;
    END IF;

    RETURN json_build_object('valid', false, 'error', 'Invalid password');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;