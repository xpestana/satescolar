-- Editable welcome email for school staff (owner and sub-users): new template type
-- 'welcome-staff'. Only widens the allowed values of email_templates.template_type; no data
-- changes. Idempotent: drops whatever CHECK constraint guards template_type and recreates it.

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'email_templates'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%template_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.email_templates DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_template_type_check
  CHECK (template_type IN ('welcome-family', 'welcome-teacher', 'welcome-staff', 'delinquency', 'payment-reminder'));
