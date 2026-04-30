-- Backfill de opciones faltantes en form_fields para colegios cuyo trigger
-- corrió en una versión anterior sin los `options` cargados.
-- Idempotente: solo actualiza filas donde options IS NULL.

-- ============ STUDENT ============
UPDATE public.form_fields SET options = '["V","E","CE"]'::jsonb
  WHERE form_type='student' AND field_name='tipo_documento' AND options IS NULL;

UPDATE public.form_fields SET options = '["Masculino","Femenino"]'::jsonb
  WHERE form_type='student' AND field_name='genero' AND options IS NULL;

UPDATE public.form_fields SET options = '["Venezuela"]'::jsonb
  WHERE form_type='student' AND field_name='pais_nacimiento' AND options IS NULL;

UPDATE public.form_fields SET options = '["I Nivel","II Nivel","III Nivel","1er Grado","2do Grado","3er Grado","4to Grado","5to Grado","6to Grado","1er Año","2do Año","3er Año","4to Año","5to Año","6to Año"]'::jsonb
  WHERE form_type='student' AND field_name='nivel_grado' AND options IS NULL;

UPDATE public.form_fields SET options = '["A+","A-","B+","B-","AB+","AB-","O+","O-"]'::jsonb
  WHERE form_type='student' AND field_name='tipo_sangre' AND options IS NULL;

UPDATE public.form_fields SET options = '["No","Sí"]'::jsonb
  WHERE form_type='student' AND field_name IN (
    'usa_lentes','compromiso_motor','compromiso_cognitivo','compromiso_auditivo',
    'compromiso_visual','compromiso_lenguaje','informe_medico_compromisos',
    'impedimento_educacion_fisica','intervenido_quirurgicamente','problemas_respiratorios',
    'diabetes','epilepsia','informe_medico_enfermedad','tratamiento_horario_clases'
  ) AND options IS NULL;

UPDATE public.form_fields SET options = '["2","4","6","8","10","12","14","16","S","M","L","XL"]'::jsonb
  WHERE form_type='student' AND field_name IN ('talla_camisa','talla_pantalon') AND options IS NULL;

UPDATE public.form_fields SET options = '["Matrimonio solo civil","Matrimonio eclesiástico","Concubinato","Separados","Divorciado (a)","Padre / Madre Soltero (a)","Viudo (a)","Otra"]'::jsonb
  WHERE form_type='student' AND field_name='situacion_matrimonial_padres' AND options IS NULL;

UPDATE public.form_fields SET options = '["Padres","Padres y Hermanos","Padres, Hermanos y Otros","Padres, Hermanos, Otros e Inquilinos","Otro"]'::jsonb
  WHERE form_type='student' AND field_name='quien_vive_alumno' AND options IS NULL;

UPDATE public.form_fields SET options = '["Ambos católicos","Ambos protestantes","Otra"]'::jsonb
  WHERE form_type='student' AND field_name='religion_padres' AND options IS NULL;

UPDATE public.form_fields SET options = '["Bautizado","Primera comunión","Confirmación","Otro"]'::jsonb
  WHERE form_type='student' AND field_name='compromisos_religiosos' AND options IS NULL;

-- ============ REPRESENTATIVE ============
UPDATE public.form_fields SET options = '["V","E"]'::jsonb
  WHERE form_type='representative' AND field_name='tipo_documento' AND options IS NULL;

UPDATE public.form_fields SET options = '["Venezuela","Colombia","Ecuador","Perú","Brasil","Chile","Argentina","México","España","Estados Unidos","Otro"]'::jsonb
  WHERE form_type='representative' AND field_name='pais_nacimiento' AND options IS NULL;

UPDATE public.form_fields SET options = '["Sin instrucción","Primaria incompleta","Primaria completa","Secundaria incompleta","Secundaria completa","Técnico superior","Universitario incompleto","Universitario completo","Postgrado"]'::jsonb
  WHERE form_type='representative' AND field_name='nivel_instruccion' AND options IS NULL;

UPDATE public.form_fields SET options = '["No","Sí"]'::jsonb
  WHERE form_type='representative' AND field_name='es_dueno' AND options IS NULL;

UPDATE public.form_fields SET options = '["Masculino","Femenino"]'::jsonb
  WHERE form_type='representative' AND field_name='genero' AND options IS NULL;

UPDATE public.form_fields SET options = '["Padre","Madre","Abuelo(a)","Tío(a)","Hermano(a)","Tutor legal","Otro"]'::jsonb
  WHERE form_type='representative' AND field_name='parentesco_estudiantes' AND options IS NULL;

-- ============ TEACHER ============
UPDATE public.form_fields SET options = '["V","E","P"]'::jsonb
  WHERE form_type='teacher' AND field_name='tipo_documento' AND options IS NULL;

UPDATE public.form_fields SET options = '["Masculino","Femenino"]'::jsonb
  WHERE form_type='teacher' AND field_name='sexo' AND options IS NULL;

UPDATE public.form_fields SET options = '["Venezuela","Colombia","Ecuador","Perú","Chile","Brasil","Argentina","México","Otro"]'::jsonb
  WHERE form_type='teacher' AND field_name='pais_nacimiento' AND options IS NULL;

UPDATE public.form_fields SET options = '["Dirección","Subdirección","Coordinación Académica","Coordinación de Evaluación","Coordinación de Control de Estudios","Departamento de Orientación","Departamento de Bienestar Estudiantil","Departamento de Educación Física","Otro"]'::jsonb
  WHERE form_type='teacher' AND field_name='area_administrativa' AND options IS NULL;

UPDATE public.form_fields SET options = '["Técnico","Universitario","Especialización","Maestría","Doctorado"]'::jsonb
  WHERE form_type='teacher' AND field_name='nivel_instruccion' AND options IS NULL;