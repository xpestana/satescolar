-- New staff category: Junta directiva y socios (board members and partners paid by payroll).

ALTER TABLE public.payroll_beneficiaries
  DROP CONSTRAINT IF EXISTS payroll_beneficiaries_category_check;
ALTER TABLE public.payroll_beneficiaries
  ADD CONSTRAINT payroll_beneficiaries_category_check
  CHECK (category IN ('teacher','admin','worker','board','supplier','other'));

ALTER TABLE public.payroll_concepts
  DROP CONSTRAINT IF EXISTS payroll_concepts_default_categories_check;
ALTER TABLE public.payroll_concepts
  ADD CONSTRAINT payroll_concepts_default_categories_check
  CHECK (default_categories <@ ARRAY['teacher','admin','worker','board','other']::text[]);
