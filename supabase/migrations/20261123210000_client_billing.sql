-- Clients & billing (CRM) for the SAT Escolar platform admin (/admin/clientes).
--
-- Every school is a client account (created automatically when the school is created). The
-- admin marks it as demo / real client / inactive, sets the monthly fee and the first billable
-- month, records which months were paid (one row per month) and who receives the billing emails:
-- the school's owner users ("usuario principal", optional) plus extra contacts.
-- The Edge Function `client-billing` sends the reminder (pending months) and thank-you emails.
-- Only platform admins can read or write these tables (RLS with is_admin()).

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  account_type text NOT NULL DEFAULT 'demo' CHECK (account_type IN ('demo', 'client', 'inactive')),
  monthly_fee_usd numeric(10, 2) CHECK (monthly_fee_usd IS NULL OR monthly_fee_usd >= 0),
  billing_start_month date CHECK (billing_start_month IS NULL OR EXTRACT(DAY FROM billing_start_month) = 1),
  demo_ends_on date,
  contact_name text,
  contact_phone text,
  notify_owner boolean NOT NULL DEFAULT true,
  reminders_enabled boolean NOT NULL DEFAULT true,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_billing_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  name text,
  email text NOT NULL CHECK (position('@' IN email) > 1),
  role_label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS client_billing_contacts_account_email_key
  ON public.client_billing_contacts (client_account_id, lower(email));

CREATE TABLE IF NOT EXISTS public.client_billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  period_month date NOT NULL CHECK (EXTRACT(DAY FROM period_month) = 1),
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'waived')),
  amount_usd numeric(10, 2) CHECK (amount_usd IS NULL OR amount_usd >= 0),
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  reference text,
  notes text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_account_id, period_month)
);

CREATE TABLE IF NOT EXISTS public.client_billing_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('reminder', 'thanks')),
  recipients text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL,
  months date[] NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message text,
  triggered_by text NOT NULL DEFAULT 'admin' CHECK (triggered_by IN ('admin', 'cron')),
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_billing_emails_account_sent_idx
  ON public.client_billing_emails (client_account_id, sent_at DESC);

-- Single row with the platform-wide billing settings.
CREATE TABLE IF NOT EXISTS public.client_billing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  reminder_days integer[] NOT NULL DEFAULT '{15}'
    CHECK (reminder_days <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28]),
  payment_instructions text,
  contact_phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.client_billing_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ─── updated_at ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_client_accounts_updated_at ON public.client_accounts;
CREATE TRIGGER update_client_accounts_updated_at
  BEFORE UPDATE ON public.client_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_billing_settings_updated_at ON public.client_billing_settings;
CREATE TRIGGER update_client_billing_settings_updated_at
  BEFORE UPDATE ON public.client_billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Every new school becomes a client account (as a demo until the admin says otherwise) ───

CREATE OR REPLACE FUNCTION public.create_client_account_for_school()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.client_accounts (school_id) VALUES (NEW.id)
  ON CONFLICT (school_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_client_account_on_school_insert ON public.schools;
CREATE TRIGGER create_client_account_on_school_insert
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.create_client_account_for_school();

-- Existing schools.
INSERT INTO public.client_accounts (school_id)
SELECT id FROM public.schools
ON CONFLICT (school_id) DO NOTHING;

-- ─── Owner users ("usuario principal") of every school, for the admin ───────

CREATE OR REPLACE FUNCTION public.admin_school_owner_contacts()
RETURNS TABLE (school_id uuid, user_id uuid, email text, full_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo el administrador puede ver los usuarios principales' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON (ur.school_id, ur.user_id)
    ur.school_id, ur.user_id, u.email::text, p.full_name
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'school' AND ur.is_owner IS TRUE AND ur.school_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_school_owner_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_school_owner_contacts() TO authenticated;

-- ─── RLS: platform admins only ───────────────────────────────────────────────

ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_billing_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_billing_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_billing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage client_accounts" ON public.client_accounts;
CREATE POLICY "Admins manage client_accounts" ON public.client_accounts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage client_billing_contacts" ON public.client_billing_contacts;
CREATE POLICY "Admins manage client_billing_contacts" ON public.client_billing_contacts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage client_billing_payments" ON public.client_billing_payments;
CREATE POLICY "Admins manage client_billing_payments" ON public.client_billing_payments
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins read client_billing_emails" ON public.client_billing_emails;
CREATE POLICY "Admins read client_billing_emails" ON public.client_billing_emails
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage client_billing_settings" ON public.client_billing_settings;
CREATE POLICY "Admins manage client_billing_settings" ON public.client_billing_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── Daily cron: 13:00 UTC (09:00 Venezuela). The function sends only on the configured days ───

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('client-billing-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'client-billing-reminders');

SELECT cron.schedule(
  'client-billing-reminders',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/client-billing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{"action":"run_reminders"}'::jsonb
  );
  $$
);
