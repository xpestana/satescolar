
CREATE OR REPLACE FUNCTION public.create_default_form_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_basicos_id uuid;
  v_student_fisicos_id uuid;
  v_student_salud_id uuid;
  v_student_adicional_id uuid;
  v_rep_basicos_id uuid;
  v_rep_profesionales_id uuid;
  v_rep_adicional_id uuid;
  v_teacher_basicos_id uuid;
  v_teacher_contacto_id uuid;
  v_teacher_empleo_id uuid;
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
     '["student:nivel_grado","custom:grupo_asignado","custom:tipo_de_estudiante","custom:fecha_de_inscripcion"]'::jsonb,
     'fields', ''),
    (NEW.id, 'Observaciones', 5, '[]'::jsonb, 'text', ''),
    (NEW.id, 'Compromiso del Representante', 6, '[]'::jsonb, 'text',
     E'Hago constar por medio de la presente, que he leído, acepto y me comprometo a cumplir las condiciones establecidas en el contrato de Prestación de Servicio educativo para el año escolar que se indica en esta planilla, así como los deberes y obligaciones conforme a las leyes y reglamentos vigentes del Estado Venezolano. Del mismo modo, mi representado y yo, nos comprometemos a respetar los acuerdos de Convivencia de la Institución.\n\nImportante: El Proceso de Inscripción se concretará una vez efectuado el pago por concepto de inscripción y primer mes, la consignación física de la Planilla de Registro y firma del Contrato de Prestación de Servicios Educativos.')
  ON CONFLICT DO NOTHING;

  -- Student groups
  INSERT INTO public.form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student', 'Datos Básicos', 'Información básica del estudiante', 0)
  RETURNING id INTO v_student_basicos_id;

  INSERT INTO public.form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student', 'Datos Físicos', 'Tallas y medidas del estudiante', 1)
  RETURNING id INTO v_student_fisicos_id;

  INSERT INTO public.form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student', 'Salud', 'Información médica y de salud', 2)
  RETURNING id INTO v_student_salud_id;

  INSERT INTO public.form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student', 'Información Adicional', 'Información complementaria del estudiante', 3)
  RETURNING id INTO v_student_adicional_id;

  -- Representative groups
  INSERT INTO public.form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'representative', 'Datos Básicos', 'Información básica del representante', 0)
  RETURNING id INTO v_rep_basicos_id;

  INSERT INTO public.form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'representative', 'Datos Profesionales', 'Información laboral y profesional', 1)
  RETURNING id INTO v_rep_profesionales_id;

  INSERT INTO public.form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'representative', 'Información Adicional', 'Información complementaria', 2)
  RETURNING id INTO v_rep_adicional_id;

  -- Teacher groups
  INSERT INTO public.form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'teacher', 'Datos Básicos', 'Información básica del docente', 0)
  RETURNING id INTO v_teacher_basicos_id;

  INSERT INTO public.form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'teacher', 'Contacto', 'Información de contacto', 1)
  RETURNING id INTO v_teacher_contacto_id;

  INSERT INTO public.form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'teacher', 'Empleo', 'Información laboral', 2)
  RETURNING id INTO v_teacher_empleo_id;

  -- STUDENT FIELDS (46)
  INSERT INTO public.form_fields (school_id, form_type, field_name, field_label, field_type, field_order, is_required, is_visible, options, group_id)
  VALUES
    (NEW.id, 'student', 'tipo_documento', 'Tipo de documento', 'select', 1, false, true, '["V","E","CE"]'::jsonb, v_student_basicos_id),
    (NEW.id, 'student', 'documento', 'Documento', 'text', 2, false, true, NULL, v_student_basicos_id),
    (NEW.id, 'student', 'fecha_nacimiento', 'Fecha de nacimiento', 'date', 3, false, true, NULL, v_student_basicos_id),
    (NEW.id, 'student', 'genero', 'Género', 'select', 4, false, true, '["Masculino","Femenino"]'::jsonb, v_student_basicos_id),
    (NEW.id, 'student', 'primer_nombre', 'Primer nombre', 'text', 5, false, true, NULL, v_student_basicos_id),
    (NEW.id, 'student', 'segundo_nombre', 'Segundo nombre', 'text', 6, false, true, NULL, v_student_basicos_id),
    (NEW.id, 'student', 'primer_apellido', 'Primer apellido', 'text', 7, false, true, NULL, v_student_basicos_id),
    (NEW.id, 'student', 'segundo_apellido', 'Segundo apellido', 'text', 8, false, true, NULL, v_student_basicos_id),
    (NEW.id, 'student', 'pais_nacimiento', 'País', 'select', 9, false, true, '["Venezuela"]'::jsonb, NULL),
    (NEW.id, 'student', 'estado_nacimiento', 'Estado', 'select', 10, false, true, NULL, NULL),
    (NEW.id, 'student', 'municipio_nacimiento', 'Municipio', 'select', 11, false, true, NULL, NULL),
    (NEW.id, 'student', 'ciudad_nacimiento', 'Ciudad', 'select', 12, false, true, NULL, NULL),
    (NEW.id, 'student', 'parroquia_nacimiento', 'Parroquia', 'select', 13, false, true, NULL, NULL),
    (NEW.id, 'student', 'nivel_grado', 'Nivel/Grado/Año', 'select', 14, false, true, '["I Nivel","II Nivel","III Nivel","1er Grado","2do Grado","3er Grado","4to Grado","5to Grado","6to Grado","1er Año","2do Año","3er Año","4to Año","5to Año","6to Año"]'::jsonb, NULL),
    (NEW.id, 'student', 'celular', 'Celular', 'phone', 15, false, true, NULL, NULL),
    (NEW.id, 'student', 'tipo_sangre', 'Tipo de sangre', 'select', 16, false, true, '["A+","A-","B+","B-","AB+","AB-","O+","O-"]'::jsonb, v_student_fisicos_id),
    (NEW.id, 'student', 'usa_lentes', '¿Usa lentes?', 'select', 17, false, true, '["No","Sí"]'::jsonb, v_student_salud_id),
    (NEW.id, 'student', 'talla_camisa', 'Talla de camisa', 'select', 18, false, true, '["2","4","6","8","10","12","14","16","S","M","L","XL"]'::jsonb, v_student_fisicos_id),
    (NEW.id, 'student', 'talla_pantalon', 'Talla de pantalón', 'select', 19, false, true, '["2","4","6","8","10","12","14","16","S","M","L","XL"]'::jsonb, v_student_fisicos_id),
    (NEW.id, 'student', 'talla_calzado', 'Talla de calzado', 'text', 20, false, true, NULL, NULL),
    (NEW.id, 'student', 'altura_cm', 'Altura (cm)', 'number', 21, false, true, NULL, NULL),
    (NEW.id, 'student', 'peso_kg', 'Peso (kg)', 'number', 22, false, true, NULL, NULL),
    (NEW.id, 'student', 'ancho_pecho_cm', 'Ancho de pecho (cm)', 'number', 23, false, true, NULL, NULL),
    (NEW.id, 'student', 'ancho_brazo_cm', 'Ancho de brazo (cm)', 'number', 24, false, true, NULL, NULL),
    (NEW.id, 'student', 'ancho_cintura_cm', 'Ancho de cintura (cm)', 'number', 25, false, true, NULL, NULL),
    (NEW.id, 'student', 'compromiso_motor', '¿Tiene problemas motores?', 'select', 26, false, true, '["No","Sí"]'::jsonb, v_student_salud_id),
    (NEW.id, 'student', 'compromiso_cognitivo', '¿Tiene problemas cognitivos?', 'select', 27, false, true, '["No","Sí"]'::jsonb, v_student_salud_id),
    (NEW.id, 'student', 'compromiso_auditivo', '¿Tiene problemas auditivos?', 'select', 28, false, true, '["No","Sí"]'::jsonb, v_student_salud_id),
    (NEW.id, 'student', 'compromiso_visual', '¿Tiene problemas visuales?', 'select', 29, false, true, '["No","Sí"]'::jsonb, v_student_salud_id),
    (NEW.id, 'student', 'compromiso_lenguaje', '¿Tiene problemas de lenguaje?', 'select', 30, false, true, '["No","Sí"]'::jsonb, NULL),
    (NEW.id, 'student', 'informe_medico_compromisos', '¿Posee informe médico de compromisos?', 'select', 31, false, true, '["No","Sí"]'::jsonb, NULL),
    (NEW.id, 'student', 'impedimento_educacion_fisica', '¿Tiene impedimento para practicar Educación Física?', 'select', 32, false, true, '["No","Sí"]'::jsonb, NULL),
    (NEW.id, 'student', 'intervenido_quirurgicamente', '¿Ha sido intervenido quirúrgicamente?', 'select', 33, false, true, '["No","Sí"]'::jsonb, NULL),
    (NEW.id, 'student', 'problemas_respiratorios', '¿Tiene problemas respiratorios?', 'select', 34, false, true, '["No","Sí"]'::jsonb, NULL),
    (NEW.id, 'student', 'diabetes', '¿Tiene diabetes?', 'select', 35, false, true, '["No","Sí"]'::jsonb, v_student_salud_id),
    (NEW.id, 'student', 'epilepsia', '¿Tiene epilepsia?', 'select', 36, false, true, '["No","Sí"]'::jsonb, v_student_salud_id),
    (NEW.id, 'student', 'alergias', 'Si el estudiante es alérgico por favor describa', 'textarea', 37, false, true, NULL, NULL),
    (NEW.id, 'student', 'otras_enfermedades', 'Describa si el estudiante padece o ha padecido alguna otra enfermedad', 'textarea', 38, false, true, NULL, NULL),
    (NEW.id, 'student', 'informe_medico_enfermedad', '¿Posee informe médico de alguna enfermedad?', 'select', 39, false, true, '["No","Sí"]'::jsonb, NULL),
    (NEW.id, 'student', 'tratamiento_horario_clases', '¿Recibe tratamiento médico en su horario de clases?', 'select', 40, false, true, '["No","Sí"]'::jsonb, NULL),
    (NEW.id, 'student', 'medicamentos_requeridos', 'En caso de requerir algún medicamento por favor indique', 'textarea', 41, false, true, NULL, NULL),
    (NEW.id, 'student', 'seguro_medico', 'Si el estudiante posee seguro médico por favor describa', 'textarea', 42, false, true, NULL, NULL),
    (NEW.id, 'student', 'situacion_matrimonial_padres', 'Situación matrimonial de los padres', 'select', 43, false, true, '["Matrimonio solo civil","Matrimonio eclesiástico","Concubinato","Separados","Divorciado (a)","Padre / Madre Soltero (a)","Viudo (a)","Otra"]'::jsonb, v_student_adicional_id),
    (NEW.id, 'student', 'quien_vive_alumno', '¿Quién vive con el alumno?', 'select', 44, false, true, '["Padres","Padres y Hermanos","Padres, Hermanos y Otros","Padres, Hermanos, Otros e Inquilinos","Otro"]'::jsonb, v_student_adicional_id),
    (NEW.id, 'student', 'religion_padres', 'Religión de los padres', 'select', 45, false, true, '["Ambos católicos","Ambos protestantes","Otra"]'::jsonb, v_student_adicional_id),
    (NEW.id, 'student', 'compromisos_religiosos', 'Compromisos religiosos del estudiante', 'select', 46, false, true, '["Bautizado","Primera comunión","Confirmación","Otro"]'::jsonb, v_student_adicional_id);

  -- REPRESENTATIVE FIELDS (18)
  INSERT INTO public.form_fields (school_id, form_type, field_name, field_label, field_type, field_order, is_required, is_visible, options, group_id)
  VALUES
    (NEW.id, 'representative', 'tipo_documento', 'Tipo de documento', 'select', 1, false, true, '["V","E"]'::jsonb, v_rep_basicos_id),
    (NEW.id, 'representative', 'documento', 'Documento', 'text', 2, false, true, NULL, v_rep_basicos_id),
    (NEW.id, 'representative', 'numero_contacto', 'Número de Contacto del Representante', 'phone', 3, false, true, NULL, NULL),
    (NEW.id, 'representative', 'primer_nombre', 'Primer nombre', 'text', 4, false, true, NULL, v_rep_basicos_id),
    (NEW.id, 'representative', 'segundo_nombre', 'Segundo nombre', 'text', 5, false, true, NULL, v_rep_basicos_id),
    (NEW.id, 'representative', 'primer_apellido', 'Primer apellido', 'text', 6, false, true, NULL, v_rep_basicos_id),
    (NEW.id, 'representative', 'segundo_apellido', 'Segundo apellido', 'text', 7, false, true, NULL, v_rep_basicos_id),
    (NEW.id, 'representative', 'fecha_nacimiento', 'Fecha de nacimiento', 'date', 8, false, true, NULL, v_rep_basicos_id),
    (NEW.id, 'representative', 'pais_nacimiento', 'País de nacimiento', 'select', 9, false, true, '["Venezuela","Colombia","Ecuador","Perú","Brasil","Chile","Argentina","México","España","Estados Unidos","Otro"]'::jsonb, NULL),
    (NEW.id, 'representative', 'correo_electronico', 'Correo Electrónico', 'email', 10, false, true, NULL, v_rep_basicos_id),
    (NEW.id, 'representative', 'nivel_instruccion', 'Nivel de instrucción', 'select', 11, false, true, '["Sin instrucción","Primaria incompleta","Primaria completa","Secundaria incompleta","Secundaria completa","Técnico superior","Universitario incompleto","Universitario completo","Postgrado"]'::jsonb, v_rep_profesionales_id),
    (NEW.id, 'representative', 'otros_cursos', 'Otros cursos realizados', 'text', 12, false, true, NULL, NULL),
    (NEW.id, 'representative', 'que_trabajo_realiza', '¿Qué trabajo realiza?', 'text', 13, false, true, NULL, NULL),
    (NEW.id, 'representative', 'profesion_ocupacion', 'Profesión, ocupación u oficio', 'text', 14, false, true, NULL, NULL),
    (NEW.id, 'representative', 'empresa_trabajo', 'Empresa donde trabaja (nombre y dirección)', 'text', 15, false, true, NULL, NULL),
    (NEW.id, 'representative', 'es_dueno', '¿Es dueño?', 'select', 16, false, true, '["No","Sí"]'::jsonb, NULL),
    (NEW.id, 'representative', 'genero', 'Género', 'select', 17, false, true, '["Masculino","Femenino"]'::jsonb, v_rep_basicos_id),
    (NEW.id, 'representative', 'parentesco_estudiantes', 'Parentesco con los estudiantes', 'select', 18, false, true, '["Padre","Madre","Abuelo(a)","Tío(a)","Hermano(a)","Tutor legal","Otro"]'::jsonb, NULL);

  -- TEACHER FIELDS (17)
  INSERT INTO public.form_fields (school_id, form_type, field_name, field_label, field_type, field_order, is_required, is_visible, options, group_id)
  VALUES
    (NEW.id, 'teacher', 'tipo_documento', 'Tipo', 'select', 0, true, true, '["V","E","P"]'::jsonb, v_teacher_basicos_id),
    (NEW.id, 'teacher', 'documento', 'Nro de Documento', 'text', 1, true, true, NULL, v_teacher_basicos_id),
    (NEW.id, 'teacher', 'primer_nombre', 'Primer Nombre', 'text', 2, true, true, NULL, v_teacher_basicos_id),
    (NEW.id, 'teacher', 'segundo_nombre', 'Segundo Nombre', 'text', 3, false, true, NULL, v_teacher_basicos_id),
    (NEW.id, 'teacher', 'primer_apellido', 'Primer Apellido', 'text', 4, true, true, NULL, v_teacher_basicos_id),
    (NEW.id, 'teacher', 'segundo_apellido', 'Segundo Apellido', 'text', 5, true, true, NULL, v_teacher_basicos_id),
    (NEW.id, 'teacher', 'sexo', 'Sexo', 'select', 6, true, true, '["Masculino","Femenino"]'::jsonb, v_teacher_basicos_id),
    (NEW.id, 'teacher', 'fecha_nacimiento', 'Fecha de Nacimiento', 'date', 7, true, true, NULL, v_teacher_basicos_id),
    (NEW.id, 'teacher', 'pais_nacimiento', 'País', 'select', 8, true, true, '["Venezuela","Colombia","Ecuador","Perú","Chile","Brasil","Argentina","México","Otro"]'::jsonb, v_teacher_basicos_id),
    (NEW.id, 'teacher', 'numero_contacto', 'Celular', 'phone', 9, true, true, NULL, v_teacher_contacto_id),
    (NEW.id, 'teacher', 'correo_electronico', 'Correo Electrónico', 'email', 10, true, true, NULL, v_teacher_contacto_id),
    (NEW.id, 'teacher', 'cargo', 'Cargo', 'text', 11, true, true, NULL, v_teacher_empleo_id),
    (NEW.id, 'teacher', 'area_administrativa', 'Área Administrativa Adscrita', 'select', 12, true, true, '["Dirección","Subdirección","Coordinación Académica","Coordinación de Evaluación","Coordinación de Control de Estudios","Departamento de Orientación","Departamento de Bienestar Estudiantil","Departamento de Educación Física","Otro"]'::jsonb, v_teacher_empleo_id),
    (NEW.id, 'teacher', 'fecha_ingreso', 'Fecha de Empleo', 'date', 13, true, true, NULL, v_teacher_empleo_id),
    (NEW.id, 'teacher', 'nivel_instruccion', 'Nivel de Instrucción', 'select', 14, false, true, '["Técnico","Universitario","Especialización","Maestría","Doctorado"]'::jsonb, v_teacher_empleo_id),
    (NEW.id, 'teacher', 'titulo', 'Título Obtenido', 'text', 15, false, true, NULL, v_teacher_empleo_id),
    (NEW.id, 'teacher', 'observaciones', 'Observaciones', 'textarea', 16, false, true, NULL, v_teacher_empleo_id);

  -- Populate default primary indicators
  PERFORM populate_default_primary_indicators(NEW.id);

  RETURN NEW;
END;
$function$;
