-- One round trip for everything the app needs to know about the signed-in user
-- before it can draw a screen: role, school, owner flag, teacher/family id,
-- the school's modules and (for school sub-users) their permission items.
--
-- Before, the browser chained 5-7 requests (user_roles twice, teachers or
-- families + family_schools, school_modules, school_user_profiles,
-- permission_profile_items), each waiting on the previous one.
--
-- SECURITY INVOKER: every table is read with the caller's own RLS, so it returns
-- exactly what those separate requests could already read.

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

  SELECT ur.role::text, ur.school_id, COALESCE(ur.is_owner, false)
    INTO v_role, v_role_school, v_owner
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid
  LIMIT 1;

  IF v_role = 'teacher' THEN
    SELECT t.id, t.school_id INTO v_teacher, v_school
    FROM public.teachers t
    WHERE t.user_id = v_uid
    LIMIT 1;
  ELSIF v_role = 'representative' THEN
    SELECT f.id INTO v_family
    FROM public.families f
    WHERE f.user_id = v_uid
    LIMIT 1;
    IF v_family IS NOT NULL THEN
      SELECT fs.school_id INTO v_school
      FROM public.family_schools fs
      WHERE fs.family_id = v_family
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

REVOKE ALL ON FUNCTION public.get_my_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_context() TO authenticated;
