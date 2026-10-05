-- Módulos habilitables por colegio (ver docs/desc/19-modulos.md)
-- 1) Tabla school_modules: on/off + vencimiento opcional por colegio y módulo
-- 2) RLS: admin gestiona; usuarios del colegio (school/teacher/representative) leen
-- 3) school_has_module(): helper reutilizable en RLS, gates y Edge Functions
-- 4) Seed: colegios existentes arrancan con todos los módulos habilitados
-- 5) representative_grades_gate: la morosidad solo bloquea notas si el colegio tiene Pagos
--
-- "registration" (Registro) es gratis y siempre activo: no se guarda en la tabla.

-- ─── 1) Tabla ───
CREATE TABLE IF NOT EXISTS public.school_modules (
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled    boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, module_key),
  CONSTRAINT school_modules_key_check CHECK (module_key IN (
    'messaging', 'payments', 'grades', 'ministry_forms', 'attendance', 'virtual_classroom'
  ))
);

CREATE OR REPLACE FUNCTION public.touch_school_modules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_touch_school_modules ON public.school_modules;
CREATE TRIGGER trg_touch_school_modules
BEFORE UPDATE ON public.school_modules
FOR EACH ROW EXECUTE FUNCTION public.touch_school_modules();

-- ─── 2) RLS ───
ALTER TABLE public.school_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all school_modules" ON public.school_modules;
CREATE POLICY "Admins can manage all school_modules"
ON public.school_modules FOR ALL
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "School users can view their school_modules" ON public.school_modules;
CREATE POLICY "School users can view their school_modules"
ON public.school_modules FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.school_id = school_modules.school_id));

DROP POLICY IF EXISTS "Teachers can view their school_modules" ON public.school_modules;
CREATE POLICY "Teachers can view their school_modules"
ON public.school_modules FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.teachers t
  WHERE t.user_id = auth.uid()
    AND t.school_id = school_modules.school_id));

DROP POLICY IF EXISTS "Representatives can view their school_modules" ON public.school_modules;
CREATE POLICY "Representatives can view their school_modules"
ON public.school_modules FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.family_schools fs
  JOIN public.families f ON f.id = fs.family_id
  WHERE fs.school_id = school_modules.school_id
    AND f.user_id = auth.uid()));

-- ─── 3) Helper ───
CREATE OR REPLACE FUNCTION public.school_has_module(_school_id uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT _module = 'registration' OR EXISTS (
    SELECT 1 FROM public.school_modules sm
    WHERE sm.school_id  = _school_id
      AND sm.module_key = _module
      AND sm.enabled
      AND (sm.expires_at IS NULL OR sm.expires_at > now())
  );
$fn$;

REVOKE ALL ON FUNCTION public.school_has_module(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_has_module(uuid, text) TO authenticated, service_role;

-- ─── 4) Seed: colegios existentes con todo habilitado ───
INSERT INTO public.school_modules (school_id, module_key, enabled, expires_at, updated_by)
SELECT s.id, m.key, true, NULL, NULL
FROM public.schools s
CROSS JOIN (VALUES
  ('messaging'), ('payments'), ('grades'), ('ministry_forms'), ('attendance'), ('virtual_classroom')
) AS m(key)
ON CONFLICT (school_id, module_key) DO NOTHING;

-- ─── 5) Gate de notas: la morosidad solo aplica si el colegio tiene Pagos ───
CREATE OR REPLACE FUNCTION public.representative_grades_gate(
  _student_id     uuid,
  _school_year_id uuid,
  _momento        smallint
)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_school_id uuid;
  v_visible   boolean;
BEGIN
  SELECT ss.school_id INTO v_school_id
  FROM public.students s
  JOIN public.families f         ON f.id = s.family_id
  JOIN public.student_schools ss ON ss.student_id = s.id
  WHERE s.id = _student_id
    AND f.user_id = auth.uid()
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RETURN 'not_child';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.student_grade_access sga
    WHERE sga.student_id = _student_id AND sga.is_blocked
  ) THEN
    RETURN 'blocked_by_school';
  END IF;

  IF public.school_has_module(v_school_id, 'payments')
     AND public.student_has_overdue_balance(_student_id, v_school_id, _school_year_id) THEN
    RETURN 'delinquent';
  END IF;

  SELECT gvs.is_visible INTO v_visible
  FROM public.grade_visibility_settings gvs
  WHERE gvs.school_id      = v_school_id
    AND gvs.school_year_id = _school_year_id
    AND gvs.momento        = _momento;

  IF NOT COALESCE(v_visible, false) THEN
    RETURN 'hidden_by_school';
  END IF;

  RETURN 'ok';
END;
$fn$;

NOTIFY pgrst, 'reload schema';
