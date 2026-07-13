-- Modo de facturación por estudiante o por familia
-- 1) Tabla de configuración de pagos por escuela (billing_mode)
-- 2) payments: soporte de pago familiar (family_id, student_id nullable)
-- 3) payment_items: atribución por estudiante (student_id) + backfill
-- 4) RPC get_delinquent_families: morosidad agrupada por familia

-- ─── 1) Configuración por escuela ───
CREATE TABLE IF NOT EXISTS public.school_payment_settings (
  school_id    uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  billing_mode text NOT NULL DEFAULT 'student',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_payment_settings_mode_check CHECK (billing_mode IN ('student','family'))
);

ALTER TABLE public.school_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all school_payment_settings" ON public.school_payment_settings;
CREATE POLICY "Admins can manage all school_payment_settings"
ON public.school_payment_settings FOR ALL
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "School users can manage their school_payment_settings" ON public.school_payment_settings;
CREATE POLICY "School users can manage their school_payment_settings"
ON public.school_payment_settings FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = school_payment_settings.school_id))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = school_payment_settings.school_id));

-- ─── 2) payments: soporte de pago familiar ───
ALTER TABLE public.payments ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_target_check'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_target_check CHECK (student_id IS NOT NULL OR family_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_school_year_family
  ON public.payments(school_id, school_year_id, family_id) WHERE family_id IS NOT NULL;

-- ─── 3) payment_items: atribución por estudiante ───
-- ON DELETE SET NULL: conserva el histórico contable si se borra un hijo.
ALTER TABLE public.payment_items
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_items_student_id ON public.payment_items(student_id);

-- Backfill histórico (pagos por estudiante existentes)
UPDATE public.payment_items pi
SET student_id = p.student_id
FROM public.payments p
WHERE p.id = pi.payment_id
  AND pi.student_id IS NULL
  AND p.student_id IS NOT NULL;

-- ─── 4) RPC morosidad por familia ───
DROP FUNCTION IF EXISTS public.get_delinquent_families(uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_delinquent_families(
  _school_id      uuid,
  _school_year_id uuid
)
RETURNS TABLE (
  family_id        uuid,
  father_last_name text,
  mother_last_name text,
  family_user_id   uuid,
  total_owed       numeric,
  students         jsonb
)
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.school_id = _school_id)) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH lines AS (
    SELECT m.student_id AS sid, m.plan_concept_id, m.balance, m.due_day, m.due_month,
           m.is_recurring, m.concept_name, s.family_id AS fam_id
    FROM public._moroso_balance_lines(_school_id, _school_year_id) m
    JOIN public.students s ON s.id = m.student_id
    WHERE s.family_id IS NOT NULL
  ),
  per_student AS (
    SELECT l.fam_id, l.sid,
           SUM(l.balance)::numeric AS student_owed,
           jsonb_agg(jsonb_build_object(
             'plan_concept_id', l.plan_concept_id,
             'balance',         l.balance,
             'name',            COALESCE(l.concept_name, 'Concepto'),
             'due_day',         l.due_day,
             'due_month',       l.due_month,
             'is_recurring',    l.is_recurring)) AS concepts
    FROM lines l
    GROUP BY l.fam_id, l.sid
  )
  SELECT f.id, f.father_last_name, f.mother_last_name, f.user_id,
         SUM(ps.student_owed)::numeric AS total_owed,
         jsonb_agg(jsonb_build_object(
           'student_id', ps.sid,
           'total_owed', ps.student_owed,
           'concepts',   ps.concepts)) AS students
  FROM per_student ps
  JOIN public.families f ON f.id = ps.fam_id
  GROUP BY f.id, f.father_last_name, f.mother_last_name, f.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_delinquent_families(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_delinquent_families(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_delinquent_families(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
