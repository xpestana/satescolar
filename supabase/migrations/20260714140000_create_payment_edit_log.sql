-- Audit log for payment edits ("Editar pago" in the family payment history). Editing a payment
-- is destructive at the row level (items/methods are replaced, balances are reverted and
-- reapplied), so a before/after snapshot + mandatory reason is kept here for traceability —
-- unlike family_credits (an append-only ledger of money), this is a pure audit trail.

CREATE TABLE public.payment_edit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  edited_by uuid NOT NULL,
  reason text NOT NULL,
  before_snapshot jsonb NOT NULL,
  after_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_edit_log_payment ON public.payment_edit_log(payment_id);
CREATE INDEX idx_payment_edit_log_school ON public.payment_edit_log(school_id);

ALTER TABLE public.payment_edit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users manage their payment_edit_log"
  ON public.payment_edit_log FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.school_id = payment_edit_log.school_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.school_id = payment_edit_log.school_id
  ));

NOTIFY pgrst, 'reload schema';
