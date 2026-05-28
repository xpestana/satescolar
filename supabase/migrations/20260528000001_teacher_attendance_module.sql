-- Extend attendance_records for manual teacher attendance
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS momento integer CHECK (momento IN (1, 2, 3)),
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.school_subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL;

-- Partial unique index: prevents duplicate manual registration of same student/class/moment/day
CREATE UNIQUE INDEX IF NOT EXISTS uq_manual_attendance_idx
  ON public.attendance_records(entity_id, attendance_date, section_id, subject_id, momento)
  WHERE record_type = 'manual';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_records_section_date
  ON public.attendance_records(section_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_subject_id
  ON public.attendance_records(subject_id);

-- RLS: teachers can insert manual attendance records for their school
CREATE POLICY IF NOT EXISTS "teachers_can_insert_manual_attendance"
  ON public.attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    record_type = 'manual'
    AND school_id = (SELECT school_id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1)
  );

-- RLS: teachers can read student manual attendance records for their school
CREATE POLICY IF NOT EXISTS "teachers_can_select_manual_attendance"
  ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1)
    AND entity_type = 'student'
    AND record_type = 'manual'
  );

-- RLS: teachers can update manual attendance records for their school
CREATE POLICY IF NOT EXISTS "teachers_can_update_manual_attendance"
  ON public.attendance_records
  FOR UPDATE
  TO authenticated
  USING (
    record_type = 'manual'
    AND school_id = (SELECT school_id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1)
  );
