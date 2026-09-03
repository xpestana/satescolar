-- La exoneracion se aplica desde el REGISTRO DE PAGO (junto al descuento de la cuota): al
-- registrar el pago se marca que tal cuota no la va a pagar el estudiante. Se guarda con que
-- pago se aplico, para poder rastrearla desde el comprobante y desde el reporte de pagos.
--
-- Es nullable porque una exoneracion puede aplicarse sin cobrar nada (todas las cuotas del
-- pago exoneradas), en cuyo caso no se emite factura y no hay payment_id.

ALTER TABLE public.concept_exonerations
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_concept_exonerations_payment ON public.concept_exonerations(payment_id);

COMMENT ON COLUMN public.concept_exonerations.payment_id IS
  'Pago durante cuyo registro se aplico la exoneracion. NULL si se exonero sin cobrar nada.';

NOTIFY pgrst, 'reload schema';
