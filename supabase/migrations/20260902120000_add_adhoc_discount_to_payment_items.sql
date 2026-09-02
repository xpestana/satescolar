-- Descuento ad-hoc por cuota, capturado al registrar el pago (media mensualidad por ingresar
-- a mitad de mes, condonaciones puntuales, becas de un mes, etc.).
--
-- Es DISTINTO del descuento del plan (payment_plan_concepts.discount_type/discount_value), que
-- se aplica al sembrar el saldo (discounted_plan_concept_amount) y no cambia. Este vive en la
-- linea del pago y solo afecta a ese pago.
--
-- Regla de cobertura:  cuota saldada = amount_ves (efectivo) + discount_amount_ves (condonado).
-- Por eso amount_ves sigue siendo SOLO efectivo y el reporte de Ingresos sigue cuadrando con
-- payments.total_amount_ves. En student_concept_balances se mantiene el invariante
-- paid_amount + balance = total_amount, de modo que paid_amount absorbe el descuento (si no,
-- una cuota condonada al 100% quedaria con paid_amount = 0 y el trigger
-- sync_unpaid_balances_for_plan_concept podria reabrirla al editar el plan).

ALTER TABLE public.payment_items
  ADD COLUMN IF NOT EXISTS discount_amount_ves      numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_original_amount numeric,
  ADD COLUMN IF NOT EXISTS discount_type            text    NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value           numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason          text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_items_discount_type_check') THEN
    ALTER TABLE public.payment_items
      ADD CONSTRAINT payment_items_discount_type_check
      CHECK (discount_type IN ('none', 'fixed', 'percentage'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_items_discount_amount_check') THEN
    ALTER TABLE public.payment_items
      ADD CONSTRAINT payment_items_discount_amount_check
      CHECK (discount_amount_ves >= 0 AND COALESCE(discount_original_amount, 0) >= 0 AND discount_value >= 0);
  END IF;

  -- Motivo obligatorio cuando hay descuento: la regla vive tambien en la base, no solo en la UI.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_items_discount_reason_check') THEN
    ALTER TABLE public.payment_items
      ADD CONSTRAINT payment_items_discount_reason_check
      CHECK (discount_amount_ves <= 0 OR btrim(COALESCE(discount_reason, '')) <> '');
  END IF;
END $$;

COMMENT ON COLUMN public.payment_items.discount_amount_ves IS
  'Descuento ad-hoc concedido en esta linea, en VES a la tasa del pago. No es ingreso: la cuota se salda con amount_ves + discount_amount_ves.';
COMMENT ON COLUMN public.payment_items.discount_original_amount IS
  'El mismo descuento en la moneda del concepto (USD/EUR/COP), a la tasa del pago. NULL si la cuota es en VES.';
COMMENT ON COLUMN public.payment_items.discount_type IS
  'Como se capturo el descuento: none | fixed (monto en la moneda del concepto) | percentage (% del pendiente).';
COMMENT ON COLUMN public.payment_items.discount_value IS
  'Valor tal como lo escribio el usuario: monto en la moneda del concepto (fixed) o porcentaje 0-100 (percentage).';
COMMENT ON COLUMN public.payment_items.discount_reason IS
  'Motivo obligatorio del descuento, visible en el comprobante y en el estado de cuenta.';

NOTIFY pgrst, 'reload schema';
