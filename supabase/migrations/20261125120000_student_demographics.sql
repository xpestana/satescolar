-- Estadística de matrícula (Centro de Consultas → "Estadística de matrícula").
--
-- La edad y el sexo del estudiante vivían solo dentro de `students.form_data` (JSON:
-- `fecha_nacimiento`, `genero`). Agregar sobre JSON para cientos/miles de inscritos es lento y
-- frágil (formatos de fecha mixtos de importaciones, "Masculino"/"M"/…), así que:
--
-- 1. Se normalizan a columnas tipadas `students.birth_date` y `students.sex`, que un trigger
--    mantiene sincronizadas con `form_data` en cualquier camino de escritura (formularios,
--    representante, importación). `form_data` sigue siendo la fuente que edita el usuario.
-- 2. Dos RPC devuelven la matrícula ya agregada por sección (GROUP BY en el servidor), una sola
--    llamada por año escolar. Son SECURITY DEFINER con guardia `is_school_staff`/`is_admin`
--    para no evaluar la RLS fila por fila (ver 20260909120000_optimize_payments_rls_and_indexes).
-- 3. `fecha_nacimiento` y `genero` pasan a obligatorios y se garantiza que `genero` exista en el
--    formulario de estudiantes de cada colegio.
--
-- Idempotente.

-- ── 1. Tipo y columnas ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  CREATE TYPE public.student_sex AS ENUM ('male', 'female');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS sex public.student_sex;

COMMENT ON COLUMN public.students.birth_date IS
  'Copia tipada de form_data.fecha_nacimiento (trigger students_sync_demographics). No editar directo.';
COMMENT ON COLUMN public.students.sex IS
  'Copia normalizada de form_data.genero (o sexo) (trigger students_sync_demographics). No editar directo.';

-- ── 2. Normalizadores (puros, nunca lanzan) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.parse_form_date(_value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v text := btrim(coalesce(_value, ''));
  parts text[];
  result date;
BEGIN
  IF v = '' THEN
    RETURN NULL;
  END IF;

  IF v ~ '^\d{4}-\d{1,2}-\d{1,2}' THEN
    -- ISO (YYYY-MM-DD), con o sin hora.
    parts := regexp_match(v, '^(\d{4})-(\d{1,2})-(\d{1,2})');
    result := make_date(parts[1]::int, parts[2]::int, parts[3]::int);
  ELSIF v ~ '^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$' THEN
    -- DD/MM/YYYY, DD-MM-YYYY o DD.MM.YYYY (formato venezolano de importaciones).
    parts := regexp_match(v, '^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$');
    result := make_date(parts[3]::int, parts[2]::int, parts[1]::int);
  ELSE
    RETURN NULL;
  END IF;

  IF result < DATE '1900-01-01' OR result > DATE '2100-12-31' THEN
    RETURN NULL;
  END IF;
  RETURN result;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_student_sex(_value text)
RETURNS public.student_sex
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE translate(lower(btrim(coalesce(_value, ''))), 'áéíóúñ', 'aeioun')
    WHEN 'masculino' THEN 'male'::public.student_sex
    WHEN 'm' THEN 'male'::public.student_sex
    WHEN 'hombre' THEN 'male'::public.student_sex
    WHEN 'varon' THEN 'male'::public.student_sex
    WHEN 'male' THEN 'male'::public.student_sex
    WHEN 'femenino' THEN 'female'::public.student_sex
    WHEN 'f' THEN 'female'::public.student_sex
    WHEN 'mujer' THEN 'female'::public.student_sex
    WHEN 'hembra' THEN 'female'::public.student_sex
    WHEN 'female' THEN 'female'::public.student_sex
    ELSE NULL
  END
$$;

-- ── 3. Sincronización form_data → columnas ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_student_demographics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.birth_date := public.parse_form_date(NEW.form_data ->> 'fecha_nacimiento');
  NEW.sex := public.normalize_student_sex(
    coalesce(NEW.form_data ->> 'genero', NEW.form_data ->> 'sexo')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_sync_demographics ON public.students;
CREATE TRIGGER students_sync_demographics
BEFORE INSERT OR UPDATE OF form_data ON public.students
FOR EACH ROW EXECUTE FUNCTION public.sync_student_demographics();

-- Backfill sin tocar updated_at (es un dato derivado, no una edición del usuario).
ALTER TABLE public.students DISABLE TRIGGER update_students_updated_at;
UPDATE public.students s
SET birth_date = public.parse_form_date(s.form_data ->> 'fecha_nacimiento'),
    sex = public.normalize_student_sex(coalesce(s.form_data ->> 'genero', s.form_data ->> 'sexo'))
WHERE s.birth_date IS DISTINCT FROM public.parse_form_date(s.form_data ->> 'fecha_nacimiento')
   OR s.sex IS DISTINCT FROM public.normalize_student_sex(coalesce(s.form_data ->> 'genero', s.form_data ->> 'sexo'));
ALTER TABLE public.students ENABLE TRIGGER update_students_updated_at;

-- ── 4. Índice para agregar inscritos de un año (index-only scan) ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_enrollments_year_school
  ON public.enrollments (school_year_id, school_id)
  INCLUDE (section_id, student_id);

-- ── 5. Formulario de estudiantes: fecha de nacimiento y género obligatorios ────────────────
INSERT INTO public.form_fields
  (school_id, form_type, field_name, field_label, field_type, field_order, is_required, is_visible, options, group_id)
SELECT sc.id, 'student', 'genero', 'Género', 'select', 4, true, true,
       '["Masculino","Femenino"]'::jsonb,
       (SELECT g.id FROM public.form_field_groups g
         WHERE g.school_id = sc.id AND g.form_type = 'student'
         ORDER BY g.display_order LIMIT 1)
FROM public.schools sc
WHERE NOT EXISTS (
  SELECT 1 FROM public.form_fields ff
  WHERE ff.school_id = sc.id AND ff.form_type = 'student' AND ff.field_name IN ('genero', 'sexo')
);

UPDATE public.form_fields
SET is_required = true, is_visible = true
WHERE form_type = 'student'
  AND field_name IN ('fecha_nacimiento', 'genero', 'sexo')
  AND (is_required = false OR is_visible = false);

-- ── 6. RPC: inscritos por sección × edad × sexo × documento ───────────────────────────────
CREATE OR REPLACE FUNCTION public.get_enrollment_demographics(p_school_id uuid, p_school_year_id uuid)
RETURNS TABLE (
  section_id uuid,
  age integer,
  sex public.student_sex,
  document_kind text,
  total integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'America/Caracas')::date;
BEGIN
  IF NOT (public.is_school_staff(p_school_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    e.section_id,
    CASE WHEN s.birth_date <= today
      THEN date_part('year', age(today, s.birth_date))::integer
    END AS age,
    s.sex,
    CASE upper(coalesce(nullif(split_part(s.document_id, '-', 1), s.document_id),
                        s.form_data ->> 'tipo_documento'))
      WHEN 'V' THEN 'CI'
      WHEN 'E' THEN 'CI'
      WHEN 'CE' THEN 'CE'
      WHEN 'P' THEN 'P'
    END AS document_kind,
    count(*)::integer AS total
  FROM public.enrollments e
  JOIN public.students s ON s.id = e.student_id
  WHERE e.school_year_id = p_school_year_id
    AND e.school_id = p_school_id
  GROUP BY 1, 2, 3, 4;
END;
$$;

-- ── 7. RPC: respuestas de selects/checkboxes por sección × sexo ───────────────────────────
-- Campos elegibles: visibles, checkbox o select con opciones fijas. Se excluyen los que ya cubre
-- la matriz (género, tipo de documento, grado) y, por no tener `options`, los selects
-- geográficos que guardan UUID.
CREATE OR REPLACE FUNCTION public.get_enrollment_answer_breakdown(p_school_id uuid, p_school_year_id uuid)
RETURNS TABLE (
  section_id uuid,
  field_name text,
  answer text,
  sex public.student_sex,
  total integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.is_school_staff(p_school_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH fields AS (
    SELECT DISTINCT ON (ff.field_name) ff.field_name, ff.field_type
    FROM public.form_fields ff
    WHERE ff.school_id = p_school_id
      AND ff.form_type = 'student'
      AND ff.is_visible
      AND ff.field_name NOT IN ('genero', 'sexo', 'tipo_documento', 'nivel_grado')
      AND (
        ff.field_type = 'checkbox'
        OR (ff.field_type = 'select'
            AND jsonb_typeof(ff.options) = 'array'
            AND jsonb_array_length(ff.options) > 0)
      )
    ORDER BY ff.field_name, ff.field_order
  )
  SELECT
    e.section_id,
    f.field_name,
    CASE
      WHEN f.field_type = 'checkbox' THEN
        CASE WHEN lower(coalesce(s.form_data ->> f.field_name, '')) IN ('true', 't', '1', 'si', 'sí')
          THEN 'true' ELSE 'false' END
      ELSE nullif(btrim(s.form_data ->> f.field_name), '')
    END AS answer,
    s.sex,
    count(*)::integer AS total
  FROM public.enrollments e
  JOIN public.students s ON s.id = e.student_id
  CROSS JOIN fields f
  WHERE e.school_year_id = p_school_year_id
    AND e.school_id = p_school_id
  GROUP BY 1, 2, 3, 4;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_enrollment_demographics(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_enrollment_answer_breakdown(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_enrollment_demographics(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enrollment_answer_breakdown(uuid, uuid) TO authenticated;
