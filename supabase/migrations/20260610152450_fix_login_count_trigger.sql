-- Replace client-side record_login() with a reliable DB-level trigger.
-- Supabase updates auth.users.last_sign_in_at on every real login (password,
-- OAuth, magic link) but NOT on session refreshes or localStorage restores.
-- A trigger on that column change is the only way to count all auth methods
-- accurately and without depending on the client calling an RPC.

-- 1. Trigger function in public schema (auth schema access not allowed via Management API)
CREATE OR REPLACE FUNCTION public.sync_login_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only fire when last_sign_in_at actually changes (a new real login occurred)
  IF OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at
     AND NEW.last_sign_in_at IS NOT NULL
  THEN
    UPDATE public.profiles
       SET login_count  = COALESCE(login_count, 0) + 1,
           last_login_at = NEW.last_sign_in_at
     WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_signed_in ON auth.users;
CREATE TRIGGER on_auth_user_signed_in
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_login_count();

-- 3. Keep record_login() in place for now but revoke public execute so it
--    can't be called accidentally from the client (client-side call is removed
--    in useAuth.tsx to avoid double-counting with the new trigger).
REVOKE ALL ON FUNCTION public.record_login() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_login() FROM authenticated;
