-- Teacher attendance: tie manual records to their school year and aggregate the
-- summary in the database.
--
-- Before: attendance_records had no school year and sections are reused across
-- years, so the teacher "Resumen" downloaded every manual record of the section
-- (all years, every subject, including other teachers' subjects), counted them
-- in the browser and was silently capped by PostgREST's row limit.

-- 1. Normalize: each manual record belongs to a school year.
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS school_year_id uuid REFERENCES public.school_years(id) ON DELETE SET NULL;

-- 2. Backfill existing manual records.
--    a) From the student's enrollment in that section, when it is unambiguous.
UPDATE public.attendance_records r
SET school_year_id = e.school_year_id
FROM (
  SELECT student_id, section_id, (array_agg(DISTINCT school_year_id))[1] AS school_year_id
  FROM public.enrollments
  WHERE section_id IS NOT NULL AND school_year_id IS NOT NULL
  GROUP BY student_id, section_id
  HAVING count(DISTINCT school_year_id) = 1
) e
WHERE r.record_type = 'manual'
  AND r.school_year_id IS NULL
  AND e.student_id = r.entity_id
  AND e.section_id = r.section_id;

--    b) Otherwise from the (section, subject) assignment, when only one year has it.
UPDATE public.attendance_records r
SET school_year_id = a.school_year_id
FROM (
  SELECT section_id, subject_id, (array_agg(DISTINCT school_year_id))[1] AS school_year_id
  FROM public.subject_teacher_assignments
  WHERE section_id IS NOT NULL
  GROUP BY section_id, subject_id
  HAVING count(DISTINCT school_year_id) = 1
) a
WHERE r.record_type = 'manual'
  AND r.school_year_id IS NULL
  AND a.section_id = r.section_id
  AND a.subject_id = r.subject_id;

-- 3. Index for the teacher's queries (section + subject + year, by date).
CREATE INDEX IF NOT EXISTS idx_attendance_manual_scope
  ON public.attendance_records (section_id, subject_id, school_year_id, attendance_date)
  WHERE record_type = 'manual' AND entity_type = 'student';

-- 4. Summary aggregated in the database, scoped to the calling teacher's own
--    (section, subject) assignments in the given school year.
--    SECURITY INVOKER: the existing RLS policies still decide what is visible.
CREATE OR REPLACE FUNCTION public.get_teacher_attendance_summary(p_school_year_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH scope AS (
    SELECT DISTINCT a.section_id, a.subject_id
    FROM public.subject_teacher_assignments a
    JOIN public.teachers t ON t.id = a.teacher_id
    WHERE t.user_id = auth.uid()
      AND a.school_year_id = p_school_year_id
      AND a.is_suspended = false
      AND a.section_id IS NOT NULL
  ),
  recs AS (
    SELECT r.entity_id, r.status, r.attendance_date
    FROM public.attendance_records r
    JOIN scope s ON s.section_id = r.section_id AND s.subject_id = r.subject_id
    WHERE r.record_type = 'manual'
      AND r.entity_type = 'student'
      AND r.school_year_id = p_school_year_id
  ),
  by_student AS (
    SELECT entity_id,
           count(*) AS total,
           count(*) FILTER (WHERE status = 'absent') AS absences
    FROM recs
    GROUP BY entity_id
  ),
  by_week AS (
    SELECT date_trunc('week', attendance_date)::date AS week_start,
           count(*) FILTER (WHERE status = 'absent') AS absences,
           count(*) FILTER (WHERE status <> 'absent') AS present
    FROM recs
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 8
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM recs),
    'absences', (SELECT count(*) FROM recs WHERE status = 'absent'),
    'by_student', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('student_id', entity_id, 'total', total, 'absences', absences)
                       ORDER BY absences DESC, total DESC)
      FROM by_student), '[]'::jsonb),
    'by_week', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('week_start', week_start, 'absences', absences, 'present', present)
                       ORDER BY week_start)
      FROM by_week), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.get_teacher_attendance_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_teacher_attendance_summary(uuid) TO authenticated;
