
-- Create planilla_signature_blocks table
CREATE TABLE public.planilla_signature_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  signature_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planilla_signature_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage signature blocks" ON public.planilla_signature_blocks FOR ALL USING (is_admin());
CREATE POLICY "School users can view their signature blocks" ON public.planilla_signature_blocks FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = planilla_signature_blocks.school_id));
CREATE POLICY "School users can insert their signature blocks" ON public.planilla_signature_blocks FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = planilla_signature_blocks.school_id));
CREATE POLICY "School users can update their signature blocks" ON public.planilla_signature_blocks FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = planilla_signature_blocks.school_id));
CREATE POLICY "School users can delete their signature blocks" ON public.planilla_signature_blocks FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = planilla_signature_blocks.school_id));

CREATE TRIGGER update_planilla_signature_blocks_updated_at
BEFORE UPDATE ON public.planilla_signature_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add signature_block_id to enrollment_planilla_sections
ALTER TABLE public.enrollment_planilla_sections
  ADD COLUMN IF NOT EXISTS signature_block_id uuid REFERENCES public.planilla_signature_blocks(id) ON DELETE SET NULL;

-- Migrate existing signature_lines from planilla_general_config to blocks
INSERT INTO public.planilla_signature_blocks (school_id, name, signature_lines, display_order)
SELECT
  school_id,
  'Firmas generales',
  signature_lines,
  0
FROM public.planilla_general_config
WHERE signature_lines IS NOT NULL
  AND jsonb_typeof(signature_lines) = 'array'
  AND jsonb_array_length(signature_lines) > 0;

-- Update create_default_form_fields trigger to also create a default signature block for new schools
CREATE OR REPLACE FUNCTION public.create_default_form_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Insert default planilla general config
  INSERT INTO public.planilla_general_config (school_id, signature_lines)
  VALUES (NEW.id, '["Firma del Representante", "Firma del Director(a)"]'::jsonb)
  ON CONFLICT (school_id) DO NOTHING;

  -- Insert default signature block
  INSERT INTO public.planilla_signature_blocks (school_id, name, signature_lines, display_order)
  VALUES (NEW.id, 'Firmas generales', '["Firma del Representante", "Firma del Director(a)"]'::jsonb, 0)
  ON CONFLICT DO NOTHING;

  -- Insert default enrollment planilla sections
  INSERT INTO public.enrollment_planilla_sections (school_id, title, display_order, field_names, section_type, section_text)
  VALUES
    (NEW.id, 'Datos Personales del Estudiante', 1,
     '["student:primer_apellido","student:segundo_apellido","student:primer_nombre","student:segundo_nombre","student:documento","student:email","student:numero_contacto","student:_edad","student:fecha_nacimiento","student:ciudad_nacimiento"]'::jsonb,
     'fields', ''),
    (NEW.id, 'Datos de Familia', 2,
     '["family:email","family:contact_phone","family:address","family:location_full"]'::jsonb,
     'fields', ''),
    (NEW.id, 'Datos del Representante', 3,
     '["representative:documento","representative:primer_apellido","representative:segundo_apellido","representative:_edad","representative:pais_nacimiento","representative:fecha_nacimiento","representative:numero_contacto"]'::jsonb,
     'fields', ''),
    (NEW.id, 'Información para la Inscripción', 4,
     '["student:grado","custom:grupo_asignado","custom:tipo_de_estudiante","custom:fecha_de_inscripcion"]'::jsonb,
     'fields', ''),
    (NEW.id, 'Observaciones', 5, '[]'::jsonb, 'text', ''),
    (NEW.id, 'Compromiso del Representante', 6, '[]'::jsonb, 'text',
     E'Hago constar por medio de la presente, que he leído, acepto y me comprometo a cumplir las condiciones establecidas en el contrato de Prestación de Servicio educativo para el año escolar que se indica en esta planilla, así como los deberes y obligaciones conforme a las leyes y reglamentos vigentes del Estado Venezolano. Del mismo modo, mi representado y yo, nos comprometemos a respetar los acuerdos de Convivencia de la Institución.\n\nImportante: El Proceso de Inscripción se concretará una vez efectuado el pago por concepto de inscripción y primer mes, la consignación física de la Planilla de Registro y firma del Contrato de Prestación de Servicios Educativos.')
  ON CONFLICT DO NOTHING;

  -- Insert default form fields
  INSERT INTO public.form_fields (school_id, form_type, field_name, field_label, field_type, field_order, is_required, is_visible)
  VALUES
    (NEW.id, 'representative', 'primer_nombre', 'Primer Nombre', 'text', 1, true, true),
    (NEW.id, 'representative', 'segundo_nombre', 'Segundo Nombre', 'text', 2, false, true),
    (NEW.id, 'representative', 'primer_apellido', 'Primer Apellido', 'text', 3, true, true),
    (NEW.id, 'representative', 'segundo_apellido', 'Segundo Apellido', 'text', 4, false, true),
    (NEW.id, 'representative', 'documento', 'Cédula / Documento', 'text', 5, true, true),
    (NEW.id, 'representative', 'fecha_nacimiento', 'Fecha de Nacimiento', 'date', 6, false, true),
    (NEW.id, 'representative', 'pais_nacimiento', 'País de Nacimiento', 'text', 7, false, true),
    (NEW.id, 'representative', 'numero_contacto', 'Número de Contacto', 'phone', 8, false, true),
    (NEW.id, 'representative', 'parentesco', 'Parentesco', 'select', 9, false, true),
    (NEW.id, 'representative', 'profesion', 'Profesión', 'text', 10, false, true),
    (NEW.id, 'representative', 'lugar_trabajo', 'Lugar de Trabajo', 'text', 11, false, true),
    (NEW.id, 'student', 'primer_nombre', 'Primer Nombre', 'text', 1, true, true),
    (NEW.id, 'student', 'segundo_nombre', 'Segundo Nombre', 'text', 2, false, true),
    (NEW.id, 'student', 'primer_apellido', 'Primer Apellido', 'text', 3, true, true),
    (NEW.id, 'student', 'segundo_apellido', 'Segundo Apellido', 'text', 4, false, true),
    (NEW.id, 'student', 'documento', 'Cédula / Documento', 'text', 5, true, true),
    (NEW.id, 'student', 'fecha_nacimiento', 'Fecha de Nacimiento', 'date', 6, true, true),
    (NEW.id, 'student', 'ciudad_nacimiento', 'Ciudad de Nacimiento', 'text', 7, false, true),
    (NEW.id, 'student', 'email', 'Correo Electrónico', 'email', 8, false, true),
    (NEW.id, 'student', 'numero_contacto', 'Número de Contacto', 'phone', 9, false, true),
    (NEW.id, 'student', 'grado', 'Grado', 'text', 10, false, true),
    (NEW.id, 'teacher', 'primer_nombre', 'Primer Nombre', 'text', 1, true, true),
    (NEW.id, 'teacher', 'segundo_nombre', 'Segundo Nombre', 'text', 2, false, true),
    (NEW.id, 'teacher', 'primer_apellido', 'Primer Apellido', 'text', 3, true, true),
    (NEW.id, 'teacher', 'segundo_apellido', 'Segundo Apellido', 'text', 4, false, true),
    (NEW.id, 'teacher', 'documento', 'Cédula / Documento', 'text', 5, true, true),
    (NEW.id, 'teacher', 'fecha_nacimiento', 'Fecha de Nacimiento', 'date', 6, false, true),
    (NEW.id, 'teacher', 'numero_contacto', 'Número de Contacto', 'phone', 7, false, true),
    (NEW.id, 'teacher', 'especialidad', 'Especialidad', 'text', 8, false, true),
    (NEW.id, 'teacher', 'titulo', 'Título Profesional', 'text', 9, false, true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
