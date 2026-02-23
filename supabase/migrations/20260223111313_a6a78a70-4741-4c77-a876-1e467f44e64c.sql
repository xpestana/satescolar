-- Add enrollment_type and enrollment_date columns to enrollments table
ALTER TABLE public.enrollments 
  ADD COLUMN enrollment_type text DEFAULT NULL,
  ADD COLUMN enrollment_date date DEFAULT NULL;