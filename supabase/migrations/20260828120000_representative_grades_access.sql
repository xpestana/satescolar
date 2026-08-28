-- Representative access to grades and report cards.
--
-- The boleta generators (src/lib/bachilleratoBoleta.ts, src/lib/primaryDescriptiveBoleta.ts) run
-- entirely in the browser, so the three gates a school can apply to a representative
-- (per momento visibility, per student block, delinquency) have to live in RLS: enforcing them
-- only in the UI would leave the raw tables readable from the browser console.

-- ---------------------------------------------------------------------------
-- 1) Configuration tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.grade_visibility_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  momento        smallint NOT NULL,
  is_visible     boolean NOT NULL DEFAULT false,
  updated_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grade_visibility_settings_momento_check CHECK (momento BETWEEN 0 AND 3),
  CONSTRAINT grade_visibility_settings_unique UNIQUE (school_id, school_year_id, momento)
);

CREATE INDEX IF NOT EXISTS idx_grade_visibility_settings_school
  ON public.grade_visibility_settings (school_id, school_year_id);

ALTER TABLE public.grade_visibility_settings ENABLE ROW LEVEL SECURITY;

-- The student level switch lives in its own table on purpose: representatives hold an unrestricted
-- UPDATE policy on public.students, so a flag stored there could be flipped back by the family.
CREATE TABLE IF NOT EXISTS public.student_grade_access (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  is_blocked boolean NOT NULL DEFAULT false,
  reason     text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_grade_access_school
  ON public.student_grade_access (school_id);

ALTER TABLE public.student_grade_access ENABLE ROW LEVEL SECURITY;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grade_visibility_settings_updated') THEN
    CREATE TRIGGER trg_grade_visibility_settings_updated
      BEFORE UPDATE ON public.grade_visibility_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_student_grade_access_updated') THEN
    CREATE TRIGGER trg_student_grade_access_updated
      BEFORE UPDATE ON public.student_grade_access
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- 2) Gate functions
-- ---------------------------------------------------------------------------

-- Cheap, STABLE variant of _moroso_balance_lines: same due date / grace day rules but without
-- rebuild_student_concept_balances_for_active_year(), which is VOLATILE and unusable from RLS.
CREATE OR REPLACE FUNCTION public.student_has_overdue_balance(
  _student_id     uuid,
  _school_id      uuid,
  _school_year_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_year_range text;
  v_start_year int;
  v_end_year   int;
  v_today      date := (now() AT TIME ZONE 'America/Caracas')::date;
  v_grace_days int  := 0;
  v_found      boolean;
BEGIN
  SELECT COALESCE(overdue_after_day, 0) INTO v_grace_days
  FROM public.delinquency_config
  WHERE school_id = _school_id;
  v_grace_days := COALESCE(v_grace_days, 0);

  SELECT year_range INTO v_year_range
  FROM public.school_years
  WHERE id = _school_year_id;

  IF v_year_range ~ '\d{4}.*\d{4}' THEN
    v_start_year := substring(v_year_range from '(\d{4})')::int;
    v_end_year   := substring(v_year_range from '\d{4}\D+(\d{4})')::int;
  ELSE
    v_start_year := extract(year from v_today)::int;
    v_end_year   := v_start_year;
  END IF;

  SELECT EXISTS (
    WITH overdue AS (
      SELECT
        ppc.due_day::smallint   AS due_day,
        ppc.due_month::smallint AS due_month,
        ppc.is_recurring,
        CASE
          WHEN ppc.due_month IS NOT NULL THEN
            make_date(
              CASE WHEN ppc.due_month >= 8 THEN v_start_year ELSE v_end_year END,
              ppc.due_month::int,
              COALESCE(ppc.due_day, 28)::int
            )
          WHEN ppc.due_day IS NOT NULL THEN
            make_date(
              extract(year  from v_today)::int,
              extract(month from v_today)::int,
              ppc.due_day::int
            )
          ELSE NULL
        END AS due_date
      FROM public.student_concept_balances scb
      JOIN public.payment_plan_concepts ppc ON ppc.id = scb.plan_concept_id
      WHERE scb.student_id     = _student_id
        AND scb.school_id      = _school_id
        AND scb.school_year_id = _school_year_id
        AND scb.balance        > 0
    )
    SELECT 1
    FROM overdue o
    WHERE
      (o.due_day IS NULL AND o.due_month IS NULL)
      OR (
        o.due_date IS NOT NULL
        AND v_today > (o.due_date + (v_grace_days || ' days')::interval)::date
      )
      OR (
        o.is_recurring AND o.due_month IS NULL AND o.due_day IS NOT NULL
        AND make_date(v_start_year, 8, o.due_day::int) < v_today
      )
  ) INTO v_found;

  RETURN COALESCE(v_found, false);
END;
$fn$;

-- Why the representative can (or cannot) see a given student / year / momento.
-- Returns 'ok' | 'not_child' | 'blocked_by_school' | 'delinquent' | 'hidden_by_school'.
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

  IF public.student_has_overdue_balance(_student_id, v_school_id, _school_year_id) THEN
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

CREATE OR REPLACE FUNCTION public.representative_can_view_grades(
  _student_id     uuid,
  _school_year_id uuid,
  _momento        smallint
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT public.representative_grades_gate(_student_id, _school_year_id, _momento) = 'ok';
$fn$;

-- Gate for tables that are not scoped to a single student (templates, subjects, signatures,
-- grading scales): true when the representative has at least one child cleared in that school.
CREATE OR REPLACE FUNCTION public.representative_has_grades_access_in_school(_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.grade_visibility_settings gvs
    JOIN public.student_schools ss ON ss.school_id = gvs.school_id
    JOIN public.students s         ON s.id = ss.student_id
    JOIN public.families f         ON f.id = s.family_id
    WHERE gvs.school_id = _school_id
      AND gvs.is_visible
      AND f.user_id = auth.uid()
      AND public.representative_can_view_grades(s.id, gvs.school_year_id, gvs.momento)
  );
$fn$;

REVOKE ALL ON FUNCTION public.student_has_overdue_balance(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.representative_grades_gate(uuid, uuid, smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.representative_can_view_grades(uuid, uuid, smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.representative_has_grades_access_in_school(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.student_has_overdue_balance(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.representative_grades_gate(uuid, uuid, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.representative_can_view_grades(uuid, uuid, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.representative_has_grades_access_in_school(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) RLS: config tables
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "School users manage grade visibility" ON public.grade_visibility_settings;
CREATE POLICY "School users manage grade visibility"
  ON public.grade_visibility_settings FOR ALL TO authenticated
  USING (public.user_shares_school(auth.uid(), school_id))
  WITH CHECK (public.user_shares_school(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins manage grade visibility" ON public.grade_visibility_settings;
CREATE POLICY "Admins manage grade visibility"
  ON public.grade_visibility_settings FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Representatives view grade visibility" ON public.grade_visibility_settings;
CREATE POLICY "Representatives view grade visibility"
  ON public.grade_visibility_settings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.family_schools fs
    JOIN public.families f ON f.id = fs.family_id
    WHERE fs.school_id = grade_visibility_settings.school_id
      AND f.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "School users manage student grade access" ON public.student_grade_access;
CREATE POLICY "School users manage student grade access"
  ON public.student_grade_access FOR ALL TO authenticated
  USING (public.user_shares_school(auth.uid(), school_id))
  WITH CHECK (public.user_shares_school(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins manage student grade access" ON public.student_grade_access;
CREATE POLICY "Admins manage student grade access"
  ON public.student_grade_access FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Read only for the family: the block must not be removable by the representative.
DROP POLICY IF EXISTS "Representatives view their student grade access" ON public.student_grade_access;
CREATE POLICY "Representatives view their student grade access"
  ON public.student_grade_access FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.families f ON f.id = s.family_id
    WHERE s.id = student_grade_access.student_id
      AND f.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- 4) RLS: representative read access to the academic tables
-- ---------------------------------------------------------------------------

-- representative_child_in_assignment() already exists (classroom module).
DROP POLICY IF EXISTS "Representatives view their children assignments" ON public.subject_teacher_assignments;
CREATE POLICY "Representatives view their children assignments"
  ON public.subject_teacher_assignments FOR SELECT TO authenticated
  USING (public.representative_child_in_assignment(auth.uid(), id));

DROP POLICY IF EXISTS "Representatives view school subjects" ON public.school_subjects;
CREATE POLICY "Representatives view school subjects"
  ON public.school_subjects FOR SELECT TO authenticated
  USING (public.representative_has_grades_access_in_school(school_id));

DROP POLICY IF EXISTS "Representatives view their children final grades" ON public.final_grades;
CREATE POLICY "Representatives view their children final grades"
  ON public.final_grades FOR SELECT TO authenticated
  USING (public.representative_can_view_grades(
    student_id,
    (SELECT sta.school_year_id FROM public.subject_teacher_assignments sta WHERE sta.id = final_grades.assignment_id),
    final_grades.momento::smallint
  ));

DROP POLICY IF EXISTS "Representatives view their children primary reports" ON public.primary_final_reports;
CREATE POLICY "Representatives view their children primary reports"
  ON public.primary_final_reports FOR SELECT TO authenticated
  USING (public.representative_can_view_grades(
    student_id,
    (SELECT sta.school_year_id FROM public.subject_teacher_assignments sta WHERE sta.id = primary_final_reports.assignment_id),
    primary_final_reports.momento::smallint
  ));

DROP POLICY IF EXISTS "Representatives view their children preschool reports" ON public.preschool_final_reports;
CREATE POLICY "Representatives view their children preschool reports"
  ON public.preschool_final_reports FOR SELECT TO authenticated
  USING (public.representative_can_view_grades(
    student_id,
    (SELECT sta.school_year_id FROM public.subject_teacher_assignments sta WHERE sta.id = preschool_final_reports.assignment_id),
    preschool_final_reports.momento::smallint
  ));

DROP POLICY IF EXISTS "Representatives view their children primary indicators" ON public.primary_final_indicator_grades;
CREATE POLICY "Representatives view their children primary indicators"
  ON public.primary_final_indicator_grades FOR SELECT TO authenticated
  USING (public.representative_can_view_grades(
    student_id,
    (SELECT sta.school_year_id FROM public.subject_teacher_assignments sta WHERE sta.id = primary_final_indicator_grades.assignment_id),
    primary_final_indicator_grades.momento::smallint
  ));

DROP POLICY IF EXISTS "Representatives view their children preschool indicators" ON public.preschool_final_indicator_grades;
CREATE POLICY "Representatives view their children preschool indicators"
  ON public.preschool_final_indicator_grades FOR SELECT TO authenticated
  USING (public.representative_can_view_grades(
    student_id,
    (SELECT sta.school_year_id FROM public.subject_teacher_assignments sta WHERE sta.id = preschool_final_indicator_grades.assignment_id),
    preschool_final_indicator_grades.momento::smallint
  ));

DROP POLICY IF EXISTS "Representatives view active boleta templates" ON public.boleta_templates;
CREATE POLICY "Representatives view active boleta templates"
  ON public.boleta_templates FOR SELECT TO authenticated
  USING (is_active AND public.representative_has_grades_access_in_school(school_id));

DROP POLICY IF EXISTS "Representatives view active teacher signatures" ON public.teacher_signatures;
CREATE POLICY "Representatives view active teacher signatures"
  ON public.teacher_signatures FOR SELECT TO authenticated
  USING (is_active AND public.representative_has_grades_access_in_school(school_id));

DROP POLICY IF EXISTS "Representatives view grades config" ON public.grades_config;
CREATE POLICY "Representatives view grades config"
  ON public.grades_config FOR SELECT TO authenticated
  USING (public.representative_has_grades_access_in_school(school_id));

DROP POLICY IF EXISTS "Representatives view primary grading scales" ON public.primary_grading_scales;
CREATE POLICY "Representatives view primary grading scales"
  ON public.primary_grading_scales FOR SELECT TO authenticated
  USING (public.representative_has_grades_access_in_school(school_id));

DROP POLICY IF EXISTS "Representatives view preschool grading scales" ON public.preschool_grading_scales;
CREATE POLICY "Representatives view preschool grading scales"
  ON public.preschool_grading_scales FOR SELECT TO authenticated
  USING (public.representative_has_grades_access_in_school(school_id));

DROP POLICY IF EXISTS "Representatives view primary indicator areas" ON public.primary_indicator_areas;
CREATE POLICY "Representatives view primary indicator areas"
  ON public.primary_indicator_areas FOR SELECT TO authenticated
  USING (public.representative_has_grades_access_in_school(school_id));

DROP POLICY IF EXISTS "Representatives view primary grade indicators" ON public.primary_grade_indicators;
CREATE POLICY "Representatives view primary grade indicators"
  ON public.primary_grade_indicators FOR SELECT TO authenticated
  USING (public.representative_has_grades_access_in_school(school_id));

DROP POLICY IF EXISTS "Representatives view preschool indicator components" ON public.preschool_indicator_components;
CREATE POLICY "Representatives view preschool indicator components"
  ON public.preschool_indicator_components FOR SELECT TO authenticated
  USING (public.representative_has_grades_access_in_school(school_id));

DROP POLICY IF EXISTS "Representatives view preschool component indicators" ON public.preschool_component_indicators;
CREATE POLICY "Representatives view preschool component indicators"
  ON public.preschool_component_indicators FOR SELECT TO authenticated
  USING (public.representative_has_grades_access_in_school(school_id));

NOTIFY pgrst, 'reload schema';
