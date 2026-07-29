-- Track the amount each payment item settles in the CONCEPT'S original currency
-- (e.g. USD), valued at the exchange rate of the day the payment was made.
--
-- Rationale: partial payments (abonos) of a USD installment made on different days
-- must each settle their USD portion at that day's BCV rate. Storing only the VES
-- amount loses the rate context and makes the ledger drift when the rate changes
-- between abonos. `original_amount` records the exact original-currency portion so
-- balances can be reconstructed and payment edits reverted precisely.
--
-- Nullable: legacy rows keep NULL and fall back to amount_ves / current snapshot.

ALTER TABLE public.payment_items
  ADD COLUMN IF NOT EXISTS original_amount numeric;

COMMENT ON COLUMN public.payment_items.original_amount IS
  'Portion of the concept settled in the concept''s original currency (e.g. USD), '
  'valued at the payment-day rate. NULL for legacy rows (pre 2026-07-29).';

NOTIFY pgrst, 'reload schema';
