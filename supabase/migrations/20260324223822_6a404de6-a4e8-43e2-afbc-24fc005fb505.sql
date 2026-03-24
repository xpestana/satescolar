CREATE OR REPLACE FUNCTION public.create_default_form_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  -- Default form fields
  INSERT INTO public.form_fields (school_id, form_type, field_name, field_label, field_type, field_order, is_required, is_visible, options)
  VALUES
    (NEW.id, 'representative', 'primer_nombre', 'Primer Nombre', 'text', 1, true, true, NULL),
    (NEW.id, 'representative', 'segundo_nombre', 'Segundo Nombre', 'text', 2, false, true, NULL),
    (NEW.id, 'representative', 'primer_apellido', 'Primer Apellido', 'text', 3, true, true, NULL),
    (NEW.id, 'representative', 'segundo_apellido', 'Segundo Apellido', 'text', 4, false, true, NULL),
    (NEW.id, 'representative', 'documento', 'Cédula / Documento', 'text', 5, true, true, NULL),
    (NEW.id, 'representative', 'fecha_nacimiento', 'Fecha de Nacimiento', 'date', 6, false, true, NULL),
    (NEW.id, 'representative', 'pais_nacimiento', 'País de Nacimiento', 'text', 7, false, true, NULL),
    (NEW.id, 'representative', 'numero_contacto', 'Número de Contacto', 'phone', 8, false, true, NULL),
    (NEW.id, 'representative', 'parentesco', 'Parentesco', 'select', 9, false, true, '["Padre", "Madre", "Abuelo(a)", "Tío(a)", "Hermano(a)", "Tutor Legal", "Otro"]'::jsonb),
    (NEW.id, 'representative', 'profesion', 'Profesión', 'text', 10, false, true, NULL),
    (NEW.id, 'representative', 'lugar_trabajo', 'Lugar de Trabajo', 'text', 11, false, true, NULL),
    (NEW.id, 'student', 'primer_nombre', 'Primer Nombre', 'text', 1, true, true, NULL),
    (NEW.id, 'student', 'segundo_nombre', 'Segundo Nombre', 'text', 2, false, true, NULL),
    (NEW.id, 'student', 'primer_apellido', 'Primer Apellido', 'text', 3, true, true, NULL),
    (NEW.id, 'student', 'segundo_apellido', 'Segundo Apellido', 'text', 4, false, true, NULL),
    (NEW.id, 'student', 'documento', 'Cédula / Documento', 'text', 5, true, true, NULL),
    (NEW.id, 'student', 'fecha_nacimiento', 'Fecha de Nacimiento', 'date', 6, true, true, NULL),
    (NEW.id, 'student', 'ciudad_nacimiento', 'Ciudad de Nacimiento', 'text', 7, false, true, NULL),
    (NEW.id, 'student', 'email', 'Correo Electrónico', 'email', 8, false, true, NULL),
    (NEW.id, 'student', 'numero_contacto', 'Número de Contacto', 'phone', 9, false, true, NULL),
    (NEW.id, 'student', 'grado', 'Nivel / Grado', 'select', 10, true, true, 
     '["Preescolar 1er Nivel","Preescolar 2do Nivel","Preescolar 3er Nivel","1er Grado","2do Grado","3er Grado","4to Grado","5to Grado","6to Grado","1er Año","2do Año","3er Año","4to Año","5to Año","6to Año"]'::jsonb),
    (NEW.id, 'teacher', 'primer_nombre', 'Primer Nombre', 'text', 1, true, true, NULL),
    (NEW.id, 'teacher', 'segundo_nombre', 'Segundo Nombre', 'text', 2, false, true, NULL),
    (NEW.id, 'teacher', 'primer_apellido', 'Primer Apellido', 'text', 3, true, true, NULL),
    (NEW.id, 'teacher', 'segundo_apellido', 'Segundo Apellido', 'text', 4, false, true, NULL),
    (NEW.id, 'teacher', 'documento', 'Cédula / Documento', 'text', 5, true, true, NULL),
    (NEW.id, 'teacher', 'fecha_nacimiento', 'Fecha de Nacimiento', 'date', 6, false, true, NULL),
    (NEW.id, 'teacher', 'numero_contacto', 'Número de Contacto', 'phone', 7, false, true, NULL),
    (NEW.id, 'teacher', 'email', 'Correo Electrónico', 'email', 8, false, true, NULL),
    (NEW.id, 'teacher', 'profesion', 'Profesión / Especialidad', 'text', 9, false, true, NULL)
  ON CONFLICT DO NOTHING;

  -- Default form field groups
  INSERT INTO public.form_field_groups (school_id, form_type, name, description, display_order)
  VALUES
    (NEW.id, 'student', 'Datos Básicos', 'Información básica del estudiante', 1),
    (NEW.id, 'representative', 'Datos Básicos', 'Información básica del representante', 1),
    (NEW.id, 'teacher', 'Datos Básicos', 'Información básica del docente', 1)
  ON CONFLICT DO NOTHING;

  -- Assign form fields to groups
  UPDATE public.form_fields
  SET group_id = (
    SELECT id FROM public.form_field_groups
    WHERE school_id = NEW.id AND form_type = form_fields.form_type AND name = 'Datos Básicos'
    LIMIT 1
  )
  WHERE school_id = NEW.id AND group_id IS NULL;

  -- Populate default primary indicators
  PERFORM populate_default_primary_indicators(NEW.id);

  RETURN NEW;
END;
$function$;