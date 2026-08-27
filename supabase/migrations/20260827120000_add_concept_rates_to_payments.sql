-- Congela en el propio pago la tasa con la que se convirtieron sus conceptos en divisas.
--
-- Las cuotas estan fijadas en USD/EUR y se cobran en bolivares a la tasa del dia. Hasta ahora esa
-- tasa no se guardaba en ninguna parte: al editar un pago habia que reconstruirla dividiendo los
-- bolivares cobrados entre `payment_items.original_amount`, y en las lineas viejas (sin ese campo)
-- se caia al `exchange_rate_snapshot` del saldo, que se revalua con cada pago posterior. Cuando esa
-- reconstruccion fallaba, editar un pago para corregir un nombre lo revaluaba a la tasa de hoy e
-- inventaba deuda (facturas 016255 y 016313).
--
-- Con la tasa guardada, editar un pago es exacto y no depende de datos que cambian con el tiempo.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS concept_rates jsonb;

COMMENT ON COLUMN public.payments.concept_rates IS
  'Tasa aplicada a los conceptos en moneda extranjera de este pago, por codigo de moneda: {"USD": 156.37}. Congela la conversion del dia del pago para que editarlo no lo revalue.';

-- Backfill desde las lineas que ya guardan la porcion liquidada en moneda original.
-- Los pagos cuyas lineas son todas legacy (original_amount NULL) quedan en NULL: la app sigue
-- reconstruyendo la tasa para esos, que es lo mejor disponible sin inventar un dato.
WITH per_currency AS (
  SELECT
    i.payment_id,
    COALESCE(scb.currency, ppc.currency, pc.currency) AS currency,
    sum(i.amount_ves)      AS ves,
    sum(i.original_amount) AS orig
  FROM public.payment_items i
  JOIN public.payments p ON p.id = i.payment_id
  JOIN public.payment_plan_concepts ppc ON ppc.id = i.plan_concept_id
  LEFT JOIN public.payment_concepts pc ON pc.id = ppc.concept_id
  LEFT JOIN public.student_concept_balances scb
    ON scb.plan_concept_id = i.plan_concept_id
   AND scb.student_id      = i.student_id
   AND scb.school_year_id  = p.school_year_id
  WHERE i.original_amount IS NOT NULL
    AND i.original_amount > 0
  GROUP BY 1, 2
),
rates AS (
  SELECT payment_id, jsonb_object_agg(currency, round(ves / orig, 6)) AS rates
  FROM per_currency
  WHERE currency IS NOT NULL
    AND currency <> 'VES'
    AND orig > 0
    AND ves > 0
  GROUP BY payment_id
)
UPDATE public.payments p
SET concept_rates = r.rates
FROM rates r
WHERE p.id = r.payment_id
  AND p.concept_rates IS NULL;

NOTIFY pgrst, 'reload schema';
