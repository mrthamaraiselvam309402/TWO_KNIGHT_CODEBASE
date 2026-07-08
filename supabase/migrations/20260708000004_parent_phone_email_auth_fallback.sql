-- Add parent_phone fallback to verify_student_credentials so students can
-- also log in with their registered phone number when password_hash is empty.
CREATE OR REPLACE FUNCTION verify_student_credentials(
    p_email TEXT,
    p_password TEXT
) RETURNS JSON AS $$
DECLARE
    v_student RECORD;
    v_is_valid BOOLEAN;
    v_batch_password TEXT;
BEGIN
    SELECT id, name, email, password_hash, batch_id, parent_phone, phone INTO v_student
    FROM students
    WHERE email = p_email
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object('valid', false, 'error', 'Student not found with this email');
    END IF;

    IF v_student.password_hash IS NOT NULL THEN
        v_is_valid := v_student.password_hash = extensions.crypt(p_password, v_student.password_hash);
        IF v_is_valid THEN
            RETURN json_build_object('valid', true, 'id', v_student.id, 'name', v_student.name);
        END IF;
    END IF;

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

    IF p_password IS NOT NULL AND p_password <> '' THEN
        IF v_student.parent_phone IS NOT NULL AND v_student.parent_phone = p_password THEN
            RETURN json_build_object('valid', true, 'id', v_student.id, 'name', v_student.name);
        ELSIF v_student.phone IS NOT NULL AND v_student.phone = p_password THEN
            RETURN json_build_object('valid', true, 'id', v_student.id, 'name', v_student.name);
        END IF;
    END IF;

    RETURN json_build_object('valid', false, 'error', 'Invalid password');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
