-- Family credit ledger: tracks "saldo a favor" (credit balance) generated when a payment's
-- surplus is deliberately saved as a credit for later use, instead of being registered as
-- realized "Otros" income. Append-only ledger (credit/debit rows); balance = sum(credit) - sum(debit).
--
-- Motivation: invoice 016836 left a 20.432,52 VES surplus that staff intended as an "abono"
-- for a future concept, but the UI only offered "Agregar a Otros" (realized income) or leaving
-- it as free-text in `observations`. The surplus was never recorded in any queryable table, so
-- it didn't show up in payment history, the dashboard, or the family's account statement.

CREATE TABLE public.family_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('credit', 'debit')),
  amount_ves numeric NOT NULL CHECK (amount_ves > 0),
  source_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  applied_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_family_credits_family ON public.family_credits(family_id);
CREATE INDEX idx_family_credits_school ON public.family_credits(school_id);
CREATE INDEX idx_family_credits_source_payment ON public.family_credits(source_payment_id);
CREATE INDEX idx_family_credits_applied_payment ON public.family_credits(applied_payment_id);

ALTER TABLE public.family_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users manage their family_credits"
  ON public.family_credits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.school_id = family_credits.school_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.school_id = family_credits.school_id
  ));

CREATE POLICY "Families view their family_credits"
  ON public.family_credits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = family_credits.family_id AND f.user_id = auth.uid()
  ));

-- Available balance for a family (credits - debits). SECURITY INVOKER so RLS still applies:
-- representatives can only compute the balance of their own family, school users of their school.
CREATE OR REPLACE FUNCTION public.get_family_credit_balance(_family_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_ves ELSE -amount_ves END), 0)
  FROM public.family_credits
  WHERE family_id = _family_id;
$$;

-- Backfill: invoice 016836 (payment 184cda02-b34e-49b2-972b-db77d945ea75) left a 20.432,52 VES
-- surplus documented only in `observations` ("ABONO DEL MES DE JULIO 20$ EN BS 20.432,52
-- PENDIENTE DE PAGO 55$"). Record it retroactively as an available credit for that family.
INSERT INTO public.family_credits (school_id, family_id, entry_type, amount_ves, source_payment_id, note, created_by, created_at)
SELECT p.school_id, p.family_id, 'credit', 20432.52, p.id,
       'Abono retroactivo por sobrante en factura 016836: ' || p.observations,
       p.created_by, p.created_at
FROM public.payments p
WHERE p.id = '184cda02-b34e-49b2-972b-db77d945ea75'
  AND p.family_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.family_credits fc WHERE fc.source_payment_id = p.id
  );

NOTIFY pgrst, 'reload schema';
