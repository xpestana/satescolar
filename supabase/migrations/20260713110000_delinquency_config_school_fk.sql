-- Fix: `delinquency_config.school_id` had no foreign key to `schools`, so PostgREST
-- could not resolve the `schools(...)` embed used by the `send-delinquency-reminders`
-- Edge Function — it failed with:
--   "Could not find a relationship between 'delinquency_config' and 'schools'".
-- That broke the reminder send entirely. Add the FK (and a one-config-per-school
-- unique index) and reload the PostgREST schema cache.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'delinquency_config_school_id_fkey'
      AND table_name = 'delinquency_config'
  ) THEN
    ALTER TABLE public.delinquency_config
      ADD CONSTRAINT delinquency_config_school_id_fkey
      FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS delinquency_config_school_id_key
  ON public.delinquency_config (school_id);

NOTIFY pgrst, 'reload schema';
