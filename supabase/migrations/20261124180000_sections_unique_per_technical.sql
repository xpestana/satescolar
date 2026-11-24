-- A school may have the same letter twice in a grade: once regular and once técnica
-- ("1er Año - A" and "1er Año - A (Técnica)"). The old key (school, grade, name) blocked it.
ALTER TABLE public.sections DROP CONSTRAINT IF EXISTS sections_school_id_grade_level_name_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sections'::regclass
      AND conname = 'sections_school_grade_name_technical_key'
  ) THEN
    ALTER TABLE public.sections
      ADD CONSTRAINT sections_school_grade_name_technical_key
      UNIQUE (school_id, grade_level, name, is_technical);
  END IF;
END $$;
