-- Every auth user must have a public.profiles row: it holds full_name, phone and the login
-- counters (login_count / last_login_at) used by the admin user list and dashboard.
--
-- Root cause fixed here: when the project was moved (around 2026-06-02) the public schema and
-- the migration history were copied, but not the triggers living on auth.users. Migration
-- 20260127232024 is recorded as applied, yet on_auth_user_created no longer existed, so 210 of
-- 236 users had no profile and sync_login_count() (a plain UPDATE) silently counted nothing.
--
-- Three layers so it cannot silently happen again:
--   1. on_auth_user_created creates the profile when the user is created (any path).
--   2. on_auth_user_updated upserts it on login / name change, so a missing row heals itself.
--   3. Backfill of the users that are missing a profile today.
-- Both trigger functions swallow their own errors: a profile problem must never block a
-- signup or a login.

-- 1. Profile on signup -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[handle_new_user] profile not created for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Login counter + name sync (upsert) -----------------------------------------------------------
-- last_sign_in_at changes on every real login (password, magic link, OAuth, impersonation via
-- verifyOtp) but not on token refreshes. The name is taken from user_metadata.full_name, which is
-- what every Edge Function updates (manage-school-subuser, update-system-admin, ...).
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logged_in boolean := NEW.last_sign_in_at IS NOT NULL
                         AND NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at;
  v_new_name text := NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), '');
  v_name_changed boolean := v_new_name IS NOT NULL
                            AND v_new_name IS DISTINCT FROM NULLIF(btrim(OLD.raw_user_meta_data->>'full_name'), '');
BEGIN
  IF NOT v_logged_in AND NOT v_name_changed THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, login_count, last_login_at)
  VALUES (
    NEW.id,
    v_new_name,
    CASE WHEN v_logged_in THEN 1 ELSE 0 END,
    CASE WHEN v_logged_in THEN NEW.last_sign_in_at END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    login_count   = CASE WHEN v_logged_in THEN COALESCE(profiles.login_count, 0) + 1 ELSE profiles.login_count END,
    last_login_at = CASE WHEN v_logged_in THEN NEW.last_sign_in_at ELSE profiles.last_login_at END,
    full_name     = CASE WHEN v_name_changed THEN v_new_name ELSE profiles.full_name END,
    updated_at    = now();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[sync_profile_from_auth] profile not synced for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_signed_in ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_from_auth();

-- Trigger functions are never called directly.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_from_auth() FROM PUBLIC, anon, authenticated;

-- Replaced / dead code: sync_login_count() is superseded by sync_profile_from_auth();
-- record_login() was the old client RPC, revoked and unused since 20260610152450.
DROP FUNCTION IF EXISTS public.sync_login_count();
DROP FUNCTION IF EXISTS public.record_login();

-- 3. Backfill -------------------------------------------------------------------------------------
-- Login history before today is not recoverable (auth.audit_log_entries is empty): users who
-- signed in at least once start at 1 with their real last sign-in date; the rest at 0.
INSERT INTO public.profiles (user_id, full_name, login_count, last_login_at)
SELECT u.id,
       NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''),
       CASE WHEN u.last_sign_in_at IS NOT NULL THEN 1 ELSE 0 END,
       u.last_sign_in_at
  FROM auth.users u
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;
