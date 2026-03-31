
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create bcv_rates table (global, not per school)
CREATE TABLE public.bcv_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL,
  rate_to_ves numeric NOT NULL,
  published_date date NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (currency, published_date)
);

-- RLS
ALTER TABLE public.bcv_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bcv_rates"
  ON public.bcv_rates FOR SELECT
  TO authenticated
  USING (true);
