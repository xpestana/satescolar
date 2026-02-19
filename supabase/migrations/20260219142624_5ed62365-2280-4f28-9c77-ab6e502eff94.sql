-- Update default signature_lines to only include Representante and Director
ALTER TABLE public.planilla_general_config 
  ALTER COLUMN signature_lines SET DEFAULT '["Firma del Representante", "Firma del Director(a)"]'::jsonb;

-- Also update the trigger function that creates defaults for new schools
CREATE OR REPLACE FUNCTION public.create_default_form_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Insert default planilla general config with 2 signatures
  INSERT INTO public.planilla_general_config (school_id, signature_lines)
  VALUES (NEW.id, '["Firma del Representante", "Firma del Director(a)"]'::jsonb)
  ON CONFLICT (school_id) DO NOTHING;

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

  -- Keep existing default form fields logic
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
