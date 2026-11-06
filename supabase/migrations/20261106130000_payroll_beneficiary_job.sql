-- Job title and hire date of staff paid by payroll, shown on the payroll sheet the accountant
-- receives. Optional; suppliers don't use them.

ALTER TABLE public.payroll_beneficiaries
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS hire_date date;

NOTIFY pgrst, 'reload schema';
