-- Definitiva Final de bachillerato (momento = 0): el colegio marca por estudiante y materia si fue
-- Asistente (por defecto) o Inasistente. El Resumen Final 31059/31060 cuenta estudiantes con esta
-- marca en "Total de Áreas de Formación" (antes sumaba los días de asistencia de cada estudiante).
ALTER TABLE public.final_grades
  ADD COLUMN IF NOT EXISTS is_final_absentee boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
