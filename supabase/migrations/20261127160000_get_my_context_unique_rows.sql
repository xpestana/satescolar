-- get_my_context: resolve a role, teacher or family only when the user has exactly ONE row,
-- like the client lookups it replaced (`maybeSingle()` / `single()` failed on duplicates, so the
-- user got no role / no school). Picking one row with LIMIT 1 would instead let anyone able to
-- create a second teachers/families row pointing at someone else's user_id (school staff can)
-- decide which school that person's session shows.

CREATE OR REPLACE FUNCTION public.get_my_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_role_school uuid;
  v_school uuid;
  v_owner boolean := false;
  v_teacher uuid;
  v_family uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF (SELECT count(*) FROM public.user_roles WHERE user_id = v_uid) = 1 THEN
    SELECT ur.role::text, ur.school_id, COALESCE(ur.is_owner, false)
      INTO v_role, v_role_school, v_owner
    FROM public.user_roles ur
    WHERE ur.user_id = v_uid;
  END IF;

  IF v_role = 'teacher' THEN
    IF (SELECT count(*) FROM public.teachers WHERE user_id = v_uid) = 1 THEN
      SELECT t.id, t.school_id INTO v_teacher, v_school
      FROM public.teachers t
      WHERE t.user_id = v_uid;
    END IF;
  ELSIF v_role = 'representative' THEN
    IF (SELECT count(*) FROM public.families WHERE user_id = v_uid) = 1 THEN
      SELECT f.id INTO v_family
      FROM public.families f
      WHERE f.user_id = v_uid;
    END IF;
    IF v_family IS NOT NULL THEN
      SELECT fs.school_id INTO v_school
      FROM public.family_schools fs
      WHERE fs.family_id = v_family
      ORDER BY fs.created_at
      LIMIT 1;
    END IF;
  ELSIF v_role = 'school' THEN
    v_school := v_role_school;
  END IF;

  RETURN jsonb_build_object(
    'role', v_role,
    'role_school_id', v_role_school,
    'school_id', v_school,
    'is_owner', COALESCE(v_owner, false),
    'teacher_id', v_teacher,
    'family_id', v_family,
    'modules', CASE
      WHEN v_school IS NULL OR v_role = 'admin' THEN '[]'::jsonb
      ELSE COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'module_key', sm.module_key,
                 'enabled', sm.enabled,
                 'expires_at', sm.expires_at))
        FROM public.school_modules sm
        WHERE sm.school_id = v_school), '[]'::jsonb)
    END,
    'permissions', CASE
      WHEN v_role = 'school' AND NOT COALESCE(v_owner, false) THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object('key', i.permission_key, 'scope', i.scope))
        FROM public.school_user_profiles p
        JOIN public.permission_profile_items i ON i.profile_id = p.profile_id
        WHERE p.user_id = v_uid), '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  );
END;
$$;

-- Supabase grants EXECUTE to anon by default privileges; REVOKE FROM PUBLIC does not remove it.
-- Both functions return nothing without a session, but only signed-in users need them.
REVOKE ALL ON FUNCTION public.get_my_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_context() TO authenticated;
REVOKE ALL ON FUNCTION public.get_teacher_attendance_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_attendance_summary(uuid) TO authenticated;
