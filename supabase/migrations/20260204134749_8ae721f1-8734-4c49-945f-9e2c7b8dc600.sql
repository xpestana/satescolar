-- Insert default groups for existing school (test school)
INSERT INTO public.form_field_groups (school_id, form_type, name, description, display_order)
SELECT DISTINCT school_id, 'student'::form_type, 'Datos Básicos', 'Información básica del estudiante', 0
FROM form_fields WHERE form_type = 'student'
UNION ALL
SELECT DISTINCT school_id, 'student'::form_type, 'Datos Físicos', 'Tallas y medidas físicas', 1
FROM form_fields WHERE form_type = 'student'
UNION ALL
SELECT DISTINCT school_id, 'student'::form_type, 'Salud', 'Información de salud y condiciones médicas', 2
FROM form_fields WHERE form_type = 'student'
UNION ALL
SELECT DISTINCT school_id, 'student'::form_type, 'Información Adicional', 'Otros datos relevantes', 3
FROM form_fields WHERE form_type = 'student'
UNION ALL
SELECT DISTINCT school_id, 'representative'::form_type, 'Datos Básicos', 'Información básica del representante', 0
FROM form_fields WHERE form_type = 'representative'
UNION ALL
SELECT DISTINCT school_id, 'representative'::form_type, 'Datos Profesionales', 'Información laboral y profesional', 1
FROM form_fields WHERE form_type = 'representative'
UNION ALL
SELECT DISTINCT school_id, 'representative'::form_type, 'Información Adicional', 'Otros datos relevantes', 2
FROM form_fields WHERE form_type = 'representative';

-- Assign student fields to their groups
UPDATE form_fields SET group_id = (
  SELECT g.id FROM form_field_groups g 
  WHERE g.school_id = form_fields.school_id 
  AND g.form_type = 'student' 
  AND g.name = 'Datos Básicos'
)
WHERE form_type = 'student' 
AND field_name IN ('tipo_documento', 'documento', 'fecha_nacimiento', 'genero', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'grado', 'seccion', 'email');

UPDATE form_fields SET group_id = (
  SELECT g.id FROM form_field_groups g 
  WHERE g.school_id = form_fields.school_id 
  AND g.form_type = 'student' 
  AND g.name = 'Datos Físicos'
)
WHERE form_type = 'student' 
AND field_name IN ('tipo_sangre', 'talla_camisa', 'talla_pantalon', 'talla_zapato', 'peso', 'estatura');

UPDATE form_fields SET group_id = (
  SELECT g.id FROM form_field_groups g 
  WHERE g.school_id = form_fields.school_id 
  AND g.form_type = 'student' 
  AND g.name = 'Salud'
)
WHERE form_type = 'student' 
AND field_name IN ('compromiso_motor', 'compromiso_cognitivo', 'compromiso_visual', 'compromiso_auditivo', 'diabetes', 'epilepsia', 'asma', 'usa_lentes', 'alergia_medicamentos', 'alergia_alimentos', 'otra_alergia', 'detalle_alergias', 'enfermedad_cronica', 'detalle_enfermedad', 'tratamiento_medico', 'detalle_tratamiento', 'discapacidad', 'tipo_discapacidad');

UPDATE form_fields SET group_id = (
  SELECT g.id FROM form_field_groups g 
  WHERE g.school_id = form_fields.school_id 
  AND g.form_type = 'student' 
  AND g.name = 'Información Adicional'
)
WHERE form_type = 'student' 
AND field_name IN ('con_quien_vive', 'religion', 'observaciones');

-- Assign representative fields to their groups
UPDATE form_fields SET group_id = (
  SELECT g.id FROM form_field_groups g 
  WHERE g.school_id = form_fields.school_id 
  AND g.form_type = 'representative' 
  AND g.name = 'Datos Básicos'
)
WHERE form_type = 'representative' 
AND field_name IN ('tipo_documento', 'documento', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'fecha_nacimiento', 'genero', 'nacionalidad', 'telefono', 'email', 'direccion');

UPDATE form_fields SET group_id = (
  SELECT g.id FROM form_field_groups g 
  WHERE g.school_id = form_fields.school_id 
  AND g.form_type = 'representative' 
  AND g.name = 'Datos Profesionales'
)
WHERE form_type = 'representative' 
AND field_name IN ('nivel_instruccion', 'ocupacion', 'lugar_trabajo', 'cargo');

UPDATE form_fields SET group_id = (
  SELECT g.id FROM form_field_groups g 
  WHERE g.school_id = form_fields.school_id 
  AND g.form_type = 'representative' 
  AND g.name = 'Información Adicional'
)
WHERE form_type = 'representative' 
AND field_name IN ('es_representante_legal', 'observaciones');

-- Update the trigger function to also create default groups for new schools
CREATE OR REPLACE FUNCTION public.create_default_form_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_basic_group_id UUID;
  student_physical_group_id UUID;
  student_health_group_id UUID;
  student_additional_group_id UUID;
  rep_basic_group_id UUID;
  rep_professional_group_id UUID;
  rep_additional_group_id UUID;
BEGIN
  -- Create default groups for students
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student'::form_type, 'Datos Básicos', 'Información básica del estudiante', 0)
  RETURNING id INTO student_basic_group_id;
  
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student'::form_type, 'Datos Físicos', 'Tallas y medidas físicas', 1)
  RETURNING id INTO student_physical_group_id;
  
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student'::form_type, 'Salud', 'Información de salud y condiciones médicas', 2)
  RETURNING id INTO student_health_group_id;
  
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'student'::form_type, 'Información Adicional', 'Otros datos relevantes', 3)
  RETURNING id INTO student_additional_group_id;
  
  -- Create default groups for representatives
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'representative'::form_type, 'Datos Básicos', 'Información básica del representante', 0)
  RETURNING id INTO rep_basic_group_id;
  
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'representative'::form_type, 'Datos Profesionales', 'Información laboral y profesional', 1)
  RETURNING id INTO rep_professional_group_id;
  
  INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
  VALUES (NEW.id, 'representative'::form_type, 'Información Adicional', 'Otros datos relevantes', 2)
  RETURNING id INTO rep_additional_group_id;

  -- Insert student form fields with group assignments
  INSERT INTO form_fields (school_id, form_type, field_name, field_label, field_type, is_required, field_order, options, group_id)
  VALUES
    (NEW.id, 'student'::form_type, 'tipo_documento', 'Tipo de Documento', 'select'::field_type, false, 0, '["Cédula Escolar", "Cédula de Identidad", "Partida de Nacimiento", "Pasaporte"]', student_basic_group_id),
    (NEW.id, 'student'::form_type, 'documento', 'Documento', 'text'::field_type, false, 1, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'fecha_nacimiento', 'Fecha de Nacimiento', 'date'::field_type, false, 2, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'genero', 'Género', 'select'::field_type, false, 3, '["Masculino", "Femenino"]', student_basic_group_id),
    (NEW.id, 'student'::form_type, 'primer_nombre', 'Primer Nombre', 'text'::field_type, false, 4, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'segundo_nombre', 'Segundo Nombre', 'text'::field_type, false, 5, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'primer_apellido', 'Primer Apellido', 'text'::field_type, false, 6, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'segundo_apellido', 'Segundo Apellido', 'text'::field_type, false, 7, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'grado', 'Grado', 'select'::field_type, false, 8, '["Pre-Maternal", "Maternal", "1er Nivel", "2do Nivel", "3er Nivel", "1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado", "1er Año", "2do Año", "3er Año", "4to Año", "5to Año"]', student_basic_group_id),
    (NEW.id, 'student'::form_type, 'seccion', 'Sección', 'text'::field_type, false, 9, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'email', 'Correo Electrónico', 'email'::field_type, false, 10, null, student_basic_group_id),
    (NEW.id, 'student'::form_type, 'tipo_sangre', 'Tipo de Sangre', 'select'::field_type, false, 11, '["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]', student_physical_group_id),
    (NEW.id, 'student'::form_type, 'talla_camisa', 'Talla de Camisa', 'select'::field_type, false, 12, '["2", "4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL"]', student_physical_group_id),
    (NEW.id, 'student'::form_type, 'talla_pantalon', 'Talla de Pantalón', 'select'::field_type, false, 13, '["2", "4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL"]', student_physical_group_id),
    (NEW.id, 'student'::form_type, 'talla_zapato', 'Talla de Zapato', 'text'::field_type, false, 14, null, student_physical_group_id),
    (NEW.id, 'student'::form_type, 'peso', 'Peso (kg)', 'number'::field_type, false, 15, null, student_physical_group_id),
    (NEW.id, 'student'::form_type, 'estatura', 'Estatura (cm)', 'number'::field_type, false, 16, null, student_physical_group_id),
    (NEW.id, 'student'::form_type, 'compromiso_motor', '¿Tiene compromiso motor?', 'select'::field_type, false, 17, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'compromiso_cognitivo', '¿Tiene compromiso cognitivo?', 'select'::field_type, false, 18, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'compromiso_visual', '¿Tiene compromiso visual?', 'select'::field_type, false, 19, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'compromiso_auditivo', '¿Tiene compromiso auditivo?', 'select'::field_type, false, 20, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'diabetes', '¿Tiene diabetes?', 'select'::field_type, false, 21, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'epilepsia', '¿Tiene epilepsia?', 'select'::field_type, false, 22, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'asma', '¿Tiene asma?', 'select'::field_type, false, 23, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'usa_lentes', '¿Usa lentes?', 'select'::field_type, false, 24, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'alergia_medicamentos', '¿Alergia a medicamentos?', 'select'::field_type, false, 25, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'alergia_alimentos', '¿Alergia a alimentos?', 'select'::field_type, false, 26, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'otra_alergia', '¿Otra alergia?', 'select'::field_type, false, 27, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'detalle_alergias', 'Detalle de Alergias', 'textarea'::field_type, false, 28, null, student_health_group_id),
    (NEW.id, 'student'::form_type, 'enfermedad_cronica', '¿Tiene enfermedad crónica?', 'select'::field_type, false, 29, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'detalle_enfermedad', 'Detalle de Enfermedad Crónica', 'textarea'::field_type, false, 30, null, student_health_group_id),
    (NEW.id, 'student'::form_type, 'tratamiento_medico', '¿Está en tratamiento médico?', 'select'::field_type, false, 31, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'detalle_tratamiento', 'Detalle del Tratamiento', 'textarea'::field_type, false, 32, null, student_health_group_id),
    (NEW.id, 'student'::form_type, 'discapacidad', '¿Tiene alguna discapacidad?', 'select'::field_type, false, 33, '["No", "Sí"]', student_health_group_id),
    (NEW.id, 'student'::form_type, 'tipo_discapacidad', 'Tipo de Discapacidad', 'text'::field_type, false, 34, null, student_health_group_id),
    (NEW.id, 'student'::form_type, 'con_quien_vive', '¿Con quién vive?', 'select'::field_type, false, 35, '["Ambos padres", "Solo madre", "Solo padre", "Abuelos", "Otros familiares", "Otro"]', student_additional_group_id),
    (NEW.id, 'student'::form_type, 'religion', 'Religión', 'text'::field_type, false, 36, null, student_additional_group_id),
    (NEW.id, 'student'::form_type, 'observaciones', 'Observaciones', 'textarea'::field_type, false, 37, null, student_additional_group_id);

  -- Insert representative form fields with group assignments
  INSERT INTO form_fields (school_id, form_type, field_name, field_label, field_type, is_required, field_order, options, group_id)
  VALUES
    (NEW.id, 'representative'::form_type, 'tipo_documento', 'Tipo de Documento', 'select'::field_type, false, 0, '["Cédula de Identidad", "Pasaporte", "Cédula de Extranjería"]', rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'documento', 'Documento', 'text'::field_type, false, 1, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'primer_nombre', 'Primer Nombre', 'text'::field_type, false, 2, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'segundo_nombre', 'Segundo Nombre', 'text'::field_type, false, 3, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'primer_apellido', 'Primer Apellido', 'text'::field_type, false, 4, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'segundo_apellido', 'Segundo Apellido', 'text'::field_type, false, 5, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'fecha_nacimiento', 'Fecha de Nacimiento', 'date'::field_type, false, 6, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'genero', 'Género', 'select'::field_type, false, 7, '["Masculino", "Femenino"]', rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'nacionalidad', 'Nacionalidad', 'text'::field_type, false, 8, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'telefono', 'Teléfono', 'phone'::field_type, false, 9, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'email', 'Correo Electrónico', 'email'::field_type, false, 10, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'direccion', 'Dirección', 'textarea'::field_type, false, 11, null, rep_basic_group_id),
    (NEW.id, 'representative'::form_type, 'nivel_instruccion', 'Nivel de Instrucción', 'select'::field_type, false, 12, '["Primaria", "Secundaria", "Técnico", "Universitario", "Postgrado", "Ninguno"]', rep_professional_group_id),
    (NEW.id, 'representative'::form_type, 'ocupacion', 'Ocupación', 'text'::field_type, false, 13, null, rep_professional_group_id),
    (NEW.id, 'representative'::form_type, 'lugar_trabajo', 'Lugar de Trabajo', 'text'::field_type, false, 14, null, rep_professional_group_id),
    (NEW.id, 'representative'::form_type, 'cargo', 'Cargo', 'text'::field_type, false, 15, null, rep_professional_group_id),
    (NEW.id, 'representative'::form_type, 'es_representante_legal', '¿Es representante legal?', 'select'::field_type, false, 16, '["Sí", "No"]', rep_additional_group_id),
    (NEW.id, 'representative'::form_type, 'observaciones', 'Observaciones', 'textarea'::field_type, false, 17, null, rep_additional_group_id);
    
  RETURN NEW;
END;
$$;