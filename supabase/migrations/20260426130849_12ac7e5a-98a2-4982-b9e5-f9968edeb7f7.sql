-- Seed: pre-insertar el colegio "U. E. Colegio Santo Domingo de Guzmán"
-- para que las migraciones históricas que insertan form_fields y otros
-- registros referenciando su id no fallen con FK violation en BDs nuevas
-- (Docker local, restauraciones desde cero, etc.).
--
-- IMPORTANTE: solo datos institucionales públicos. Sin alumnos, familias,
-- docentes, pagos ni notas (PII / LOPNNA).

INSERT INTO public.schools (
  id,
  name,
  phone,
  address,
  dea_code,
  email,
  statistical_code,
  rif,
  institution_type
) VALUES (
  'd743589d-6a26-474e-8cad-873909885851',
  'U. E. Colegio Santo Domingo de Guzmán',
  '0000-0000000',
  'Por configurar',
  'PENDIENTE',
  'contacto@santodomingoguzman.edu.ve',
  'PENDIENTE',
  'J-00000000-0',
  'private'
) ON CONFLICT (id) DO NOTHING;