-- Enable pgcrypto for secure password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Add password_hash to coaches
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coaches' AND column_name='password_hash') THEN
        ALTER TABLE coaches ADD COLUMN password_hash TEXT;
    END IF;
END $$;

-- Set default password for existing coaches to their phone number
UPDATE coaches 
SET password_hash = extensions.crypt(phone, extensions.gen_salt('bf')) 
WHERE password_hash IS NULL AND phone IS NOT NULL;

-- 2. Add password_hash to students
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='password_hash') THEN
        ALTER TABLE students ADD COLUMN password_hash TEXT;
    END IF;
END $$;

-- Set default password for existing students to their parent_phone or phone
UPDATE students 
SET password_hash = extensions.crypt(COALESCE(parent_phone, phone, 'password123'), extensions.gen_salt('bf')) 
WHERE password_hash IS NULL;

-- 3. Expose a secure RPC function to verify passwords for coaches/parents
-- This is necessary because Edge Functions can use RPC to check passwords securely without sending hash over network
CREATE OR REPLACE FUNCTION verify_user_password(
    p_user_type TEXT, 
    p_identifier TEXT, 
    p_password TEXT
) RETURNS JSON AS $$
DECLARE
    v_user_record RECORD;
    v_is_valid BOOLEAN;
BEGIN
    IF p_user_type = 'coach' THEN
        -- Match coach by name or email
        SELECT id, name, email, password_hash INTO v_user_record
        FROM coaches
        WHERE name ILIKE '%' || p_identifier || '%' OR email ILIKE '%' || p_identifier || '%'
        LIMIT 1;

        IF FOUND AND v_user_record.password_hash IS NOT NULL THEN
            v_is_valid := v_user_record.password_hash = extensions.crypt(p_password, v_user_record.password_hash);
            IF v_is_valid THEN
                RETURN json_build_object('valid', true, 'id', v_user_record.id, 'name', v_user_record.name);
            END IF;
        END IF;

    ELSIF p_user_type = 'student' THEN
        -- Match student by exact or partial name
        SELECT id, name, password_hash INTO v_user_record
        FROM students
        WHERE name ILIKE '%' || p_identifier || '%' OR name ILIKE p_identifier
        LIMIT 1;

        IF FOUND AND v_user_record.password_hash IS NOT NULL THEN
            v_is_valid := v_user_record.password_hash = extensions.crypt(p_password, v_user_record.password_hash);
            IF v_is_valid THEN
                RETURN json_build_object('valid', true, 'id', v_user_record.id, 'name', v_user_record.name);
            END IF;
        END IF;
    END IF;

    RETURN json_build_object('valid', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Expose a secure RPC function to update password for coaches/parents
CREATE OR REPLACE FUNCTION update_user_password(
    p_user_type TEXT, 
    p_id TEXT, 
    p_new_password TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_type = 'coach' THEN
        UPDATE coaches SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')) WHERE id = p_id;
        RETURN TRUE;
    ELSIF p_user_type = 'student' THEN
        UPDATE students SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')) WHERE id = p_id;
        RETURN TRUE;
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
