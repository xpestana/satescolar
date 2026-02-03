-- Insert default representative form fields for the existing test school
INSERT INTO form_fields (school_id, form_type, field_name, field_label, field_type, placeholder, is_required, is_visible, field_order, options)
SELECT 
  s.id,
  'representative',
  field_data.field_name,
  field_data.field_label,
  field_data.field_type::field_type,
  field_data.placeholder,
  false,
  true,
  field_data.field_order,
  field_data.options::jsonb
FROM schools s
CROSS JOIN (VALUES
  -- Documento de Identificación del Representante
  ('tipo_documento', 'Tipo de documento', 'select', NULL, 1, '["V", "E", "P"]'),
  ('documento', 'Documento', 'text', 'ej: 12345678', 2, NULL),
  ('numero_contacto', 'Número de Contacto del Representante', 'phone', NULL, 3, NULL),
  -- Datos del Representante
  ('primer_nombre', 'Primer nombre', 'text', NULL, 4, NULL),
  ('segundo_nombre', 'Segundo nombre', 'text', NULL, 5, NULL),
  ('primer_apellido', 'Primer apellido', 'text', NULL, 6, NULL),
  ('segundo_apellido', 'Segundo apellido', 'text', NULL, 7, NULL),
  ('fecha_nacimiento', 'Fecha de nacimiento', 'date', NULL, 8, NULL),
  ('pais_nacimiento', 'País de nacimiento', 'select', NULL, 9, '["Venezuela", "Colombia", "Ecuador", "Perú", "Brasil", "Chile", "Argentina", "México", "España", "Estados Unidos", "Otro"]'),
  -- Datos Profesionales del Representante
  ('nivel_instruccion', 'Nivel de instrucción', 'select', NULL, 10, '["Sin instrucción", "Primaria incompleta", "Primaria completa", "Secundaria incompleta", "Secundaria completa", "Técnico superior", "Universitario incompleto", "Universitario completo", "Postgrado"]'),
  ('otros_cursos', 'Otros cursos realizados', 'text', NULL, 11, NULL),
  ('que_trabajo_realiza', '¿Qué trabajo realiza?', 'text', NULL, 12, NULL),
  ('profesion_ocupacion', 'Profesión, ocupación u oficio', 'text', 'especifique si ejerce esa profesión', 13, NULL),
  ('empresa_trabajo', 'Empresa donde trabaja (nombre y dirección)', 'text', NULL, 14, NULL),
  ('es_dueno', '¿Es dueño?', 'select', NULL, 15, '["No", "Sí"]'),
  -- Información Adicional
  ('genero', 'Género', 'select', NULL, 16, '["Masculino", "Femenino"]'),
  ('parentesco_estudiantes', 'Parentesco con los estudiantes', 'select', NULL, 17, '["Padre", "Madre", "Abuelo(a)", "Tío(a)", "Hermano(a)", "Tutor legal", "Otro"]')
) AS field_data(field_name, field_label, field_type, placeholder, field_order, options)
WHERE NOT EXISTS (
  SELECT 1 FROM form_fields ff 
  WHERE ff.school_id = s.id 
  AND ff.form_type = 'representative' 
  AND ff.field_name = field_data.field_name
);

-- Drop the existing function and recreate it with representative fields included
DROP FUNCTION IF EXISTS public.create_default_student_form_fields() CASCADE;

-- Create a new function that creates both student AND representative form fields
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
  (NEW.id, 'student', 'usa_lentes', '¿Usa lentes?', 'checkbox', NULL, false, true, 17, NULL),
  (NEW.id, 'student', 'talla_camisa', 'Talla de camisa', 'select', NULL, false, true, 18, '["2", "4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL"]'),
  (NEW.id, 'student', 'talla_pantalon', 'Talla de pantalón', 'select', NULL, false, true, 19, '["2", "4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL"]'),
  (NEW.id, 'student', 'talla_calzado', 'Talla de calzado', 'text', NULL, false, true, 20, NULL),
  (NEW.id, 'student', 'altura_cm', 'Altura (cm)', 'number', NULL, false, true, 21, NULL),
  (NEW.id, 'student', 'peso_kg', 'Peso (kg)', 'number', NULL, false, true, 22, NULL),
  (NEW.id, 'student', 'ancho_pecho_cm', 'Ancho de pecho (cm)', 'number', NULL, false, true, 23, NULL),
  (NEW.id, 'student', 'ancho_brazo_cm', 'Ancho de brazo (cm)', 'number', NULL, false, true, 24, NULL),
  (NEW.id, 'student', 'ancho_cintura_cm', 'Ancho de cintura (cm)', 'number', NULL, false, true, 25, NULL),
  (NEW.id, 'student', 'compromiso_motor', 'Motor', 'checkbox', NULL, false, true, 26, NULL),
  (NEW.id, 'student', 'compromiso_cognitivo', 'Cognitivo', 'checkbox', NULL, false, true, 27, NULL),
  (NEW.id, 'student', 'compromiso_auditivo', 'Auditivo', 'checkbox', NULL, false, true, 28, NULL),
  (NEW.id, 'student', 'compromiso_visual', 'Visual', 'checkbox', NULL, false, true, 29, NULL),
  (NEW.id, 'student', 'compromiso_lenguaje', 'Lenguaje', 'checkbox', NULL, false, true, 30, NULL),
  (NEW.id, 'student', 'informe_medico_compromisos', 'Posee informe médico de compromisos', 'checkbox', NULL, false, true, 31, NULL),
  (NEW.id, 'student', 'impedimento_educacion_fisica', '¿Tiene impedimento para practicar Educación Física?', 'checkbox', NULL, false, true, 32, NULL),
  (NEW.id, 'student', 'intervenido_quirurgicamente', '¿Ha sido intervenido quirúrgicamente?', 'checkbox', NULL, false, true, 33, NULL),
  (NEW.id, 'student', 'problemas_respiratorios', 'Problemas respiratorios', 'checkbox', NULL, false, true, 34, NULL),
  (NEW.id, 'student', 'diabetes', 'Diabetes', 'checkbox', NULL, false, true, 35, NULL),
  (NEW.id, 'student', 'epilepsia', 'Epilepsia', 'checkbox', NULL, false, true, 36, NULL),
  (NEW.id, 'student', 'alergias', 'Si el estudiante es alérgico por favor describa', 'textarea', NULL, false, true, 37, NULL),
  (NEW.id, 'student', 'otras_enfermedades', 'Describa si el estudiante padece o ha padecido alguna otra enfermedad', 'textarea', NULL, false, true, 38, NULL),
  (NEW.id, 'student', 'informe_medico_enfermedad', 'Posee informe médico de alguna enfermedad', 'checkbox', NULL, false, true, 39, NULL),
  (NEW.id, 'student', 'tratamiento_horario_clases', '¿Recibe tratamiento médico en su horario de clases?', 'checkbox', NULL, false, true, 40, NULL),
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

-- Create the trigger using the new function name
CREATE TRIGGER create_default_form_fields_on_school_insert
  AFTER INSERT ON schools
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_form_fields();