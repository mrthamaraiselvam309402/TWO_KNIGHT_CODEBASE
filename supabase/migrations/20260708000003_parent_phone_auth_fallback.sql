-- Add parent_phone as fallback password for student auth
CREATE OR REPLACE FUNCTION verify_user_password(
    p_user_type TEXT,
    p_identifier TEXT,
    p_password TEXT
) RETURNS JSON AS $$
DECLARE
    v_user_record RECORD;
    v_is_valid BOOLEAN;
    v_batch_password TEXT;
BEGIN
    IF p_user_type = 'coach' THEN
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
        SELECT id, name, email, password_hash, batch_id, parent_phone, phone INTO v_user_record
        FROM students
        WHERE name ILIKE '%' || p_identifier || '%' OR name = p_identifier
        LIMIT 1;

        IF FOUND AND v_user_record.password_hash IS NOT NULL THEN
            v_is_valid := v_user_record.password_hash = extensions.crypt(p_password, v_user_record.password_hash);
            IF v_is_valid THEN
                RETURN json_build_object('valid', true, 'id', v_user_record.id, 'name', v_user_record.name);
            END IF;
        END IF;

        IF FOUND AND v_user_record.batch_id IS NOT NULL THEN
            SELECT password INTO v_batch_password
            FROM batch_passwords
            WHERE batch_id = v_user_record.batch_id;

            IF v_batch_password IS NOT NULL THEN
                v_is_valid := v_batch_password = p_password;
                IF v_is_valid THEN
                    RETURN json_build_object('valid', true, 'id', v_user_record.id, 'name', v_user_record.name);
                END IF;
            END IF;
        END IF;

        IF FOUND AND p_password IS NOT NULL AND p_password <> '' THEN
            IF v_user_record.parent_phone IS NOT NULL AND v_user_record.parent_phone = p_password THEN
                RETURN json_build_object('valid', true, 'id', v_user_record.id, 'name', v_user_record.name);
            ELSIF v_user_record.phone IS NOT NULL AND v_user_record.phone = p_password THEN
                RETURN json_build_object('valid', true, 'id', v_user_record.id, 'name', v_user_record.name);
            END IF;
        END IF;
    END IF;

    RETURN json_build_object('valid', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
