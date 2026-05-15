ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.record_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.profiles
     SET login_count = COALESCE(login_count, 0) + 1,
         last_login_at = now()
   WHERE user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.record_login() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_login() TO authenticated;

UPDATE public.profiles p
   SET login_count = 1,
       last_login_at = u.last_sign_in_at
  FROM auth.users u
 WHERE u.id = p.user_id
   AND u.last_sign_in_at IS NOT NULL
   AND COALESCE(p.login_count, 0) = 0;