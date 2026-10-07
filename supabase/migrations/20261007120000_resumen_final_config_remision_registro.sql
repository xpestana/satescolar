-- Resumen Final (primaria y bachillerato 31059/31060), por sección y parte:
--   fecha_remision  → fecha de remisión elegida por el colegio; NULL = por defecto 31-07 del año
--                     de cierre del año escolar.
--   numero_registro → número de registro libre (p. ej. "01-2026"), centrado al pie de la planilla.
ALTER TABLE public.resumen_final_config
  ADD COLUMN IF NOT EXISTS fecha_remision date,
  ADD COLUMN IF NOT EXISTS numero_registro text NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
