-- Schedule the monthly payroll report email (to each school owner) on the 1st of
-- each month at 06:00 UTC. The Edge Function computes the previous month.
--
-- The Authorization (service role key) and project URL are read at runtime from
-- Supabase Vault (secrets `service_role_key` and `project_url`) so no secret is
-- ever committed to the repository. Those secrets are created out-of-band, once,
-- with vault.create_secret(...).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Idempotent: drop any previous definition before (re)scheduling.
SELECT cron.unschedule('payroll-monthly-report')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'payroll-monthly-report');

SELECT cron.schedule(
  'payroll-monthly-report',
  '0 6 1 * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/send-payroll-monthly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
