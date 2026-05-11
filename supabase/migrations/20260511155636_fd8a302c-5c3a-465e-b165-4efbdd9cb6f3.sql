
CREATE OR REPLACE FUNCTION public.resolve_user_display_names(_user_ids uuid[], _school_id uuid)
RETURNS TABLE(user_id uuid, display_name text, role text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must have any role in the school
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.school_id = _school_id
  ) AND NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH ids AS (SELECT unnest(_user_ids) AS uid)
  SELECT
    ids.uid AS user_id,
    COALESCE(
      -- teacher in this school
      (SELECT TRIM(BOTH ' ' FROM CONCAT_WS(' ',
          NULLIF(t.form_data->>'primer_nombre',''),
          NULLIF(t.form_data->>'primer_apellido','')))
       FROM teachers t WHERE t.user_id = ids.uid AND t.school_id = _school_id LIMIT 1),
      -- family/representative in this school (use primary representative name)
      (SELECT TRIM(BOTH ' ' FROM CONCAT_WS(' ',
          NULLIF(r.form_data->>'primer_nombre',''),
          NULLIF(r.form_data->>'primer_apellido','')))
       FROM families f
       JOIN family_schools fs ON fs.family_id = f.id AND fs.school_id = _school_id
       LEFT JOIN representatives r ON r.family_id = f.id AND r.is_primary = true
       WHERE f.user_id = ids.uid LIMIT 1),
      -- school user / admin profile
      (SELECT NULLIF(p.full_name,'') FROM profiles p WHERE p.user_id = ids.uid LIMIT 1),
      'Usuario'
    ) AS display_name,
    COALESCE(
      (SELECT 'teacher' FROM teachers t WHERE t.user_id = ids.uid AND t.school_id = _school_id LIMIT 1),
      (SELECT 'representative' FROM families f JOIN family_schools fs ON fs.family_id = f.id AND fs.school_id = _school_id WHERE f.user_id = ids.uid LIMIT 1),
      (SELECT ur.role::text FROM user_roles ur WHERE ur.user_id = ids.uid AND (ur.school_id = _school_id OR ur.role = 'admin') LIMIT 1),
      'user'
    ) AS role
  FROM ids;
END;
$$;
