ALTER TABLE public.states
  ADD COLUMN IF NOT EXISTS acronym text;
