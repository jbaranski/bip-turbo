-- Sanity check before scrub
SELECT (SELECT COUNT(*)
        FROM auth.users
        WHERE email NOT LIKE '%@bip-localhost-test.com') +
       (SELECT COUNT(*)
        FROM public.users
        WHERE email NOT LIKE '%@bip-localhost-test.com') +
       (SELECT count(*)
        FROM public.audits, jsonb_each_text(audited_changes)
        WHERE value like '%@%.com'
        AND value NOT LIKE '%@bip-localhost-test.com') +
       (SELECT count(*)
        FROM auth.audit_log_entries, json_each_text(payload -> 'traits')
        WHERE value LIKE '%@%.com'
        AND value NOT LIKE '%@bip-localhost-test.com') +
       (SELECT count(*)
        FROM auth.audit_log_entries, json_each_text(payload)
        WHERE key != 'traits'
        AND value LIKE '%@%.com'
        AND value NOT LIKE '%@bip-localhost-test.com')
AS before_non_test_email_count;


DO $BODY$
DECLARE
    email_record RECORD;
    new_test_email TEXT;
    random_first_name TEXT;
    random_last_name TEXT;
BEGIN
    -- Case 1: Emails present in both public.users and auth.users
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

        UPDATE public.audits
        SET audited_changes = COALESCE(audited_changes, '{}'::jsonb) ||
                              jsonb_build_object(
                                  'first_name', random_first_name,
                                  'last_name', random_last_name,
                                  'email', new_test_email,
                                  'username', new_test_email
                              )
        WHERE auditable_type = 'User'
        AND audited_changes ->> 'email' = email_record.original_email;

        UPDATE auth.audit_log_entries
        SET payload = (COALESCE(payload::jsonb, '{}'::jsonb) ||
                       jsonb_build_object(
                           'actor_username', new_test_email
                       )
        )::json
        WHERE payload ->> 'actor_username' = email_record.original_email;

        UPDATE auth.audit_log_entries
        SET payload = (COALESCE(payload::jsonb, '{}'::jsonb) ||
                       jsonb_build_object(
                            'traits', jsonb_build_object(
                               'user_email', new_test_email
                           )
                       )
        )::json
        WHERE payload -> 'traits' ->> 'user_email' = email_record.original_email;
    END LOOP;

    -- Case 2: Email present only in auth.users
    FOR email_record IN
        SELECT DISTINCT au.email as original_email
        FROM auth.users au
        WHERE au.email NOT LIKE '%@bip-localhost-test.com'
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

        UPDATE public.audits
        SET audited_changes = COALESCE(audited_changes, '{}'::jsonb) ||
                              jsonb_build_object(
                                  'first_name', random_first_name,
                                  'last_name', random_last_name,
                                  'email', new_test_email,
                                  'username', new_test_email
                              )
        WHERE auditable_type = 'User'
        AND audited_changes ->> 'email' = email_record.original_email;

        UPDATE auth.audit_log_entries
        SET payload = (COALESCE(payload::jsonb, '{}'::jsonb) ||
                       jsonb_build_object(
                           'actor_username', new_test_email
                       )
        )::json
        WHERE payload ->> 'actor_username' = email_record.original_email;

        UPDATE auth.audit_log_entries
        SET payload = (COALESCE(payload::jsonb, '{}'::jsonb) ||
                       jsonb_build_object(
                            'traits', jsonb_build_object(
                               'user_email', new_test_email
                           )
                       )
        )::json
        WHERE payload -> 'traits' ->> 'user_email' = email_record.original_email;
    END LOOP;

    -- Case 3: Email present only in public.users
    FOR email_record IN
        SELECT DISTINCT pu.email as original_email
        FROM public.users pu
        WHERE pu.email NOT LIKE '%@bip-localhost-test.com'
    LOOP
        new_test_email := 'test-pu-only' || replace(gen_random_uuid()::text, '-', '') || '@bip-localhost-test.com';
        random_first_name := substring(replace(gen_random_uuid()::text, '-', ''), 1, 6);
        random_last_name := substring(replace(gen_random_uuid()::text, '-', ''), 1, 6);

        UPDATE public.users
        SET email = new_test_email,
            first_name = random_first_name,
            last_name = random_last_name
        WHERE email = email_record.original_email;

        UPDATE public.audits
        SET audited_changes = COALESCE(audited_changes, '{}'::jsonb) ||
                              jsonb_build_object(
                                  'first_name', random_first_name,
                                  'last_name', random_last_name,
                                  'email', new_test_email,
                                  'username', new_test_email
                              )
        WHERE auditable_type = 'User'
        AND audited_changes ->> 'email' = email_record.original_email;

        UPDATE auth.audit_log_entries
        SET payload = (COALESCE(payload::jsonb, '{}'::jsonb) ||
                       jsonb_build_object(
                           'actor_username', new_test_email
                       )
        )::json
        WHERE payload ->> 'actor_username' = email_record.original_email;

        UPDATE auth.audit_log_entries
        SET payload = (COALESCE(payload::jsonb, '{}'::jsonb) ||
                       jsonb_build_object(
                            'traits', jsonb_build_object(
                               'user_email', new_test_email
                           )
                       )
        )::json
        WHERE payload -> 'traits' ->> 'user_email' = email_record.original_email;
    END LOOP;

    -- Case 4: Orphaned audited_changes.email public.audits
    FOR email_record IN
        SELECT DISTINCT pa.audited_changes ->> 'email' as original_email
        FROM public.audits pa
        WHERE pa.audited_changes ->> 'email' NOT LIKE '%@bip-localhost-test.com'
    LOOP
        new_test_email := 'test-public-audit' || replace(gen_random_uuid()::text, '-', '') || '@bip-localhost-test.com';
        random_first_name := substring(replace(gen_random_uuid()::text, '-', ''), 1, 6);
        random_last_name := substring(replace(gen_random_uuid()::text, '-', ''), 1, 6);

        UPDATE public.audits
        SET audited_changes = COALESCE(audited_changes, '{}'::jsonb) ||
                              jsonb_build_object(
                                  'first_name', random_first_name,
                                  'last_name', random_last_name,
                                  'email', new_test_email,
                                  'username', new_test_email
                              )
        WHERE auditable_type = 'User'
        AND audited_changes ->> 'email' = email_record.original_email;
    END LOOP;

    -- Case 5: Orphaned payload.actor_username auth.audit_log_entries
    FOR email_record IN
        SELECT DISTINCT aa.payload ->> 'actor_username' as original_email
        FROM auth.audit_log_entries aa
        WHERE aa.payload ->> 'actor_username' LIKE '%@%.com'
        AND aa.payload ->> 'actor_username' NOT LIKE '%@bip-localhost-test.com'
    LOOP
        new_test_email := 'test-auth-audit-actor' || replace(gen_random_uuid()::text, '-', '') || '@bip-localhost-test.com';

        UPDATE auth.audit_log_entries
        SET payload = (COALESCE(payload::jsonb, '{}'::jsonb) ||
                       jsonb_build_object(
                           'actor_username', new_test_email
                       )
        )::json
        WHERE payload ->> 'actor_username' = email_record.original_email;
    END LOOP;

    -- Case 6: Orphaned payload.traits.user_email auth.audit_log_entries
    FOR email_record IN
        SELECT DISTINCT aa.payload -> 'traits' ->> 'user_email' as original_email
        FROM auth.audit_log_entries aa
        WHERE aa.payload -> 'traits' ->> 'user_email' LIKE '%@%.com'
        AND aa.payload -> 'traits' ->> 'user_email' NOT LIKE '%@bip-localhost-test.com'
    LOOP
        new_test_email := 'test-auth-audit-trait' || replace(gen_random_uuid()::text, '-', '') || '@bip-localhost-test.com';

        UPDATE auth.audit_log_entries
        SET payload = (COALESCE(payload::jsonb, '{}'::jsonb) ||
                       jsonb_build_object(
                            'traits', jsonb_build_object(
                               'user_email', new_test_email
                           )
                       )
        )::json
        WHERE payload -> 'traits' ->> 'user_email' = email_record.original_email;
    END LOOP;
END $BODY$;


-- Sanity check after scrub
SELECT (SELECT COUNT(*)
        FROM auth.users
        WHERE email NOT LIKE '%@bip-localhost-test.com') +
       (SELECT COUNT(*)
        FROM public.users
        WHERE email NOT LIKE '%@bip-localhost-test.com') +
       (SELECT count(*)
        FROM public.audits, jsonb_each_text(audited_changes)
        WHERE value like '%@%.com'
        AND value NOT LIKE '%@bip-localhost-test.com') +
       (SELECT count(*)
        FROM auth.audit_log_entries, json_each_text(payload -> 'traits')
        WHERE value LIKE '%@%.com'
        AND value NOT LIKE '%@bip-localhost-test.com') +
       (SELECT count(*)
        FROM auth.audit_log_entries, json_each_text(payload)
        WHERE key != 'traits'
        AND value LIKE '%@%.com'
        AND value NOT LIKE '%@bip-localhost-test.com')
AS after_non_test_email_count;
