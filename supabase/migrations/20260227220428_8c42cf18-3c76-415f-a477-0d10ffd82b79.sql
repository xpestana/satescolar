
-- Delete existing assignments since they lack section_id
DELETE FROM public.subject_teacher_assignments;

-- Add section_id column
ALTER TABLE public.subject_teacher_assignments
  ADD COLUMN section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE;

-- Replace unique constraint
ALTER TABLE public.subject_teacher_assignments
  DROP CONSTRAINT IF EXISTS subject_teacher_year_unique;

ALTER TABLE public.subject_teacher_assignments
  ADD CONSTRAINT subject_teacher_year_section_unique
  UNIQUE (subject_id, teacher_id, school_year_id, section_id);

-- RLS: teachers can view sections of their school
CREATE POLICY "Teachers can view school sections"
  ON public.sections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.user_id = auth.uid() AND t.school_id = sections.school_id
  ));
