
-- Add section_type and section_text columns
ALTER TABLE public.enrollment_planilla_sections 
  ADD COLUMN section_type text NOT NULL DEFAULT 'fields',
  ADD COLUMN section_text text DEFAULT '';

-- Update the create_default_form_fields trigger function to also insert default planilla sections
CREATE OR REPLACE FUNCTION public.create_default_form_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  student_basic_group_id uuid;
  student_physical_group_id uuid;
  student_medical_group_id uuid;
  student_additional_group_id uuid;
  rep_basic_group_id uuid;
  rep_professional_group_id uuid;
  rep_additional_group_id uuid;
  teacher_basic_group_id uuid;
  teacher_contact_group_id uuid;
  teacher_employment_group_id uuid;
BEGIN
  -- Student groups
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student', 'Datos Básicos', 'Información básica del estudiante', 0) RETURNING id INTO student_basic_group_id;
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student', 'Datos Físicos', 'Características físicas del estudiante', 1) RETURNING id INTO student_physical_group_id;
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student', 'Datos Médicos', 'Información médica del estudiante', 2) RETURNING id INTO student_medical_group_id;
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student', 'Información Adicional', 'Datos adicionales del estudiante', 3) RETURNING id INTO student_additional_group_id;
  
  -- Representative groups
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'representative', 'Datos Básicos', 'Información básica del representante', 0) RETURNING id INTO rep_basic_group_id;
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'representative', 'Datos Profesionales', 'Información laboral y profesional', 1) RETURNING id INTO rep_professional_group_id;
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'representative', 'Información Adicional', 'Datos adicionales del representante', 2) RETURNING id INTO rep_additional_group_id;

  -- Teacher groups
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'teacher', 'Datos Básicos', 'Información básica del docente', 0) RETURNING id INTO teacher_basic_group_id;
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'teacher', 'Contacto', 'Información de contacto del docente', 1) RETURNING id INTO teacher_contact_group_id;
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'teacher', 'Empleo', 'Información laboral del docente', 2) RETURNING id INTO teacher_employment_group_id;

  -- Student fields
  INSERT INTO form_fields (school_id, form_type, field_name, field_label, field_type, is_required, field_order, options, group_id) VALUES
    (NEW.id, 'student', 'tipo_documento', 'Tipo de Documento', 'select', false, 0, '["V", "E", "CE"]', student_basic_group_id),
    (NEW.id, 'student', 'documento', 'Documento', 'text', false, 1, null, student_basic_group_id),
    (NEW.id, 'student', 'primer_nombre', 'Primer Nombre', 'text', false, 2, null, student_basic_group_id),
    (NEW.id, 'student', 'segundo_nombre', 'Segundo Nombre', 'text', false, 3, null, student_basic_group_id),
    (NEW.id, 'student', 'primer_apellido', 'Primer Apellido', 'text', false, 4, null, student_basic_group_id),
    (NEW.id, 'student', 'segundo_apellido', 'Segundo Apellido', 'text', false, 5, null, student_basic_group_id),
    (NEW.id, 'student', 'fecha_nacimiento', 'Fecha de Nacimiento', 'date', false, 6, null, student_basic_group_id),
    (NEW.id, 'student', 'genero', 'Género', 'select', false, 7, '["Masculino", "Femenino"]', student_basic_group_id),
    (NEW.id, 'student', 'grado', 'Grado', 'select', false, 8, '["Pre-Maternal", "Maternal", "1er Nivel", "2do Nivel", "3er Nivel", "1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado", "1er Año", "2do Año", "3er Año", "4to Año", "5to Año"]', student_basic_group_id),
    (NEW.id, 'student', 'seccion', 'Sección', 'text', false, 9, null, student_basic_group_id),
    (NEW.id, 'student', 'email', 'Correo Electrónico', 'email', false, 10, null, student_basic_group_id),
    (NEW.id, 'student', 'tipo_sangre', 'Tipo de Sangre', 'select', false, 11, '["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]', student_physical_group_id),
    (NEW.id, 'student', 'talla_camisa', 'Talla de Camisa', 'select', false, 12, '["2", "4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL"]', student_physical_group_id),
    (NEW.id, 'student', 'talla_pantalon', 'Talla de Pantalón', 'select', false, 13, '["2", "4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL"]', student_physical_group_id),
    (NEW.id, 'student', 'talla_zapato', 'Talla de Zapato', 'text', false, 14, null, student_physical_group_id),
    (NEW.id, 'student', 'peso', 'Peso (Kg)', 'number', false, 15, null, student_physical_group_id),
    (NEW.id, 'student', 'estatura', 'Estatura (cm)', 'number', false, 16, null, student_physical_group_id),
    (NEW.id, 'student', 'color_cabello', 'Color de Cabello', 'text', false, 17, null, student_physical_group_id),
    (NEW.id, 'student', 'color_ojos', 'Color de Ojos', 'text', false, 18, null, student_physical_group_id),
    (NEW.id, 'student', 'tez', 'Tez', 'select', false, 19, '["Clara", "Morena Clara", "Morena", "Oscura"]', student_physical_group_id),
    (NEW.id, 'student', 'contextura', 'Contextura', 'select', false, 20, '["Delgada", "Normal", "Robusta"]', student_physical_group_id),
    (NEW.id, 'student', 'senales_particulares', 'Señales Particulares', 'textarea', false, 21, null, student_physical_group_id),
    (NEW.id, 'student', 'condicion_medica', 'Condición Médica', 'textarea', false, 22, null, student_medical_group_id),
    (NEW.id, 'student', 'alergias', 'Alergias', 'textarea', false, 23, null, student_medical_group_id),
    (NEW.id, 'student', 'medicamentos', 'Medicamentos', 'textarea', false, 24, null, student_medical_group_id),
    (NEW.id, 'student', 'hospital_clinica', 'Hospital o Clínica', 'text', false, 25, null, student_medical_group_id),
    (NEW.id, 'student', 'medico_tratante', 'Médico Tratante', 'text', false, 26, null, student_medical_group_id),
    (NEW.id, 'student', 'vacunas_pendientes', 'Vacunas Pendientes', 'textarea', false, 27, null, student_medical_group_id),
    (NEW.id, 'student', 'discapacidad', 'Discapacidad', 'select', false, 28, '["Ninguna", "Visual", "Auditiva", "Motora", "Intelectual", "Otra"]', student_medical_group_id),
    (NEW.id, 'student', 'lateralidad', 'Lateralidad', 'select', false, 29, '["Diestro", "Zurdo", "Ambidiestro"]', student_medical_group_id),
    (NEW.id, 'student', 'pais_nacimiento', 'País de Nacimiento', 'select', false, 30, '["Venezuela", "Colombia", "Ecuador", "Perú", "Chile", "Brasil", "Argentina", "México", "Otro"]', student_additional_group_id),
    (NEW.id, 'student', 'estado_nacimiento', 'Estado de Nacimiento', 'text', false, 31, null, student_additional_group_id),
    (NEW.id, 'student', 'ciudad_nacimiento', 'Ciudad de Nacimiento', 'text', false, 32, null, student_additional_group_id),
    (NEW.id, 'student', 'plantel_procedencia', 'Plantel de Procedencia', 'text', false, 33, null, student_additional_group_id),
    (NEW.id, 'student', 'repitiente', 'Repitiente', 'select', false, 34, '["Sí", "No"]', student_additional_group_id),
    (NEW.id, 'student', 'observaciones_conducta', 'Observaciones de Conducta', 'textarea', false, 35, null, student_additional_group_id),
    (NEW.id, 'student', 'con_quien_vive', 'Con Quién Vive', 'select', false, 36, '["Ambos padres", "Solo madre", "Solo padre", "Abuelos", "Otro familiar", "Otro"]', student_additional_group_id),
    (NEW.id, 'student', 'cantidad_hermanos', 'Cantidad de Hermanos', 'number', false, 37, null, student_additional_group_id),
    (NEW.id, 'student', 'posicion_hermanos', 'Posición entre Hermanos', 'text', false, 38, null, student_additional_group_id),
    (NEW.id, 'student', 'actividades_extraescolares', 'Actividades Extraescolares', 'textarea', false, 39, null, student_additional_group_id),
    (NEW.id, 'student', 'dispositivos_tecnologicos', 'Dispositivos Tecnológicos', 'select', false, 40, '["Computadora", "Tablet", "Teléfono", "Ninguno", "Varios"]', student_additional_group_id),
    (NEW.id, 'student', 'acceso_internet', 'Acceso a Internet', 'select', false, 41, '["Sí", "No"]', student_additional_group_id),
    (NEW.id, 'student', 'beca', 'Beca', 'select', false, 42, '["Sí", "No"]', student_additional_group_id),
    (NEW.id, 'student', 'tipo_beca', 'Tipo de Beca', 'text', false, 43, null, student_additional_group_id),
    (NEW.id, 'student', 'porcentaje_beca', 'Porcentaje de Beca', 'number', false, 44, null, student_additional_group_id),
    (NEW.id, 'student', 'observaciones', 'Observaciones', 'textarea', false, 45, null, student_additional_group_id);

  -- Representative fields
  INSERT INTO form_fields (school_id, form_type, field_name, field_label, field_type, is_required, field_order, options, group_id) VALUES
    (NEW.id, 'representative', 'tipo_documento', 'Tipo de Documento', 'select', false, 0, '["V", "E", "P"]', rep_basic_group_id),
    (NEW.id, 'representative', 'documento', 'Nro de Documento', 'text', false, 1, null, rep_basic_group_id),
    (NEW.id, 'representative', 'primer_nombre', 'Primer Nombre', 'text', false, 2, null, rep_basic_group_id),
    (NEW.id, 'representative', 'segundo_nombre', 'Segundo Nombre', 'text', false, 3, null, rep_basic_group_id),
    (NEW.id, 'representative', 'primer_apellido', 'Primer Apellido', 'text', false, 4, null, rep_basic_group_id),
    (NEW.id, 'representative', 'segundo_apellido', 'Segundo Apellido', 'text', false, 5, null, rep_basic_group_id),
    (NEW.id, 'representative', 'parentesco', 'Parentesco', 'select', false, 6, '["Padre", "Madre", "Abuelo(a)", "Tío(a)", "Hermano(a)", "Otro"]', rep_basic_group_id),
    (NEW.id, 'representative', 'sexo', 'Sexo', 'select', false, 7, '["Masculino", "Femenino"]', rep_basic_group_id),
    (NEW.id, 'representative', 'fecha_nacimiento', 'Fecha de Nacimiento', 'date', false, 8, null, rep_basic_group_id),
    (NEW.id, 'representative', 'estado_civil', 'Estado Civil', 'select', false, 9, '["Soltero(a)", "Casado(a)", "Divorciado(a)", "Viudo(a)", "Unión Libre"]', rep_basic_group_id),
    (NEW.id, 'representative', 'numero_contacto', 'Número de Contacto', 'phone', false, 10, null, rep_basic_group_id),
    (NEW.id, 'representative', 'correo_electronico', 'Correo Electrónico', 'email', false, 11, null, rep_basic_group_id),
    (NEW.id, 'representative', 'nivel_instruccion', 'Nivel de Instrucción', 'select', false, 12, '["Primaria", "Secundaria", "Técnico", "Universitario", "Postgrado", "Otro"]', rep_professional_group_id),
    (NEW.id, 'representative', 'profesion', 'Profesión', 'text', false, 13, null, rep_professional_group_id),
    (NEW.id, 'representative', 'lugar_trabajo', 'Lugar de Trabajo', 'text', false, 14, null, rep_professional_group_id),
    (NEW.id, 'representative', 'cargo', 'Cargo', 'text', false, 15, null, rep_professional_group_id),
    (NEW.id, 'representative', 'observaciones', 'Observaciones', 'textarea', false, 16, null, rep_additional_group_id);

  -- Teacher fields
  INSERT INTO form_fields (school_id, form_type, field_name, field_label, field_type, is_required, field_order, options, group_id) VALUES
    (NEW.id, 'teacher', 'tipo_documento', 'Tipo', 'select', true, 0, '["V", "E", "P"]', teacher_basic_group_id),
    (NEW.id, 'teacher', 'documento', 'Nro de Documento', 'text', true, 1, null, teacher_basic_group_id),
    (NEW.id, 'teacher', 'primer_nombre', 'Primer Nombre', 'text', true, 2, null, teacher_basic_group_id),
    (NEW.id, 'teacher', 'segundo_nombre', 'Segundo Nombre', 'text', false, 3, null, teacher_basic_group_id),
    (NEW.id, 'teacher', 'primer_apellido', 'Primer Apellido', 'text', true, 4, null, teacher_basic_group_id),
    (NEW.id, 'teacher', 'segundo_apellido', 'Segundo Apellido', 'text', true, 5, null, teacher_basic_group_id),
    (NEW.id, 'teacher', 'sexo', 'Sexo', 'select', true, 6, '["Masculino", "Femenino"]', teacher_basic_group_id),
    (NEW.id, 'teacher', 'fecha_nacimiento', 'Fecha de Nacimiento', 'date', true, 7, null, teacher_basic_group_id),
    (NEW.id, 'teacher', 'pais_nacimiento', 'País', 'select', true, 8, '["Venezuela", "Colombia", "Ecuador", "Perú", "Chile", "Brasil", "Argentina", "México", "Otro"]', teacher_basic_group_id),
    (NEW.id, 'teacher', 'numero_contacto', 'Celular', 'phone', true, 9, null, teacher_contact_group_id),
    (NEW.id, 'teacher', 'correo_electronico', 'Correo Electrónico', 'email', true, 10, null, teacher_contact_group_id),
    (NEW.id, 'teacher', 'cargo', 'Cargo', 'text', true, 11, null, teacher_employment_group_id),
    (NEW.id, 'teacher', 'area_administrativa', 'Área Administrativa Adscrita', 'select', true, 12, '["Dirección", "Subdirección", "Coordinación Académica", "Coordinación de Evaluación", "Coordinación de Control de Estudios", "Departamento de Orientación", "Departamento de Bienestar Estudiantil", "Departamento de Educación Física", "Otro"]', teacher_employment_group_id),
    (NEW.id, 'teacher', 'fecha_ingreso', 'Fecha de Empleo', 'date', true, 13, null, teacher_employment_group_id),
    (NEW.id, 'teacher', 'nivel_instruccion', 'Nivel de Instrucción', 'select', false, 14, '["Técnico", "Universitario", "Especialización", "Maestría", "Doctorado"]', teacher_employment_group_id),
    (NEW.id, 'teacher', 'titulo', 'Título Obtenido', 'text', false, 15, null, teacher_employment_group_id),
    (NEW.id, 'teacher', 'observaciones', 'Observaciones', 'textarea', false, 16, null, teacher_employment_group_id);

  -- Default planilla sections
  INSERT INTO enrollment_planilla_sections (school_id, title, field_names, display_order, section_type, section_text) VALUES
    (NEW.id, 'Datos Personales del Estudiante', '["student:primer_apellido","student:segundo_apellido","student:primer_nombre","student:segundo_nombre","student:documento","student:email","student:numero_contacto","student:_edad","student:fecha_nacimiento","student:ciudad_nacimiento"]'::jsonb, 0, 'fields', ''),
    (NEW.id, 'Datos de Familia', '["family:email","family:contact_phone","family:address","family:location_full"]'::jsonb, 1, 'fields', ''),
    (NEW.id, 'Datos del Representante', '["representative:documento","representative:primer_apellido","representative:segundo_apellido","representative:_edad","representative:pais_nacimiento","representative:fecha_nacimiento","representative:numero_contacto"]'::jsonb, 2, 'fields', ''),
    (NEW.id, 'Información para la Inscripción', '["student:grado","custom:grupo_asignado","custom:tipo_de_estudiante","custom:fecha_de_inscripcion"]'::jsonb, 3, 'fields', ''),
    (NEW.id, 'Observaciones', '[]'::jsonb, 4, 'text', ''),
    (NEW.id, 'Compromiso del Representante', '[]'::jsonb, 5, 'text', E'Hago constar por medio de la presente, que he leído, acepto y me comprometo a cumplir las condiciones establecidas en el contrato de Prestación de Servicio educativo para el año escolar que se indica en esta planilla, así como los deberes y obligaciones conforme a las leyes y reglamentos vigentes del Estado Venezolano. Del mismo modo, mi representado y yo, nos comprometemos a respetar los acuerdos de Convivencia de la Institución.\n\nImportante: El Proceso de Inscripción se concretará una vez efectuado el pago por concepto de inscripción y primer mes, la consignación física de la Planilla de Registro y firma del Contrato de Prestación de Servicios Educativos.');

  RETURN NEW;
END;
$function$;

-- Insert default sections for existing schools that don't have any sections yet
INSERT INTO enrollment_planilla_sections (school_id, title, field_names, display_order, section_type, section_text)
SELECT s.id, 'Datos Personales del Estudiante', '["student:primer_apellido","student:segundo_apellido","student:primer_nombre","student:segundo_nombre","student:documento","student:email","student:numero_contacto","student:_edad","student:fecha_nacimiento","student:ciudad_nacimiento"]'::jsonb, 0, 'fields', ''
FROM schools s WHERE NOT EXISTS (SELECT 1 FROM enrollment_planilla_sections eps WHERE eps.school_id = s.id);

INSERT INTO enrollment_planilla_sections (school_id, title, field_names, display_order, section_type, section_text)
SELECT s.id, 'Datos de Familia', '["family:email","family:contact_phone","family:address","family:location_full"]'::jsonb, 1, 'fields', ''
FROM schools s WHERE NOT EXISTS (SELECT 1 FROM enrollment_planilla_sections eps WHERE eps.school_id = s.id AND eps.display_order >= 1);

INSERT INTO enrollment_planilla_sections (school_id, title, field_names, display_order, section_type, section_text)
SELECT s.id, 'Datos del Representante', '["representative:documento","representative:primer_apellido","representative:segundo_apellido","representative:_edad","representative:pais_nacimiento","representative:fecha_nacimiento","representative:numero_contacto"]'::jsonb, 2, 'fields', ''
FROM schools s WHERE NOT EXISTS (SELECT 1 FROM enrollment_planilla_sections eps WHERE eps.school_id = s.id AND eps.display_order >= 2);

INSERT INTO enrollment_planilla_sections (school_id, title, field_names, display_order, section_type, section_text)
SELECT s.id, 'Información para la Inscripción', '["student:grado","custom:grupo_asignado","custom:tipo_de_estudiante","custom:fecha_de_inscripcion"]'::jsonb, 3, 'fields', ''
FROM schools s WHERE NOT EXISTS (SELECT 1 FROM enrollment_planilla_sections eps WHERE eps.school_id = s.id AND eps.display_order >= 3);

INSERT INTO enrollment_planilla_sections (school_id, title, field_names, display_order, section_type, section_text)
SELECT s.id, 'Observaciones', '[]'::jsonb, 4, 'text', ''
FROM schools s WHERE NOT EXISTS (SELECT 1 FROM enrollment_planilla_sections eps WHERE eps.school_id = s.id AND eps.display_order >= 4);

INSERT INTO enrollment_planilla_sections (school_id, title, field_names, display_order, section_type, section_text)
SELECT s.id, 'Compromiso del Representante', '[]'::jsonb, 5, 'text', E'Hago constar por medio de la presente, que he leído, acepto y me comprometo a cumplir las condiciones establecidas en el contrato de Prestación de Servicio educativo para el año escolar que se indica en esta planilla, así como los deberes y obligaciones conforme a las leyes y reglamentos vigentes del Estado Venezolano. Del mismo modo, mi representado y yo, nos comprometemos a respetar los acuerdos de Convivencia de la Institución.\n\nImportante: El Proceso de Inscripción se concretará una vez efectuado el pago por concepto de inscripción y primer mes, la consignación física de la Planilla de Registro y firma del Contrato de Prestación de Servicios Educativos.'
FROM schools s WHERE NOT EXISTS (SELECT 1 FROM enrollment_planilla_sections eps WHERE eps.school_id = s.id AND eps.display_order >= 5);
