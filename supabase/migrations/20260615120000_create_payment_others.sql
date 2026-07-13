CREATE TABLE IF NOT EXISTS payment_others (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL,
  amount_ves      NUMERIC NOT NULL,
  invoice_number  TEXT,
  notes           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payment_others ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_users_manage_payment_others" ON payment_others;
CREATE POLICY "school_users_manage_payment_others"
ON payment_others FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = payment_others.school_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = payment_others.school_id
));
