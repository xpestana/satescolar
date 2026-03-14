
-- Function to populate default primary indicators for a school
CREATE OR REPLACE FUNCTION public.populate_default_primary_indicators(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_grade text;
  v_area_id uuid;
BEGIN
  -- Skip if school already has areas
  IF EXISTS (SELECT 1 FROM primary_indicator_areas WHERE school_id = p_school_id LIMIT 1) THEN
    RETURN;
  END IF;

  FOREACH v_grade IN ARRAY ARRAY['1','2','3','4','5','6'] LOOP

    -- 1. Desempeño estudiantil
    INSERT INTO primary_indicator_areas (school_id, grade_level, name, display_order)
    VALUES (p_school_id, v_grade, 'Desempeño estudiantil', 1)
    RETURNING id INTO v_area_id;
    INSERT INTO primary_grade_indicators (school_id, grade_level, area_id, area_name, description, display_order) VALUES
      (p_school_id, v_grade, v_area_id, 'Desempeño estudiantil', 'Toma decisiones por sí mismo y actúa de forma independiente.', 1),
      (p_school_id, v_grade, v_area_id, 'Desempeño estudiantil', 'Es colaborador.', 2),
      (p_school_id, v_grade, v_area_id, 'Desempeño estudiantil', 'Exterioriza sus sentimientos.', 3),
      (p_school_id, v_grade, v_area_id, 'Desempeño estudiantil', 'Emplea adecuadamente un vocabulario de acuerdo a su nivel de desarrollo.', 4),
      (p_school_id, v_grade, v_area_id, 'Desempeño estudiantil', 'Demuestra orden con útiles personales.', 5),
      (p_school_id, v_grade, v_area_id, 'Desempeño estudiantil', 'Presta atención y atiende las instrucciones dadas.', 6),
      (p_school_id, v_grade, v_area_id, 'Desempeño estudiantil', 'Cumple con sus deberes escolares dentro y fuera de la institución, respetando los tiempos de entrega de las asignaciones.', 7),
      (p_school_id, v_grade, v_area_id, 'Desempeño estudiantil', 'Asiste diariamente a clases, cumpliendo el horario establecido.', 8);

    -- 2. Lenguaje Comunicación y Cultura
    INSERT INTO primary_indicator_areas (school_id, grade_level, name, display_order)
    VALUES (p_school_id, v_grade, 'Lenguaje Comunicación y Cultura', 2)
    RETURNING id INTO v_area_id;
    INSERT INTO primary_grade_indicators (school_id, grade_level, area_id, area_name, description, display_order) VALUES
      (p_school_id, v_grade, v_area_id, 'Lenguaje Comunicación y Cultura', 'Participa en actos de lectura en interacción permanente con diversos materiales impresos: mapas, libros.', 1),
      (p_school_id, v_grade, v_area_id, 'Lenguaje Comunicación y Cultura', 'Reconoce el intercambio oral como medio de comunicación eficaz en la convivencia en la escuela, la familia y la sociedad.', 2),
      (p_school_id, v_grade, v_area_id, 'Lenguaje Comunicación y Cultura', 'Redacta textos breves formando párrafos sencillos sobre temas relacionados con diversas áreas del conocimiento.', 3),
      (p_school_id, v_grade, v_area_id, 'Lenguaje Comunicación y Cultura', 'Escribe con atención a los aspectos formales de legibilidad, presentación, uso de la mayúscula y minúscula.', 4),
      (p_school_id, v_grade, v_area_id, 'Lenguaje Comunicación y Cultura', 'Reconoce la importancia de la lectura y escritura para la satisfacción de necesidades, resolución de problemas, recreación y comprensión del mundo y de sí mismo.', 5),
      (p_school_id, v_grade, v_area_id, 'Lenguaje Comunicación y Cultura', 'Respeta las normas y convenciones de la lengua oral y escrita.', 6),
      (p_school_id, v_grade, v_area_id, 'Lenguaje Comunicación y Cultura', 'Enriquece su vocabulario.', 7),
      (p_school_id, v_grade, v_area_id, 'Lenguaje Comunicación y Cultura', 'Construye formas con diversos materiales y las clasifica de acuerdo con la proporción.', 8),
      (p_school_id, v_grade, v_area_id, 'Lenguaje Comunicación y Cultura', 'Identifica los elementos de expresión plástica en el dibujo y la pintura (línea, color, valor, textura…).', 9),
      (p_school_id, v_grade, v_area_id, 'Lenguaje Comunicación y Cultura', 'Muestra satisfacción al participar en dramatizaciones.', 10),
      (p_school_id, v_grade, v_area_id, 'Lenguaje Comunicación y Cultura', 'Sabe ubicarse en el espacio a través de la producción artística.', 11);

    -- 3. Matemática, Ciencias Naturales y Sociedad
    INSERT INTO primary_indicator_areas (school_id, grade_level, name, display_order)
    VALUES (p_school_id, v_grade, 'Matemática, Ciencias Naturales y Sociedad', 3)
    RETURNING id INTO v_area_id;
    INSERT INTO primary_grade_indicators (school_id, grade_level, area_id, area_name, description, display_order) VALUES
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Escribe y lee cantidades de hasta cuatro cifras.', 1),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Reconoce números pares e impares.', 2),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Construye y completa series progresivas, regresivas y alternas.', 3),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Identifica el valor absoluto y relativo en una cantidad.', 4),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Identifica, ordena y lee los números ordinales.', 5),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Compone y descompone números naturales en unidades, decenas, centenas y unidad de mil.', 6),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Narra experiencias de la vida cotidiana que tengan corta y larga duración con el antes, ahora y después.', 7),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Construye un calendario anual y registra las actividades que realiza.', 8),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Identifica los fenómenos periódicos que ocurren en el ambiente.', 9),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Clasifica los materiales según su origen.', 10),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Reconoce diferentes materiales y su uso.', 11),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Describe las medidas para realizar un huerto escolar.', 12),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Identifica los distintos procesos de siembra.', 13),
      (p_school_id, v_grade, v_area_id, 'Matemática, Ciencias Naturales y Sociedad', 'Identifica las herramientas que se usan para la siembra.', 14);

    -- 4. Ciencias Sociales, Ciudadanía e Identidad
    INSERT INTO primary_indicator_areas (school_id, grade_level, name, display_order)
    VALUES (p_school_id, v_grade, 'Ciencias Sociales, Ciudadanía e Identidad', 4)
    RETURNING id INTO v_area_id;
    INSERT INTO primary_grade_indicators (school_id, grade_level, area_id, area_name, description, display_order) VALUES
      (p_school_id, v_grade, v_area_id, 'Ciencias Sociales, Ciudadanía e Identidad', 'Identifica los miembros de la familia.', 1),
      (p_school_id, v_grade, v_area_id, 'Ciencias Sociales, Ciudadanía e Identidad', 'Muestra equilibrio emocional en la superación de dificultades.', 2),
      (p_school_id, v_grade, v_area_id, 'Ciencias Sociales, Ciudadanía e Identidad', 'Participa en actividades grupales de manera solidaria.', 3),
      (p_school_id, v_grade, v_area_id, 'Ciencias Sociales, Ciudadanía e Identidad', 'Establece relaciones entre los elementos del entorno.', 4),
      (p_school_id, v_grade, v_area_id, 'Ciencias Sociales, Ciudadanía e Identidad', 'Identifica fenómenos a través del tiempo.', 5),
      (p_school_id, v_grade, v_area_id, 'Ciencias Sociales, Ciudadanía e Identidad', 'Identifica las horas en el reloj.', 6),
      (p_school_id, v_grade, v_area_id, 'Ciencias Sociales, Ciudadanía e Identidad', 'Participa en discusiones sobre los deberes y derechos del niño en la escuela y la familia.', 7),
      (p_school_id, v_grade, v_area_id, 'Ciencias Sociales, Ciudadanía e Identidad', 'Representa escenas donde manifiesta los deberes y derechos de los niños.', 8);

    -- 5. Educación Religiosa Escolar
    INSERT INTO primary_indicator_areas (school_id, grade_level, name, display_order)
    VALUES (p_school_id, v_grade, 'Educación Religiosa Escolar', 5)
    RETURNING id INTO v_area_id;
    INSERT INTO primary_grade_indicators (school_id, grade_level, area_id, area_name, description, display_order) VALUES
      (p_school_id, v_grade, v_area_id, 'Educación Religiosa Escolar', 'Representa a la Virgen María a través de un dibujo.', 1),
      (p_school_id, v_grade, v_area_id, 'Educación Religiosa Escolar', 'Reconoce y apoya la labor de los misioneros.', 2),
      (p_school_id, v_grade, v_area_id, 'Educación Religiosa Escolar', 'Describe las cualidades de un amigo.', 3),
      (p_school_id, v_grade, v_area_id, 'Educación Religiosa Escolar', 'Conoce la vida del Doctor José Gregorio Hernández.', 4),
      (p_school_id, v_grade, v_area_id, 'Educación Religiosa Escolar', 'Describe a los miembros de la Familia de Nazaret.', 5),
      (p_school_id, v_grade, v_area_id, 'Educación Religiosa Escolar', 'Reconoce la importancia del nacimiento de Jesús.', 6);

    -- 6. Educación Física Deporte y Recreación
    INSERT INTO primary_indicator_areas (school_id, grade_level, name, display_order)
    VALUES (p_school_id, v_grade, 'Educación Física Deporte y Recreación', 6)
    RETURNING id INTO v_area_id;
    INSERT INTO primary_grade_indicators (school_id, grade_level, area_id, area_name, description, display_order) VALUES
      (p_school_id, v_grade, v_area_id, 'Educación Física Deporte y Recreación', 'Identifica los nombres y la ubicación de las siguientes articulaciones: cuello, hombros, codo, muñecas, tronco, caderas, rodillas, tobillos y los siguientes segmentos corporales: cabeza, tronco, brazos, antebrazos, manos, muslos, piernas y pies.', 1),
      (p_school_id, v_grade, v_area_id, 'Educación Física Deporte y Recreación', 'Identifica las siguientes formaciones grupales: fila, columna, círculo, semicírculo, cuadro y ajedrez.', 2),
      (p_school_id, v_grade, v_area_id, 'Educación Física Deporte y Recreación', 'Coopera con sus compañeros.', 3),
      (p_school_id, v_grade, v_area_id, 'Educación Física Deporte y Recreación', 'Sigue las normas e instrucciones en las actividades en las cuales participa.', 4);

    -- 7. Informática
    INSERT INTO primary_indicator_areas (school_id, grade_level, name, display_order)
    VALUES (p_school_id, v_grade, 'Informática', 7)
    RETURNING id INTO v_area_id;
    INSERT INTO primary_grade_indicators (school_id, grade_level, area_id, area_name, description, display_order) VALUES
      (p_school_id, v_grade, v_area_id, 'Informática', 'Realiza el encendido y apagado del computador de forma correcta.', 1),
      (p_school_id, v_grade, v_area_id, 'Informática', 'Ejecuta juegos didácticos de suma y resta orientados por el docente.', 2),
      (p_school_id, v_grade, v_area_id, 'Informática', 'Identifica las partes del computador (ratón, teclado, monitor, CPU).', 3),
      (p_school_id, v_grade, v_area_id, 'Informática', 'Utiliza el teclado de forma correcta para el desarrollo de diferentes actividades en el laboratorio de informática.', 4),
      (p_school_id, v_grade, v_area_id, 'Informática', 'Mantiene el orden y la disciplina en las clases de informática.', 5);

  END LOOP;
END;
$$;

-- Update the trigger function to also populate default indicators
CREATE OR REPLACE FUNCTION public.create_default_form_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    (NEW.id, 'representative', 'parentesco', 'Parentesco', 'select', 9, false, true, NULL),
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
$$;

-- Seed existing schools
DO $$
DECLARE
  v_school_id uuid;
BEGIN
  FOR v_school_id IN
    SELECT s.id FROM schools s
    WHERE NOT EXISTS (SELECT 1 FROM primary_indicator_areas WHERE school_id = s.id LIMIT 1)
  LOOP
    PERFORM populate_default_primary_indicators(v_school_id);
  END LOOP;
END;
$$;
