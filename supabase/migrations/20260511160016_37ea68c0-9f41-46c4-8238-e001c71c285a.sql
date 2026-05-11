
ALTER TABLE public.classroom_comments
  ADD COLUMN IF NOT EXISTS as_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;

ALTER TABLE public.classroom_reactions
  ADD COLUMN IF NOT EXISTS as_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.resolve_student_display_names(_student_ids uuid[], _school_id uuid)
RETURNS TABLE(student_id uuid, display_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.school_id = _school_id
  ) AND NOT public.is_admin() THEN
    -- Allow representatives whose family owns one of those students
    IF NOT EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.families f ON f.id = s.family_id
      WHERE f.user_id = auth.uid() AND s.id = ANY(_student_ids)
    ) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT s.id AS student_id,
    NULLIF(TRIM(BOTH ' ' FROM CONCAT_WS(' ',
      NULLIF(s.form_data->>'primer_nombre',''),
      NULLIF(s.form_data->>'primer_apellido',''))), '')
    AS display_name
  FROM public.students s
  WHERE s.id = ANY(_student_ids);
END;
$$;
