-- Users created from the system admin do not receive scoped permission
-- profiles; they are school operators and should have full access by default.
-- Sub-users created inside a school keep their scoped profiles.

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

UPDATE public.user_roles ur
SET is_owner = true
WHERE ur.role = 'school'
  AND ur.school_id IS NOT NULL
  AND ur.is_owner = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.school_user_profiles sup
    WHERE sup.user_id = ur.user_id
      AND sup.school_id = ur.school_id
  );
