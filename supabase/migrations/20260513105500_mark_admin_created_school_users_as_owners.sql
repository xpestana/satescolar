-- School users created from the system administrator are the initial operators
-- for their schools. They must be owners so they can access every module and
-- create/manage sub-users with scoped permission profiles.

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

WITH schools_without_owner AS (
  SELECT ur.school_id
  FROM public.user_roles ur
  WHERE ur.role = 'school'
    AND ur.school_id IS NOT NULL
  GROUP BY ur.school_id
  HAVING NOT bool_or(ur.is_owner)
),
first_school_user AS (
  SELECT DISTINCT ON (ur.school_id) ur.id
  FROM public.user_roles ur
  JOIN schools_without_owner swo ON swo.school_id = ur.school_id
  WHERE ur.role = 'school'
  ORDER BY ur.school_id, ur.created_at ASC, ur.id ASC
)
UPDATE public.user_roles ur
SET is_owner = true
FROM first_school_user fsu
WHERE ur.id = fsu.id;
