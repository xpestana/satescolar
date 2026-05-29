-- Allow users with settings.users permission to read all profile assignments in their school.
-- Uses SECURITY DEFINER to avoid recursive RLS when querying school_user_profiles internally.

CREATE OR REPLACE FUNCTION user_has_permission(p_user_id uuid, p_school_id uuid, p_key text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM school_user_profiles sup
    JOIN permission_profile_items ppi ON ppi.profile_id = sup.profile_id
    WHERE sup.user_id = p_user_id
      AND sup.school_id = p_school_id
      AND ppi.permission_key = p_key
  )
$$;

CREATE POLICY "Users with settings.users can read school assignments"
  ON school_user_profiles FOR SELECT
  USING (user_has_permission(auth.uid(), school_id, 'settings.users'));
