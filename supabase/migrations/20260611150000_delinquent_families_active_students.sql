-- Morosidad por familia: excluir estudiantes egresados/culminados.
-- Solo cuentan los hijos con status 'active' o 'suspended'.

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
      AND s.status IN ('active', 'suspended')
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
