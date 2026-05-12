ALTER TABLE public.payment_plan_concepts
  ADD COLUMN IF NOT EXISTS due_month smallint
  CHECK (due_month IS NULL OR (due_month BETWEEN 1 AND 12));

COMMENT ON COLUMN public.payment_plan_concepts.due_month IS
  'Mes (1-12) en que vence el concepto dentro del año escolar. Para conceptos recurrentes indica el primer mes de obligación. Combinado con due_day y el year_range determina la fecha exacta de vencimiento.';

NOTIFY pgrst, 'reload schema';