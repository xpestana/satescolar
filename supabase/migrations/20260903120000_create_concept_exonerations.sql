-- Exoneracion de una cuota especifica de un estudiante: el colegio perdona el pendiente completo
-- de esa cuota (hijo de personal, beca, caso social), sin que haya pago ni factura.
--
-- Es distinto del descuento ad-hoc (payment_items.discount_*, migracion 20260902120000), que vive
-- dentro de un pago y rebaja lo que se cobra. La exoneracion se aplica desde el Estado de cuenta,
-- sobre el saldo, y no genera ingreso.
--
-- Efecto sobre el ledger: se conserva el invariante paid_amount + balance = total_amount
-- (paid_amount absorbe lo exonerado, igual que con el descuento) y el estado pasa a 'exonerated'.
-- Como balance queda en 0, la cuota sale de morosos automaticamente. Lo exonerado NO es dinero:
-- el dashboard lo resta de "Total recaudado" y lo muestra en su propio KPI.

-- Reparacion previa: en produccion `student_concept_balances` quedo sin PRIMARY KEY (drift
-- respecto a 20260512155200, que si la declara), asi que no se le puede apuntar una FK. Se
-- restituye la PK sobre `id` (1318 filas, todas con id unico y no nulo al aplicar esta migracion).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.student_concept_balances'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.student_concept_balances ADD PRIMARY KEY (id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.concept_exonerations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  balance_id uuid NOT NULL REFERENCES public.student_concept_balances(id) ON DELETE CASCADE,
  plan_concept_id uuid NOT NULL REFERENCES public.payment_plan_concepts(id) ON DELETE CASCADE,
  -- Monto exonerado, congelado al aplicar: en VES y en la moneda del concepto, para poder
  -- revertir exacto aunque la tasa cambie despues.
  amount_ves numeric NOT NULL CHECK (amount_ves > 0),
  original_amount numeric,
  currency text NOT NULL DEFAULT 'VES',
  exchange_rate numeric NOT NULL DEFAULT 1,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Reversion: no se borra la fila, se marca, para conservar la auditoria de quien exonero
  reverted_at timestamptz,
  reverted_by uuid
);

CREATE INDEX IF NOT EXISTS idx_concept_exonerations_school ON public.concept_exonerations(school_id);
CREATE INDEX IF NOT EXISTS idx_concept_exonerations_student ON public.concept_exonerations(student_id);
CREATE INDEX IF NOT EXISTS idx_concept_exonerations_balance ON public.concept_exonerations(balance_id);
CREATE INDEX IF NOT EXISTS idx_concept_exonerations_year ON public.concept_exonerations(school_year_id);
-- Una cuota no puede tener dos exoneraciones vigentes a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_concept_exonerations_active_balance
  ON public.concept_exonerations(balance_id) WHERE reverted_at IS NULL;

ALTER TABLE public.concept_exonerations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users manage their concept_exonerations" ON public.concept_exonerations;
CREATE POLICY "School users manage their concept_exonerations"
  ON public.concept_exonerations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.school_id = concept_exonerations.school_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.school_id = concept_exonerations.school_id
  ));

DROP POLICY IF EXISTS "Families view their concept_exonerations" ON public.concept_exonerations;
CREATE POLICY "Families view their concept_exonerations"
  ON public.concept_exonerations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.families f ON f.id = s.family_id
    WHERE s.id = concept_exonerations.student_id AND f.user_id = auth.uid()
  ));

-- Nuevo estado del ledger: la cuota no se pago, se exonero. Se distingue de 'paid' para que el
-- estado de cuenta y los reportes puedan mostrarlo tal cual.
ALTER TABLE public.student_concept_balances
  DROP CONSTRAINT IF EXISTS student_concept_balances_status_check;
ALTER TABLE public.student_concept_balances
  ADD CONSTRAINT student_concept_balances_status_check
  CHECK (status IN ('pending','partial','paid','voided','exonerated'));

COMMENT ON TABLE public.concept_exonerations IS
  'Cuotas exoneradas (perdonadas) por el colegio. No generan pago ni ingreso; cierran el saldo de la cuota.';

NOTIFY pgrst, 'reload schema';
