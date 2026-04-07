-- Seed default admin user: admin@localhost / admin
-- must_change_password flag forces a password change on first login.
-- Safe to re-run: skipped if any admin user already exists.
DO $$
DECLARE
  v_admin_id uuid := gen_random_uuid();
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin'
  ) THEN
    RAISE NOTICE 'Admin user already exists, skipping seed.';
    RETURN;
  END IF;

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    is_sso_user,
    created_at,
    updated_at
  ) VALUES (
    v_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@localhost',
    extensions.crypt('admin', extensions.gen_salt('bf', 10)),
    now(),
    '{"provider": "email", "providers": ["email"], "role": "admin", "must_change_password": true}'::jsonb,
    '{}'::jsonb,
    false,
    false,
    now(),
    now()
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_admin_id,
    jsonb_build_object(
      'sub', v_admin_id::text,
      'email', 'admin@localhost',
      'email_verified', true,
      'provider', 'email'
    ),
    'email',
    'admin@localhost',
    now(),
    now(),
    now()
  );

  RAISE NOTICE 'Admin user created: admin@localhost';
END $$;
