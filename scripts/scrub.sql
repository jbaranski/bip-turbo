DO $BODY$
DECLARE
    email_record RECORD;
    new_test_email TEXT;
    random_first_name TEXT;
    random_last_name TEXT;
BEGIN
    -- Case 1: Emails present in both public.users and auth.users, ensure the new email matches in both tables
    FOR email_record IN
        SELECT DISTINCT au.email as original_email
        FROM auth.users au
        INNER JOIN public.users pu ON au.email = pu.email
    LOOP
        new_test_email := 'test-joined' || replace(gen_random_uuid()::text, '-', '') || '@bip-localhost-test.com';
        random_first_name := substring(replace(gen_random_uuid()::text, '-', ''), 1, 6);
        random_last_name := substring(replace(gen_random_uuid()::text, '-', ''), 1, 6);

        UPDATE auth.users
        SET email = new_test_email,
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
                                 jsonb_build_object(
                                     'name', random_first_name,
                                     'full_name', random_first_name || ' ' || random_last_name,
                                     'first_name', random_first_name,
                                     'last_name', random_last_name,
                                     'email', new_test_email
                                 )
        WHERE email = email_record.original_email;

        UPDATE public.users
        SET email = new_test_email,
            first_name = random_first_name,
            last_name = random_last_name
        WHERE email = email_record.original_email;
    END LOOP;

    -- Case 2: Email present only in auth.users
    FOR email_record IN
        SELECT DISTINCT au.email as original_email
        FROM auth.users au
        WHERE email NOT LIKE '%@bip-localhost-test.com'
    LOOP
        new_test_email := 'test-au-only' || replace(gen_random_uuid()::text, '-', '') || '@bip-localhost-test.com';
        random_first_name := substring(replace(gen_random_uuid()::text, '-', ''), 1, 6);
        random_last_name := substring(replace(gen_random_uuid()::text, '-', ''), 1, 6);

        UPDATE auth.users
        SET email = new_test_email,
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
                                 jsonb_build_object(
                                     'name', random_first_name,
                                     'full_name', random_first_name || ' ' || random_last_name,
                                     'first_name', random_first_name,
                                     'last_name', random_last_name,
                                     'email', new_test_email
                                 )
        WHERE email = email_record.original_email;
    END LOOP;

    -- Case 3: Email present only in public.users
    FOR email_record IN
        SELECT DISTINCT pu.email as original_email
        FROM public.users pu
        WHERE email NOT LIKE '%@bip-localhost-test.com'
    LOOP
        new_test_email := 'test-pu-only' || replace(gen_random_uuid()::text, '-', '') || '@bip-localhost-test.com';
        random_first_name := substring(replace(gen_random_uuid()::text, '-', ''), 1, 6);
        random_last_name := substring(replace(gen_random_uuid()::text, '-', ''), 1, 6);

        UPDATE public.users
        SET email = new_test_email,
            first_name = random_first_name,
            last_name = random_last_name
        WHERE email = email_record.original_email;
    END LOOP;
END $BODY$;

-- Delete from analytics and logs
DELETE FROM auth.flow_state WHERE 1=1;
DELETE FROM auth.sessions WHERE 1=1;
DELETE FROM public.audits WHERE 1=1;
DELETE FROM auth.audit_log_entries WHERE 1=1;

-- Sanity check cleanup worked
SELECT COUNT(*)
FROM (SELECT email
      FROM auth.users
      WHERE email NOT LIKE '%@bip-localhost-test.com'
      UNION ALL
      SELECT email
      FROM public.users
      WHERE email NOT LIKE '%@bip-localhost-test.com'
) combined;