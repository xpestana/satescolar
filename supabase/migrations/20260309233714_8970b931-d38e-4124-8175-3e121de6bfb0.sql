ALTER TABLE public.final_grades
  ADD COLUMN observation text DEFAULT NULL,
  ADD COLUMN attendance_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN absence_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN final_status text DEFAULT NULL;