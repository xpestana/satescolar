-- Pre-seed del primer usuario admin del sistema (Docker local, BDs nuevas).
-- Se ejecuta como parte del bloque de seeds, después de aplicar la primera
-- migración (que crea public.schools y public.user_roles).
--
-- Crea:
--   1. Una fila en auth.users con email confirmado y password bcrypt.
--   2. Una identidad en auth.identities (necesaria para que GoTrue acepte el login).
--   3. La fila en public.profiles (la suele crear el trigger handle_new_user, pero
--      lo hacemos explícito por idempotencia).
--   4. La asignación de rol 'admin' en public.user_roles (school_id = NULL).
--
-- Email y password se leen de variables psql:
--   -v admin_email='admin@local.test'  -v admin_password='ChangeMe123!'
--   -v admin_name='Administrador Local'
-- Si no se pasan, usa valores por defecto SOLO para entorno local.
--
-- Idempotente: ON CONFLICT DO NOTHING en todas las tablas.
--
-- IMPORTANTE: En producción NO se debe ejecutar este seed. Está pensado solo
-- para el primer arranque en Docker local.

\set ON_ERROR_STOP on

-- Defaults si las variables no fueron pasadas con -v (valores sin comillas extras: :'var' los escapa)
\if :{?admin_email}
\else
  \set admin_email admin@local.test
\endif
\if :{?admin_password}
\else
  \set admin_password ChangeMe123!
\endif
\if :{?admin_name}
\else
  \set admin_name 'Administrador Local'
\endif

-- Los valores vienen de -v admin_email=... (run-migrations.sh). psql NO sustituye
-- :variable dentro de DO $$...$$; hay que pasarlos en SQL normal (INSERT) y leerlos aquí.
-- Sin ON COMMIT DROP: con autocommit, esa opción borraba la tabla al cerrar cada sentencia.
DROP TABLE IF EXISTS _seed_admin CASCADE;
CREATE TEMP TABLE _seed_admin (email text, pass text, full_name text);
INSERT INTO _seed_admin VALUES (:'admin_email', :'admin_password', :'admin_name');

DO $$
DECLARE
  v_email   text;
  v_pass    text;
  v_name    text;
  v_user_id uuid;
  v_existing uuid;
BEGIN
  SELECT s.email, s.pass, s.full_name
  INTO v_email, v_pass, v_name
  FROM _seed_admin AS s
  LIMIT 1;
  -- Verifica que las tablas requeridas existan (auth.users + public.user_roles)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    RAISE NOTICE 'auth.users no existe todavía; saltando seed de admin.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_roles'
  ) THEN
    RAISE NOTICE 'public.user_roles no existe todavía; saltando seed de admin.';
    RETURN;
  END IF;

  -- ¿Ya existe el usuario? Idempotencia.
  SELECT id INTO v_existing FROM auth.users WHERE email = v_email LIMIT 1;
  IF v_existing IS NOT NULL THEN
    v_user_id := v_existing;
    RAISE NOTICE 'Admin % ya existe (id=%); aseguro rol admin.', v_email, v_user_id;
  ELSE
    v_user_id := gen_random_uuid();

    -- 1. auth.users (columnas compatibles con esquema GoTrue embebido en supabase/postgres;
    -- no todas las instalaciones tienen auth.identities ni email_confirmed_at).
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_pass, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', v_name),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- 2. auth.identities (solo en instalaciones nuevas / GoTrue con tabla identities)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'auth' AND table_name = 'identities'
    ) THEN
      INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_user_id,
        v_user_id::text,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
        'email',
        now(),
        now(),
        now()
      );
    END IF;

    RAISE NOTICE 'Admin creado: % (id=%)', v_email, v_user_id;
  END IF;

  -- 3. public.profiles (el trigger handle_new_user normalmente lo crea, pero
  --    si el trigger no estaba activo cuando se insertó la fila, lo aseguramos).
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (v_user_id, v_name)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- 4. public.user_roles → admin (school_id NULL para admin global)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
      AND ur.role = 'admin'::app_role
      AND ur.school_id IS NULL
  ) THEN
    INSERT INTO public.user_roles (user_id, role, school_id)
    VALUES (v_user_id, 'admin'::app_role, NULL);
  END IF;
END $$;
