
-- Create teachers table (each teacher belongs to ONE school)
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  document_id text,
  email text,
  phone text,
  photo_url text,
  form_data jsonb DEFAULT '{}'::jsonb,
  is_suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all teachers"
  ON public.teachers FOR ALL USING (is_admin());

CREATE POLICY "School users can view their teachers"
  ON public.teachers FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = teachers.school_id));

CREATE POLICY "School users can insert their teachers"
  ON public.teachers FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = teachers.school_id));

CREATE POLICY "School users can update their teachers"
  ON public.teachers FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = teachers.school_id));

CREATE POLICY "School users can delete their teachers"
  ON public.teachers FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = teachers.school_id));

CREATE TRIGGER update_teachers_updated_at
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update the create_default_form_fields function to include teacher defaults
CREATE OR REPLACE FUNCTION public.create_default_form_fields()
RETURNS TRIGGER AS $$
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Insert default teacher form fields for existing schools
DO $$
DECLARE
  school RECORD;
  t_basic_gid uuid;
  t_contact_gid uuid;
  t_employment_gid uuid;
BEGIN
  FOR school IN SELECT id FROM public.schools LOOP
    IF NOT EXISTS (SELECT 1 FROM form_field_groups WHERE school_id = school.id AND form_type = 'teacher') THEN
      INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
      VALUES (school.id, 'teacher', 'Datos Básicos', 'Información básica del docente', 0) RETURNING id INTO t_basic_gid;
      INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
      VALUES (school.id, 'teacher', 'Contacto', 'Información de contacto del docente', 1) RETURNING id INTO t_contact_gid;
      INSERT INTO form_field_groups (school_id, form_type, name, description, display_order)
      VALUES (school.id, 'teacher', 'Empleo', 'Información laboral del docente', 2) RETURNING id INTO t_employment_gid;

      INSERT INTO form_fields (school_id, form_type, field_name, field_label, field_type, is_required, field_order, options, group_id) VALUES
        (school.id, 'teacher', 'tipo_documento', 'Tipo', 'select', true, 0, '["V", "E", "P"]', t_basic_gid),
        (school.id, 'teacher', 'documento', 'Nro de Documento', 'text', true, 1, null, t_basic_gid),
        (school.id, 'teacher', 'primer_nombre', 'Primer Nombre', 'text', true, 2, null, t_basic_gid),
        (school.id, 'teacher', 'segundo_nombre', 'Segundo Nombre', 'text', false, 3, null, t_basic_gid),
        (school.id, 'teacher', 'primer_apellido', 'Primer Apellido', 'text', true, 4, null, t_basic_gid),
        (school.id, 'teacher', 'segundo_apellido', 'Segundo Apellido', 'text', true, 5, null, t_basic_gid),
        (school.id, 'teacher', 'sexo', 'Sexo', 'select', true, 6, '["Masculino", "Femenino"]', t_basic_gid),
        (school.id, 'teacher', 'fecha_nacimiento', 'Fecha de Nacimiento', 'date', true, 7, null, t_basic_gid),
        (school.id, 'teacher', 'pais_nacimiento', 'País', 'select', true, 8, '["Venezuela", "Colombia", "Ecuador", "Perú", "Chile", "Brasil", "Argentina", "México", "Otro"]', t_basic_gid),
        (school.id, 'teacher', 'numero_contacto', 'Celular', 'phone', true, 9, null, t_contact_gid),
        (school.id, 'teacher', 'correo_electronico', 'Correo Electrónico', 'email', true, 10, null, t_contact_gid),
        (school.id, 'teacher', 'cargo', 'Cargo', 'text', true, 11, null, t_employment_gid),
        (school.id, 'teacher', 'area_administrativa', 'Área Administrativa Adscrita', 'select', true, 12, '["Dirección", "Subdirección", "Coordinación Académica", "Coordinación de Evaluación", "Coordinación de Control de Estudios", "Departamento de Orientación", "Departamento de Bienestar Estudiantil", "Departamento de Educación Física", "Otro"]', t_employment_gid),
        (school.id, 'teacher', 'fecha_ingreso', 'Fecha de Empleo', 'date', true, 13, null, t_employment_gid),
        (school.id, 'teacher', 'nivel_instruccion', 'Nivel de Instrucción', 'select', false, 14, '["Técnico", "Universitario", "Especialización", "Maestría", "Doctorado"]', t_employment_gid),
        (school.id, 'teacher', 'titulo', 'Título Obtenido', 'text', false, 15, null, t_employment_gid),
        (school.id, 'teacher', 'observaciones', 'Observaciones', 'textarea', false, 16, null, t_employment_gid);
    END IF;
  END LOOP;
END $$;
