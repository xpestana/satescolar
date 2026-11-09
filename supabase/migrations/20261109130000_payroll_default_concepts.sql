-- Concepts that come already filled in when registering a salary payment, so most workers only
-- need a review. A concept can be on by default for every worker or only some categories
-- (docentes, obreros...), and each worker can have their own amount or leave a concept out.

ALTER TABLE public.payroll_concepts
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  -- Empty = every category.
  ADD COLUMN IF NOT EXISTS default_categories text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.payroll_concepts
  DROP CONSTRAINT IF EXISTS payroll_concepts_default_categories_check;
ALTER TABLE public.payroll_concepts
  ADD CONSTRAINT payroll_concepts_default_categories_check
  CHECK (default_categories <@ ARRAY['teacher','admin','worker','other']::text[]);

-- A worker's own concepts: their amount (salary 2 $ instead of 1,5 $), a concept that's only
-- theirs, or one of the defaults they don't get (enabled = false).
CREATE TABLE IF NOT EXISTS public.payroll_beneficiary_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.payroll_beneficiaries(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES public.payroll_concepts(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  -- NULL = the concept's default amount. In the concept's currency.
  amount numeric CHECK (amount IS NULL OR amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_beneficiary_concepts_uq UNIQUE (beneficiary_id, concept_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_beneficiary_concepts_school ON public.payroll_beneficiary_concepts(school_id);

ALTER TABLE public.payroll_beneficiary_concepts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all payroll_beneficiary_concepts" ON public.payroll_beneficiary_concepts;
CREATE POLICY "Admins manage all payroll_beneficiary_concepts" ON public.payroll_beneficiary_concepts FOR ALL
  USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "School staff read payroll_beneficiary_concepts" ON public.payroll_beneficiary_concepts;
CREATE POLICY "School staff read payroll_beneficiary_concepts" ON public.payroll_beneficiary_concepts FOR SELECT
  USING ((select public.is_school_staff(payroll_beneficiary_concepts.school_id)));

-- Whoever registers beneficiaries keeps their concepts.
DROP POLICY IF EXISTS "Register manages payroll_beneficiary_concepts" ON public.payroll_beneficiary_concepts;
CREATE POLICY "Register manages payroll_beneficiary_concepts" ON public.payroll_beneficiary_concepts FOR ALL
  USING (public.payroll_can(school_id, 'payroll.register'))
  WITH CHECK (
    public.payroll_can(school_id, 'payroll.register')
    AND EXISTS (SELECT 1 FROM public.payroll_beneficiaries b WHERE b.id = beneficiary_id AND b.school_id = payroll_beneficiary_concepts.school_id)
    AND EXISTS (SELECT 1 FROM public.payroll_concepts c WHERE c.id = concept_id AND c.school_id = payroll_beneficiary_concepts.school_id)
  );

NOTIFY pgrst, 'reload schema';
