-- 1. Eliminar trigger y función que forzaba is_owner = true para todos los school users
DROP TRIGGER IF EXISTS trg_auto_set_school_owner ON public.user_roles;
DROP FUNCTION IF EXISTS public.trg_fn_auto_set_school_owner();

-- 2. Backfill: cualquier usuario escolar con perfiles de permiso asignados NO debe ser dueño
UPDATE public.user_roles ur
SET is_owner = false
WHERE ur.role = 'school'
  AND ur.is_owner = true
  AND EXISTS (
    SELECT 1 FROM public.school_user_profiles sup
    WHERE sup.user_id = ur.user_id
      AND sup.school_id = ur.school_id
  );

NOTIFY pgrst, 'reload schema';