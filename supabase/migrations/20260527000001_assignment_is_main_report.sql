ALTER TABLE subject_teacher_assignments
  ADD COLUMN IF NOT EXISTS is_main_report boolean NOT NULL DEFAULT false;
