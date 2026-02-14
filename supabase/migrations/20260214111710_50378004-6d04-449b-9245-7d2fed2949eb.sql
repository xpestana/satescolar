-- Update the trigger function to use correo_electronico instead of email for representative fields
CREATE OR REPLACE FUNCTION public.create_default_form_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_basic_group_id uuid;
  student_physical_group_id uuid;
  student_medical_group_id uuid;
  student_additional_group_id uuid;
  rep_basic_group_id uuid;
  rep_professional_group_id uuid;
  rep_additional_group_id uuid;
BEGIN
  -- Create default groups for students
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student'::form_type, 'Datos Básicos', 'Información básica del estudiante', 0)
  RETURNING id INTO student_basic_group_id;

  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student'::form_type, 'Datos Físicos', 'Características físicas del estudiante', 1)
  RETURNING id INTO student_physical_group_id;

  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student'::form_type, 'Datos Médicos', 'Información médica del estudiante', 2)
  RETURNING id INTO student_medical_group_id;

  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student'::form_type, 'Información Adicional', 'Datos adicionales del estudiante', 3)
  RETURNING id INTO student_additional_group_id;
  
  -- Create default groups for representatives
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'representative'::form_type, 'Datos Básicos', 'Información básica del representante', 0)
  RETURNING id INTO rep_basic_group_id;

  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'representative'::form_type, 'Datos Profesionales', 'Información laboral y profesional', 1)
  RETURNING id INTO rep_professional_group_id;

  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'representative'::form_type, 'Información Adicional', 'Datos adicionales del representante', 2)
  RETURNING id INTO rep_additional_group_id;

  -- Insert student form fields
  INSERT INTO form_fields (school_id, form_type, field_name, field_label, field_type, is_required, field_order, options, group_id)
  VALUES
    (NEW.id, 'student'::form_type, 'tipo_documento', 'Tipo de Documento', 'select'::field_type, false, 0, '["V", "E", "CE"]', student_basic_group_id),
    (NEW.id, 'student'::form_type, 'documento', 'Documento', 'text'::field_type, false, 1, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'primer_nombre', 'Primer Nombre', 'text'::field_type, false, 2, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'segundo_nombre', 'Segundo Nombre', 'text'::field_type, false, 3, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'primer_apellido', 'Primer Apellido', 'text'::field_type, false, 4, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'segundo_apellido', 'Segundo Apellido', 'text'::field_type, false, 5, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'fecha_nacimiento', 'Fecha de Nacimiento', 'date'::field_type, false, 6, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'genero', 'Género', 'select'::field_type, false, 7, '["Masculino", "Femenino"]', student_basic_group_id),
    (NEW.id, 'student'::form_type, 'grado', 'Grado', 'select'::field_type, false, 8, '["Pre-Maternal", "Maternal", "1er Nivel", "2do Nivel", "3er Nivel", "1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado", "1er Año", "2do Año", "3er Año", "4to Año", "5to Año"]', student_basic_group_id),
    (NEW.id, 'student'::form_type, 'seccion', 'Sección', 'text'::field_type, false, 9, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'email', 'Correo Electrónico', 'email'::field_type, false, 10, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'tipo_sangre', 'Tipo de Sangre', 'select'::field_type, false, 11, '["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]', student_physical_group_id),
    (NEW.id, 'student'::form_type, 'talla_camisa', 'Talla de Camisa', 'select'::field_type, false, 12, '["2", "4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL"]', student_physical_group_id),
    (NEW.id, 'student'::form_type, 'talla_pantalon', 'Talla de Pantalón', 'select'::field_type, false, 13, '["2", "4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL"]', student_physical_group_id),
    (NEW.id, 'student'::form_type, 'talla_zapato', 'Talla de Zapato', 'text'::field_type, false, 14, null, student_physical_group_id),
    (NEW.id, 'student'::form_type, 'estatura', 'Estatura (cm)', 'text'::field_type, false, 15, null, student_physical_group_id),
    (NEW.id, 'student'::form_type, 'peso', 'Peso (kg)', 'text'::field_type, false, 16, null, student_physical_group_id),
    (NEW.id, 'student'::form_type, 'color_cabello', 'Color de Cabello', 'text'::field_type, false, 17, null, student_physical_group_id),
    (NEW.id, 'student'::form_type, 'color_ojos', 'Color de Ojos', 'text'::field_type, false, 18, null, student_physical_group_id),
    (NEW.id, 'student'::form_type, 'color_piel', 'Color de Piel', 'text'::field_type, false, 19, null, student_physical_group_id),
    (NEW.id, 'student'::form_type, 'senales_particulares', 'Señales Particulares', 'text'::field_type, false, 20, null, student_physical_group_id),
    (NEW.id, 'student'::form_type, 'lateralidad', 'Lateralidad', 'select'::field_type, false, 21, '["Diestro", "Zurdo", "Ambidiestro"]', student_physical_group_id),
    (NEW.id, 'student'::form_type, 'pais_nacimiento', 'País de Nacimiento', 'text'::field_type, false, 22, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'estado_nacimiento', 'Estado de Nacimiento', 'select'::field_type, false, 23, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'municipio_nacimiento', 'Municipio de Nacimiento', 'select'::field_type, false, 24, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'ciudad_nacimiento', 'Ciudad de Nacimiento', 'select'::field_type, false, 25, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'parroquia_nacimiento', 'Parroquia de Nacimiento', 'select'::field_type, false, 26, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'condicion_especial', '¿Presenta alguna condición especial?', 'select'::field_type, false, 27, '["Sí", "No"]', student_medical_group_id),
    (NEW.id, 'student'::form_type, 'descripcion_condicion', 'Describa la condición especial', 'textarea'::field_type, false, 28, null, student_medical_group_id),
    (NEW.id, 'student'::form_type, 'alergias', '¿Presenta algún tipo de alergia?', 'select'::field_type, false, 29, '["Sí", "No"]', student_medical_group_id),
    (NEW.id, 'student'::form_type, 'descripcion_alergia', 'Describa la alergia', 'textarea'::field_type, false, 30, null, student_medical_group_id),
    (NEW.id, 'student'::form_type, 'toma_medicamento', '¿Toma algún medicamento por prescripción médica?', 'select'::field_type, false, 31, '["Sí", "No"]', student_medical_group_id),
    (NEW.id, 'student'::form_type, 'descripcion_medicamento', 'Si el estudiante toma algún medicamento por favor describa', 'textarea'::field_type, false, 32, null, student_medical_group_id),
    (NEW.id, 'student'::form_type, 'seguro_medico', 'Si el estudiante posee seguro médico por favor describa', 'textarea'::field_type, false, 33, null, student_medical_group_id),
    (NEW.id, 'student'::form_type, 'con_quien_vive', '¿Con quién vive el alumno?', 'select'::field_type, false, 34, '["Ambos padres", "Solo madre", "Solo padre", "Abuelos", "Otros familiares", "Otros"]', student_additional_group_id),
    (NEW.id, 'student'::form_type, 'religion', 'Religión de los padres', 'select'::field_type, false, 35, '["Católica", "Cristiana evangélica", "Testigo de Jehová", "Judía", "Musulmana", "Otra", "Ninguna"]', student_additional_group_id),
    (NEW.id, 'student'::form_type, 'observaciones', 'Observaciones', 'textarea'::field_type, false, 37, null, student_additional_group_id);

  -- Insert representative form fields with group assignments
  INSERT INTO form_fields (school_id, form_type, field_name, field_label, field_type, is_required, field_order, options, group_id)
  VALUES
    (NEW.id, 'representative'::form_type, 'tipo_documento', 'Tipo de Documento', 'select'::field_type, false, 0, '["V", "E"]', rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'documento', 'Documento', 'text'::field_type, false, 1, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'primer_nombre', 'Primer Nombre', 'text'::field_type, false, 2, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'segundo_nombre', 'Segundo Nombre', 'text'::field_type, false, 3, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'primer_apellido', 'Primer Apellido', 'text'::field_type, false, 4, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'segundo_apellido', 'Segundo Apellido', 'text'::field_type, false, 5, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'fecha_nacimiento', 'Fecha de Nacimiento', 'date'::field_type, false, 6, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'genero', 'Género', 'select'::field_type, false, 7, '["Masculino", "Femenino"]', rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'nacionalidad', 'Nacionalidad', 'text'::field_type, false, 8, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'telefono', 'Teléfono', 'phone'::field_type, false, 9, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'correo_electronico', 'Correo Electrónico', 'email'::field_type, false, 10, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'direccion', 'Dirección', 'textarea'::field_type, false, 11, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'nivel_instruccion', 'Nivel de Instrucción', 'select'::field_type, false, 12, '["Primaria incompleta", "Primaria completa", "Secundaria incompleta", "Secundaria completa", "Técnico incompleto", "Técnico completo", "Universitario incompleto", "Universitario completo", "Postgrado incompleto", "Postgrado completo", "Ninguno"]', rep_professional_group_id),
    (NEW.id, 'representative'::form_type, 'ocupacion', 'Ocupación', 'text'::field_type, false, 13, null, rep_professional_group_id),
    (NEW.id, 'representative'::form_type, 'lugar_trabajo', 'Lugar de Trabajo', 'text'::field_type, false, 14, null, rep_professional_group_id),
    (NEW.id, 'representative'::form_type, 'cargo', 'Cargo', 'text'::field_type, false, 15, null, rep_professional_group_id),
    (NEW.id, 'representative'::form_type, 'es_representante_legal', '¿Es representante legal?', 'select'::field_type, false, 16, '["Sí", "No"]', rep_additional_group_id),
    (NEW.id, 'representative'::form_type, 'observaciones', 'Observaciones', 'textarea'::field_type, false, 17, null, rep_additional_group_id);
    
  RETURN NEW;
END;
$$;