-- Insert default student form fields for existing school
INSERT INTO form_fields (school_id, form_type, field_name, field_label, field_type, placeholder, is_required, is_visible, field_order, options) VALUES
-- Datos Básicos del Estudiante
('d743589d-6a26-474e-8cad-873909885851', 'student', 'tipo_documento', 'Tipo de documento', 'select', NULL, false, true, 1, '["V", "E", "P"]'),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'documento', 'Documento', 'text', 'ej: 12345678', false, true, 2, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'fecha_nacimiento', 'Fecha de nacimiento', 'date', NULL, false, true, 3, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'genero', 'Género', 'select', NULL, false, true, 4, '["Masculino", "Femenino"]'),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'primer_nombre', 'Primer nombre', 'text', NULL, false, true, 5, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'segundo_nombre', 'Segundo nombre', 'text', NULL, false, true, 6, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'primer_apellido', 'Primer apellido', 'text', NULL, false, true, 7, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'segundo_apellido', 'Segundo apellido', 'text', NULL, false, true, 8, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'pais_nacimiento', 'País', 'select', NULL, false, true, 9, '["Venezuela"]'),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'estado_nacimiento', 'Estado', 'select', NULL, false, true, 10, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'municipio_nacimiento', 'Municipio', 'select', NULL, false, true, 11, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'ciudad_nacimiento', 'Ciudad', 'select', NULL, false, true, 12, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'parroquia_nacimiento', 'Parroquia', 'select', NULL, false, true, 13, NULL),
-- Grado y Contacto
('d743589d-6a26-474e-8cad-873909885851', 'student', 'nivel_grado', 'Nivel / Grado', 'select', NULL, false, true, 14, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'celular', 'Celular', 'phone', NULL, false, true, 15, NULL),
-- Datos Físicos
('d743589d-6a26-474e-8cad-873909885851', 'student', 'tipo_sangre', 'Tipo de sangre', 'select', NULL, false, true, 16, '["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]'),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'usa_lentes', '¿Usa lentes?', 'checkbox', NULL, false, true, 17, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'talla_camisa', 'Talla de camisa', 'select', NULL, false, true, 18, '["2", "4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL"]'),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'talla_pantalon', 'Talla de pantalón', 'select', NULL, false, true, 19, '["2", "4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL"]'),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'talla_calzado', 'Talla de calzado', 'text', NULL, false, true, 20, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'altura_cm', 'Altura (cm)', 'number', NULL, false, true, 21, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'peso_kg', 'Peso (kg)', 'number', NULL, false, true, 22, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'ancho_pecho_cm', 'Ancho de pecho (cm)', 'number', NULL, false, true, 23, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'ancho_brazo_cm', 'Ancho de brazo (cm)', 'number', NULL, false, true, 24, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'ancho_cintura_cm', 'Ancho de cintura (cm)', 'number', NULL, false, true, 25, NULL),
-- Información de Salud - Compromisos
('d743589d-6a26-474e-8cad-873909885851', 'student', 'compromiso_motor', 'Motor', 'checkbox', NULL, false, true, 26, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'compromiso_cognitivo', 'Cognitivo', 'checkbox', NULL, false, true, 27, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'compromiso_auditivo', 'Auditivo', 'checkbox', NULL, false, true, 28, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'compromiso_visual', 'Visual', 'checkbox', NULL, false, true, 29, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'compromiso_lenguaje', 'Lenguaje', 'checkbox', NULL, false, true, 30, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'informe_medico_compromisos', 'Posee informe médico de compromisos', 'checkbox', NULL, false, true, 31, NULL),
-- Otras Condiciones de Salud
('d743589d-6a26-474e-8cad-873909885851', 'student', 'impedimento_educacion_fisica', '¿Tiene impedimento para practicar Educación Física?', 'checkbox', NULL, false, true, 32, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'intervenido_quirurgicamente', '¿Ha sido intervenido quirúrgicamente?', 'checkbox', NULL, false, true, 33, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'problemas_respiratorios', 'Problemas respiratorios', 'checkbox', NULL, false, true, 34, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'diabetes', 'Diabetes', 'checkbox', NULL, false, true, 35, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'epilepsia', 'Epilepsia', 'checkbox', NULL, false, true, 36, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'alergias', 'Si el estudiante es alérgico por favor describa', 'textarea', NULL, false, true, 37, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'otras_enfermedades', 'Describa si el estudiante padece o ha padecido alguna otra enfermedad', 'textarea', NULL, false, true, 38, NULL),
-- Otros Detalles Médicos
('d743589d-6a26-474e-8cad-873909885851', 'student', 'informe_medico_enfermedad', 'Posee informe médico de alguna enfermedad', 'checkbox', NULL, false, true, 39, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'tratamiento_horario_clases', '¿Recibe tratamiento médico en su horario de clases?', 'checkbox', NULL, false, true, 40, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'medicamentos_requeridos', 'En caso de requerir algún medicamento por favor indique', 'textarea', NULL, false, true, 41, NULL),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'seguro_medico', 'Si el estudiante posee seguro médico por favor describa', 'textarea', NULL, false, true, 42, NULL),
-- Convivencia y Religión
('d743589d-6a26-474e-8cad-873909885851', 'student', 'situacion_matrimonial_padres', 'Situación matrimonial de los padres', 'select', NULL, false, true, 43, '["Matrimonio solo civil", "Matrimonio eclesiástico", "Concubinato", "Separados", "Divorciado (a)", "Padre / Madre Soltero (a)", "Viudo (a)", "Otra"]'),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'quien_vive_alumno', '¿Quién vive con el alumno?', 'select', NULL, false, true, 44, '["Padres", "Padres y Hermanos", "Padres, Hermanos y Otros", "Padres, Hermanos, Otros e Inquilinos", "Otro"]'),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'religion_padres', 'Religión de los padres', 'select', NULL, false, true, 45, '["Ambos católicos", "Ambos protestantes", "Otra"]'),
('d743589d-6a26-474e-8cad-873909885851', 'student', 'compromisos_religiosos', 'Compromisos religiosos del estudiante', 'select', NULL, false, true, 46, '["Bautizado", "Primera comunión", "Confirmación", "Otro"]');

-- Create function to auto-create default student form fields for new schools
CREATE OR REPLACE FUNCTION public.create_default_student_form_fields()
RETURNS TRIGGER AS $$
BEGIN
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
  -- Grado y Contacto
  (NEW.id, 'student', 'nivel_grado', 'Nivel / Grado', 'select', NULL, false, true, 14, NULL),
  (NEW.id, 'student', 'celular', 'Celular', 'phone', NULL, false, true, 15, NULL),
  -- Datos Físicos
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
  -- Información de Salud - Compromisos
  (NEW.id, 'student', 'compromiso_motor', 'Motor', 'checkbox', NULL, false, true, 26, NULL),
  (NEW.id, 'student', 'compromiso_cognitivo', 'Cognitivo', 'checkbox', NULL, false, true, 27, NULL),
  (NEW.id, 'student', 'compromiso_auditivo', 'Auditivo', 'checkbox', NULL, false, true, 28, NULL),
  (NEW.id, 'student', 'compromiso_visual', 'Visual', 'checkbox', NULL, false, true, 29, NULL),
  (NEW.id, 'student', 'compromiso_lenguaje', 'Lenguaje', 'checkbox', NULL, false, true, 30, NULL),
  (NEW.id, 'student', 'informe_medico_compromisos', 'Posee informe médico de compromisos', 'checkbox', NULL, false, true, 31, NULL),
  -- Otras Condiciones de Salud
  (NEW.id, 'student', 'impedimento_educacion_fisica', '¿Tiene impedimento para practicar Educación Física?', 'checkbox', NULL, false, true, 32, NULL),
  (NEW.id, 'student', 'intervenido_quirurgicamente', '¿Ha sido intervenido quirúrgicamente?', 'checkbox', NULL, false, true, 33, NULL),
  (NEW.id, 'student', 'problemas_respiratorios', 'Problemas respiratorios', 'checkbox', NULL, false, true, 34, NULL),
  (NEW.id, 'student', 'diabetes', 'Diabetes', 'checkbox', NULL, false, true, 35, NULL),
  (NEW.id, 'student', 'epilepsia', 'Epilepsia', 'checkbox', NULL, false, true, 36, NULL),
  (NEW.id, 'student', 'alergias', 'Si el estudiante es alérgico por favor describa', 'textarea', NULL, false, true, 37, NULL),
  (NEW.id, 'student', 'otras_enfermedades', 'Describa si el estudiante padece o ha padecido alguna otra enfermedad', 'textarea', NULL, false, true, 38, NULL),
  -- Otros Detalles Médicos
  (NEW.id, 'student', 'informe_medico_enfermedad', 'Posee informe médico de alguna enfermedad', 'checkbox', NULL, false, true, 39, NULL),
  (NEW.id, 'student', 'tratamiento_horario_clases', '¿Recibe tratamiento médico en su horario de clases?', 'checkbox', NULL, false, true, 40, NULL),
  (NEW.id, 'student', 'medicamentos_requeridos', 'En caso de requerir algún medicamento por favor indique', 'textarea', NULL, false, true, 41, NULL),
  (NEW.id, 'student', 'seguro_medico', 'Si el estudiante posee seguro médico por favor describa', 'textarea', NULL, false, true, 42, NULL),
  -- Convivencia y Religión
  (NEW.id, 'student', 'situacion_matrimonial_padres', 'Situación matrimonial de los padres', 'select', NULL, false, true, 43, '["Matrimonio solo civil", "Matrimonio eclesiástico", "Concubinato", "Separados", "Divorciado (a)", "Padre / Madre Soltero (a)", "Viudo (a)", "Otra"]'),
  (NEW.id, 'student', 'quien_vive_alumno', '¿Quién vive con el alumno?', 'select', NULL, false, true, 44, '["Padres", "Padres y Hermanos", "Padres, Hermanos y Otros", "Padres, Hermanos, Otros e Inquilinos", "Otro"]'),
  (NEW.id, 'student', 'religion_padres', 'Religión de los padres', 'select', NULL, false, true, 45, '["Ambos católicos", "Ambos protestantes", "Otra"]'),
  (NEW.id, 'student', 'compromisos_religiosos', 'Compromisos religiosos del estudiante', 'select', NULL, false, true, 46, '["Bautizado", "Primera comunión", "Confirmación", "Otro"]');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-create form fields when a new school is created
CREATE TRIGGER create_default_form_fields_on_school_insert
AFTER INSERT ON schools
FOR EACH ROW
EXECUTE FUNCTION create_default_student_form_fields();