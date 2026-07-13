ALTER TABLE families
  ADD COLUMN IF NOT EXISTS default_invoice JSONB;
