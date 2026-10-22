-- Nuevo tipo de documento "P" (pasaporte) en el campo `tipo_documento` de los formularios de
-- estudiantes, representantes y docentes.
--
-- 1. Colegios existentes: se agrega "P" al final de las opciones de su `tipo_documento`.
-- 2. Colegios nuevos y campos creados después (trigger de alta de colegio, constructor de
--    formularios, importaciones): un trigger BEFORE INSERT en `form_fields` agrega "P" a todo
--    `tipo_documento` que se cree. Así no depende de cómo esté escrito `create_default_form_fields`.
--
-- No toca `students`, `representatives` ni `teachers`: los documentos ya guardados no cambian.
-- Idempotente: se puede volver a ejecutar sin duplicar "P".

-- Opciones de `tipo_documento` con "P" incluida. Sin opciones válidas, las de por defecto del tipo
-- de formulario. Si ya tiene "P" (o la etiqueta larga "Pasaporte"), se devuelven igual.
CREATE OR REPLACE FUNCTION public.with_passport_document_type(_options jsonb, _form_type text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT CASE
    WHEN _options IS NULL OR jsonb_typeof(_options) <> 'array' OR jsonb_array_length(_options) = 0 THEN
      CASE WHEN _form_type = 'student' THEN '["V","E","CE","P"]'::jsonb ELSE '["V","E","P"]'::jsonb END
    WHEN _options ? 'P' OR _options ? 'Pasaporte' THEN _options
    ELSE _options || '["P"]'::jsonb
  END
$function$;

CREATE OR REPLACE FUNCTION public.add_passport_document_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.field_name = 'tipo_documento' AND NEW.field_type = 'select' THEN
    NEW.options := public.with_passport_document_type(NEW.options, NEW.form_type::text);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS add_passport_document_type ON public.form_fields;
CREATE TRIGGER add_passport_document_type
BEFORE INSERT ON public.form_fields
FOR EACH ROW
EXECUTE FUNCTION public.add_passport_document_type();

-- Colegios existentes.
UPDATE public.form_fields
SET options = public.with_passport_document_type(options, form_type::text)
WHERE field_name = 'tipo_documento'
  AND field_type = 'select'
  AND options IS DISTINCT FROM public.with_passport_document_type(options, form_type::text);
