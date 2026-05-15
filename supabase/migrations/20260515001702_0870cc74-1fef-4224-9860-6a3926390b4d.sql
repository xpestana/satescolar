
-- Add invoice_number to payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS invoice_number text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_payments_invoice_number ON public.payments(school_id, invoice_number);

-- payment_reports table
CREATE TABLE IF NOT EXISTS public.payment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL,
  plan_concept_id uuid REFERENCES public.payment_plan_concepts(id) ON DELETE SET NULL,
  concept_name text NOT NULL DEFAULT '',
  amount_reported numeric NOT NULL DEFAULT 0,
  currency_reported text NOT NULL DEFAULT 'VES',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  school_payment_method_id uuid REFERENCES public.school_payment_methods(id) ON DELETE SET NULL,
  school_method_label text NOT NULL DEFAULT '',
  payer_method text NOT NULL DEFAULT 'transferencia',
  payer_bank_name text NOT NULL DEFAULT '',
  payer_phone text NOT NULL DEFAULT '',
  payer_document text NOT NULL DEFAULT '',
  payer_account_email text NOT NULL DEFAULT '',
  payer_account_holder text NOT NULL DEFAULT '',
  reference_code text NOT NULL DEFAULT '',
  receipt_url text NOT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  confirmed_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  confirmed_by uuid,
  confirmed_at timestamptz,
  rejection_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_reports_school_status ON public.payment_reports(school_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_reports_family ON public.payment_reports(family_id);
CREATE INDEX IF NOT EXISTS idx_payment_reports_student ON public.payment_reports(student_id);

CREATE TRIGGER trg_payment_reports_updated_at
  BEFORE UPDATE ON public.payment_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payment_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all payment_reports"
  ON public.payment_reports FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Families can insert their payment_reports"
  ON public.payment_reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.families f
      WHERE f.id = payment_reports.family_id
        AND f.user_id = auth.uid()
    )
  );

CREATE POLICY "Families can view their payment_reports"
  ON public.payment_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.families f
      WHERE f.id = payment_reports.family_id
        AND f.user_id = auth.uid()
    )
  );

CREATE POLICY "School users view their payment_reports"
  ON public.payment_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = payment_reports.school_id
    )
  );

CREATE POLICY "School users update their payment_reports"
  ON public.payment_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = payment_reports.school_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = payment_reports.school_id
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_reports;

-- Receipts bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Families upload their payment receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND EXISTS (
      SELECT 1 FROM public.families f
      WHERE f.user_id = auth.uid()
        AND f.id::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "Families view their payment receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-receipts'
    AND EXISTS (
      SELECT 1 FROM public.families f
      WHERE f.user_id = auth.uid()
        AND f.id::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "School users view payment receipts of their school"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-receipts'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Admins view all payment receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-receipts' AND is_admin());
