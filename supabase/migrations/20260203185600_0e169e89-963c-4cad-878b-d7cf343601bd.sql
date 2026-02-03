-- Update existing checkbox fields to select with Sí/No options for all schools
UPDATE form_fields 
SET field_type = 'select', 
    options = '["No", "Sí"]',
    field_label = CASE field_name
      WHEN 'compromiso_motor' THEN '¿Tiene problemas motores?'
      WHEN 'compromiso_cognitivo' THEN '¿Tiene problemas cognitivos?'
      WHEN 'compromiso_auditivo' THEN '¿Tiene problemas auditivos?'
      WHEN 'compromiso_visual' THEN '¿Tiene problemas visuales?'
      WHEN 'compromiso_lenguaje' THEN '¿Tiene problemas de lenguaje?'
      WHEN 'informe_medico_compromisos' THEN '¿Posee informe médico de compromisos?'
      WHEN 'impedimento_educacion_fisica' THEN '¿Tiene impedimento para practicar Educación Física?'
      WHEN 'intervenido_quirurgicamente' THEN '¿Ha sido intervenido quirúrgicamente?'
      WHEN 'problemas_respiratorios' THEN '¿Tiene problemas respiratorios?'
      WHEN 'diabetes' THEN '¿Tiene diabetes?'
      WHEN 'epilepsia' THEN '¿Tiene epilepsia?'
      WHEN 'informe_medico_enfermedad' THEN '¿Posee informe médico de alguna enfermedad?'
      WHEN 'tratamiento_horario_clases' THEN '¿Recibe tratamiento médico en su horario de clases?'
      WHEN 'usa_lentes' THEN '¿Usa lentes?'
      ELSE field_label
    END
WHERE form_type = 'student' 
AND field_name IN (
  'compromiso_motor', 'compromiso_cognitivo', 'compromiso_auditivo', 
  'compromiso_visual', 'compromiso_lenguaje', 'informe_medico_compromisos',
  'impedimento_educacion_fisica', 'intervenido_quirurgicamente', 
  'problemas_respiratorios', 'diabetes', 'epilepsia', 
  'informe_medico_enfermedad', 'tratamiento_horario_clases', 'usa_lentes'
);

-- Drop and recreate the function with updated field types
DROP FUNCTION IF EXISTS public.create_default_form_fields() CASCADE;

CREATE OR REPLACE FUNCTION public.create_default_form_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Student form fields
  INSERT INTO form_fields (school_id, form_type, field_name, field_label, field_type, placeholder, is_required, is_visible, field_order, options) VALUES
  -- Datos Básicos del Estudiante
  (NEW.id, 'student', 'tipo_documento', 'Tipo de documento', 'select', NULL, false, true, 1, '["V", "E", "P"]'),
  (NEW.id, 'student', 'documento', 'Documento', 'text', 'ej: 12345678', false, true, 2, NULL),
  (NEW.id, 'student', 'fecha_nacimiento', 'Fecha de nacimiento', 'date', NULL, false, true, 3, NULL),
  (NEW.id, 'student', 'genero', 'Género', 'select', NULL, false, true, 4, '["Masculino", "Femenino"]'),
  (NEW.id, 'student', 'primer_nombre', 'Primer nombre', 'text', NULL, false, true, 5, NULL),
  (NEW.id, 'student', 'segundo_nombre', 'Segundo nombre', 'text', NULL, false, true, 6, NULL),
  (NEW.id, 'student', 'primer_apellido', 'Primer apellido', 'text', NULL, false, true, 7, NULL),
  (NEW.id, 'student', 'segundo_apellido', 'Segundo apellido', 'text', NULL, false, true, 8, NULL),
  (NEW.id, 'student', 'pais_nacimiento', 'País', 'select', NULL, false, true, 9, '["Venezuela"]'),
  (NEW.id, 'student', 'estado_nacimiento', 'Estado', 'select', NULL, false, true, 10, NULL),
  (NEW.id, 'student', 'municipio_nacimiento', 'Municipio', 'select', NULL, false, true, 11, NULL),
  (NEW.id, 'student', 'ciudad_nacimiento', 'Ciudad', 'select', NULL, false, true, 12, NULL),
  (NEW.id, 'student', 'parroquia_nacimiento', 'Parroquia', 'select', NULL, false, true, 13, NULL),
  (NEW.id, 'student', 'nivel_grado', 'Nivel / Grado', 'select', NULL, false, true, 14, NULL),
  (NEW.id, 'student', 'celular', 'Celular', 'phone', NULL, false, true, 15, NULL),
  (NEW.id, 'student', 'tipo_sangre', 'Tipo de sangre', 'select', NULL, false, true, 16, '["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]'),
  (NEW.id, 'student', 'usa_lentes', '¿Usa lentes?', 'select', NULL, false, true, 17, '["No", "Sí"]'),
  (NEW.id, 'student', 'talla_camisa', 'Talla de camisa', 'select', NULL, false, true, 18, '["2", "4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL"]'),
  (NEW.id, 'student', 'talla_pantalon', 'Talla de pantalón', 'select', NULL, false, true, 19, '["2", "4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL"]'),
  (NEW.id, 'student', 'talla_calzado', 'Talla de calzado', 'text', NULL, false, true, 20, NULL),
  (NEW.id, 'student', 'altura_cm', 'Altura (cm)', 'number', NULL, false, true, 21, NULL),
  (NEW.id, 'student', 'peso_kg', 'Peso (kg)', 'number', NULL, false, true, 22, NULL),
  (NEW.id, 'student', 'ancho_pecho_cm', 'Ancho de pecho (cm)', 'number', NULL, false, true, 23, NULL),
  (NEW.id, 'student', 'ancho_brazo_cm', 'Ancho de brazo (cm)', 'number', NULL, false, true, 24, NULL),
  (NEW.id, 'student', 'ancho_cintura_cm', 'Ancho de cintura (cm)', 'number', NULL, false, true, 25, NULL),
  -- Health conditions as selects with Sí/No
  (NEW.id, 'student', 'compromiso_motor', '¿Tiene problemas motores?', 'select', NULL, false, true, 26, '["No", "Sí"]'),
  (NEW.id, 'student', 'compromiso_cognitivo', '¿Tiene problemas cognitivos?', 'select', NULL, false, true, 27, '["No", "Sí"]'),
  (NEW.id, 'student', 'compromiso_auditivo', '¿Tiene problemas auditivos?', 'select', NULL, false, true, 28, '["No", "Sí"]'),
  (NEW.id, 'student', 'compromiso_visual', '¿Tiene problemas visuales?', 'select', NULL, false, true, 29, '["No", "Sí"]'),
  (NEW.id, 'student', 'compromiso_lenguaje', '¿Tiene problemas de lenguaje?', 'select', NULL, false, true, 30, '["No", "Sí"]'),
  (NEW.id, 'student', 'informe_medico_compromisos', '¿Posee informe médico de compromisos?', 'select', NULL, false, true, 31, '["No", "Sí"]'),
  (NEW.id, 'student', 'impedimento_educacion_fisica', '¿Tiene impedimento para practicar Educación Física?', 'select', NULL, false, true, 32, '["No", "Sí"]'),
  (NEW.id, 'student', 'intervenido_quirurgicamente', '¿Ha sido intervenido quirúrgicamente?', 'select', NULL, false, true, 33, '["No", "Sí"]'),
  (NEW.id, 'student', 'problemas_respiratorios', '¿Tiene problemas respiratorios?', 'select', NULL, false, true, 34, '["No", "Sí"]'),
  (NEW.id, 'student', 'diabetes', '¿Tiene diabetes?', 'select', NULL, false, true, 35, '["No", "Sí"]'),
  (NEW.id, 'student', 'epilepsia', '¿Tiene epilepsia?', 'select', NULL, false, true, 36, '["No", "Sí"]'),
  (NEW.id, 'student', 'alergias', 'Si el estudiante es alérgico por favor describa', 'textarea', NULL, false, true, 37, NULL),
  (NEW.id, 'student', 'otras_enfermedades', 'Describa si el estudiante padece o ha padecido alguna otra enfermedad', 'textarea', NULL, false, true, 38, NULL),
  (NEW.id, 'student', 'informe_medico_enfermedad', '¿Posee informe médico de alguna enfermedad?', 'select', NULL, false, true, 39, '["No", "Sí"]'),
  (NEW.id, 'student', 'tratamiento_horario_clases', '¿Recibe tratamiento médico en su horario de clases?', 'select', NULL, false, true, 40, '["No", "Sí"]'),
  (NEW.id, 'student', 'medicamentos_requeridos', 'En caso de requerir algún medicamento por favor indique', 'textarea', NULL, false, true, 41, NULL),
  (NEW.id, 'student', 'seguro_medico', 'Si el estudiante posee seguro médico por favor describa', 'textarea', NULL, false, true, 42, NULL),
  (NEW.id, 'student', 'situacion_matrimonial_padres', 'Situación matrimonial de los padres', 'select', NULL, false, true, 43, '["Matrimonio solo civil", "Matrimonio eclesiástico", "Concubinato", "Separados", "Divorciado (a)", "Padre / Madre Soltero (a)", "Viudo (a)", "Otra"]'),
  (NEW.id, 'student', 'quien_vive_alumno', '¿Quién vive con el alumno?', 'select', NULL, false, true, 44, '["Padres", "Padres y Hermanos", "Padres, Hermanos y Otros", "Padres, Hermanos, Otros e Inquilinos", "Otro"]'),
  (NEW.id, 'student', 'religion_padres', 'Religión de los padres', 'select', NULL, false, true, 45, '["Ambos católicos", "Ambos protestantes", "Otra"]'),
  (NEW.id, 'student', 'compromisos_religiosos', 'Compromisos religiosos del estudiante', 'select', NULL, false, true, 46, '["Bautizado", "Primera comunión", "Confirmación", "Otro"]');

  -- Representative form fields
  INSERT INTO form_fields (school_id, form_type, field_name, field_label, field_type, placeholder, is_required, is_visible, field_order, options) VALUES
  (NEW.id, 'representative', 'tipo_documento', 'Tipo de documento', 'select', NULL, false, true, 1, '["V", "E", "P"]'),
  (NEW.id, 'representative', 'documento', 'Documento', 'text', 'ej: 12345678', false, true, 2, NULL),
  (NEW.id, 'representative', 'numero_contacto', 'Número de Contacto del Representante', 'phone', NULL, false, true, 3, NULL),
  (NEW.id, 'representative', 'primer_nombre', 'Primer nombre', 'text', NULL, false, true, 4, NULL),
  (NEW.id, 'representative', 'segundo_nombre', 'Segundo nombre', 'text', NULL, false, true, 5, NULL),
  (NEW.id, 'representative', 'primer_apellido', 'Primer apellido', 'text', NULL, false, true, 6, NULL),
  (NEW.id, 'representative', 'segundo_apellido', 'Segundo apellido', 'text', NULL, false, true, 7, NULL),
  (NEW.id, 'representative', 'fecha_nacimiento', 'Fecha de nacimiento', 'date', NULL, false, true, 8, NULL),
  (NEW.id, 'representative', 'pais_nacimiento', 'País de nacimiento', 'select', NULL, false, true, 9, '["Venezuela", "Colombia", "Ecuador", "Perú", "Brasil", "Chile", "Argentina", "México", "España", "Estados Unidos", "Otro"]'),
  (NEW.id, 'representative', 'nivel_instruccion', 'Nivel de instrucción', 'select', NULL, false, true, 10, '["Sin instrucción", "Primaria incompleta", "Primaria completa", "Secundaria incompleta", "Secundaria completa", "Técnico superior", "Universitario incompleto", "Universitario completo", "Postgrado"]'),
  (NEW.id, 'representative', 'otros_cursos', 'Otros cursos realizados', 'text', NULL, false, true, 11, NULL),
  (NEW.id, 'representative', 'que_trabajo_realiza', '¿Qué trabajo realiza?', 'text', NULL, false, true, 12, NULL),
  (NEW.id, 'representative', 'profesion_ocupacion', 'Profesión, ocupación u oficio', 'text', 'especifique si ejerce esa profesión', false, true, 13, NULL),
  (NEW.id, 'representative', 'empresa_trabajo', 'Empresa donde trabaja (nombre y dirección)', 'text', NULL, false, true, 14, NULL),
  (NEW.id, 'representative', 'es_dueno', '¿Es dueño?', 'select', NULL, false, true, 15, '["No", "Sí"]'),
  (NEW.id, 'representative', 'genero', 'Género', 'select', NULL, false, true, 16, '["Masculino", "Femenino"]'),
  (NEW.id, 'representative', 'parentesco_estudiantes', 'Parentesco con los estudiantes', 'select', NULL, false, true, 17, '["Padre", "Madre", "Abuelo(a)", "Tío(a)", "Hermano(a)", "Tutor legal", "Otro"]');

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER create_default_form_fields_on_school_insert
  AFTER INSERT ON schools
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_form_fields();