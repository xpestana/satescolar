
-- Create trigger function to auto-generate classroom access code on enrollment
CREATE OR REPLACE FUNCTION public.create_classroom_access_code_on_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.classroom_access_codes (student_id, school_id, school_year_id, access_code, is_active)
  VALUES (
    NEW.student_id,
    NEW.school_id,
    NEW.school_year_id,
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger on enrollments table
CREATE TRIGGER trg_create_classroom_access_code
AFTER INSERT ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.create_classroom_access_code_on_enrollment();

-- Add RLS policy so representatives can read their children's access codes
CREATE POLICY "Representatives can view their children access codes"
ON public.classroom_access_codes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM students s
    JOIN families f ON f.id = s.family_id
    WHERE s.id = student_id AND f.user_id = auth.uid()
  )
);
