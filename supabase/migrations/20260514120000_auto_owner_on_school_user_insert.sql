-- Garantizar que todo usuario con role='school' sea owner automáticamente,
-- sin depender de que el edge function lo envíe explícitamente.
-- Esto protege contra versiones desactualizadas del edge function en el servidor.

CREATE OR REPLACE FUNCTION public.trg_fn_auto_set_school_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'school' THEN
    NEW.is_owner := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_set_school_owner ON public.user_roles;
CREATE TRIGGER trg_auto_set_school_owner
  BEFORE INSERT OR UPDATE OF role
  ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_auto_set_school_owner();

-- Backfill: marcar como owner todos los school users que aún no lo son.
UPDATE public.user_roles
SET is_owner = true
WHERE role = 'school'
  AND is_owner = false;

NOTIFY pgrst, 'reload schema';
