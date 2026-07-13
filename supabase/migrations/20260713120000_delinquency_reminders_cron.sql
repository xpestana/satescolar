-- Schedule the delinquency reminder emails to run DAILY at 12:00 UTC (08:00 hora
-- Venezuela). The Edge Function `send-delinquency-reminders` decides, per school,
-- whether to actually send today based on `delinquency_config.reminder_mode`
-- (never / daily / weekly / monthly_days). Running at 12:00 UTC keeps the UTC
-- calendar day (used inside the function for day-of-week / day-of-month checks)
-- aligned with the Venezuelan calendar day.
--
-- Authorization (service role key) and project URL are read at runtime from
-- Supabase Vault (secrets `service_role_key` and `project_url`), the same secrets
-- used by the payroll monthly report cron — no secret is committed to the repo.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Idempotent: drop any previous definition before (re)scheduling.
SELECT cron.unschedule('delinquency-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delinquency-reminders');

SELECT cron.schedule(
  'delinquency-reminders',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/send-delinquency-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
