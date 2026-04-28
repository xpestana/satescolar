-- Pre-seed de colegios para migraciones desde cero (Docker local, BDs nuevas).
-- Se ejecuta ANTES de aplicar las migraciones SQL en supabase/migrations/
-- (ver scripts/import-to-local.sh y scripts/run-migrations.sh).
--
-- Motivo: algunas migraciones históricas insertan filas (form_fields, etc.)
-- referenciando un school_id concreto que en producción ya existía pero en
-- una BD nueva no, provocando FK violation:
--   "form_fields_school_id_fkey ... Key (school_id)=(d743589d-...)
--    is not present in table schools".
--
-- Solo datos institucionales públicos. Sin alumnos, familias, docentes,
-- pagos ni notas (PII / LOPNNA).
--
-- Idempotente: ON CONFLICT DO NOTHING permite re-ejecutarlo sin daño.
--
-- IMPORTANTE: este script asume que la tabla `public.schools` ya existe.
-- Por eso NO se aplica antes de la primera migración (que la crea), sino
-- justo después de que el esquema base esté listo. Los runners lo ejecutan
-- después de aplicar las migraciones que crean `public.schools` y antes
-- de las que insertan datos referenciándolo.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'schools'
  ) THEN
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
  END IF;
END $$;
