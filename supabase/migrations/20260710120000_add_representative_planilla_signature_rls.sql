-- Paridad de la planilla de inscripción entre school y representante.
-- El representante ya tiene políticas SELECT para enrollment_planilla_sections y
-- planilla_general_config (migración 20260221231522), pero le faltaba acceso de lectura a
-- planilla_signature_blocks (los bloques de firma no se renderizaban en su planilla) y a
-- form_fields (labels configurados de la planilla). Se replica el patrón family_schools + families.

-- Permitir a representantes leer los bloques de firma de la planilla de su colegio
DROP POLICY IF EXISTS "Representatives can view signature blocks" ON public.planilla_signature_blocks;
CREATE POLICY "Representatives can view signature blocks"
ON public.planilla_signature_blocks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM family_schools fs
    JOIN families f ON f.id = fs.family_id
    WHERE fs.school_id = planilla_signature_blocks.school_id
    AND f.user_id = auth.uid()
  )
);

-- Permitir a representantes leer los campos de formulario (labels) de su colegio
DROP POLICY IF EXISTS "Representatives can view form fields" ON public.form_fields;
CREATE POLICY "Representatives can view form fields"
ON public.form_fields
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM family_schools fs
    JOIN families f ON f.id = fs.family_id
    WHERE fs.school_id = form_fields.school_id
    AND f.user_id = auth.uid()
  )
);
