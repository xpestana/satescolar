CREATE OR REPLACE FUNCTION public.create_classroom_access_code_on_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.classroom_access_codes (student_id, school_id, school_year_id, access_code, is_active)
  VALUES (
    NEW.student_id,
    NEW.school_id,
    NEW.school_year_id,
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    true
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;