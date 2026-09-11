-- ============================================================================
-- Planes de pago por año escolar
--
-- Antes, payment_plans / payment_plan_concepts no tenían año y se compartían entre años:
--   * editar monto/descuento de una cuota del plan reescribía (sync_unpaid_balances_for_plan_concept)
--     las cuotas sin pago de TODOS los años;
--   * cambiar la moneda cambiaba el monto pero no la moneda ni la tasa de esas cuotas;
--   * agregar un concepto al plan creaba la cuota a estudiantes de cualquier año;
--   * borrar un concepto/plan borraba en cascada líneas de facturas (payment_items) y exoneraciones.
--
-- Ahora cada plan pertenece a un año (payment_plans.school_year_id). Los planes existentes quedan
-- en el año más antiguo en que se usan y se clonan para los años posteriores donde ya estaban
-- asignados. Idempotente.
-- ============================================================================

BEGIN;

-- 1. Columna de año ----------------------------------------------------------
ALTER TABLE public.payment_plans
  ADD COLUMN IF NOT EXISTS school_year_id uuid REFERENCES public.school_years(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_payment_plans_school_year
  ON public.payment_plans (school_id, school_year_id);

-- 2. Backfill + 3. clonado ---------------------------------------------------
DO $$
DECLARE
  r        record;
  a        record;
  v_target uuid;
  v_copy   uuid;
BEGIN
  -- Cada plan sin año → el año más antiguo en que está asignado; si no está asignado, el año más
  -- antiguo con asignaciones del colegio; si no hay ninguna, el activo; si no, el más reciente.
  FOR r IN SELECT * FROM public.payment_plans WHERE school_year_id IS NULL LOOP
    v_target := NULL;

    SELECT sy.id INTO v_target
    FROM public.student_payment_plans spp
    JOIN public.school_years sy ON sy.id = spp.school_year_id
    WHERE spp.plan_id = r.id
    ORDER BY sy.year_range ASC
    LIMIT 1;

    IF v_target IS NULL THEN
      SELECT sy.id INTO v_target
      FROM public.student_payment_plans spp
      JOIN public.school_years sy ON sy.id = spp.school_year_id
      WHERE spp.school_id = r.school_id
      ORDER BY sy.year_range ASC
      LIMIT 1;
    END IF;

    IF v_target IS NULL THEN
      SELECT id INTO v_target FROM public.school_years
      WHERE school_id = r.school_id AND is_active
      LIMIT 1;
    END IF;

    IF v_target IS NULL THEN
      SELECT id INTO v_target FROM public.school_years
      WHERE school_id = r.school_id
      ORDER BY year_range DESC
      LIMIT 1;
    END IF;

    IF v_target IS NULL THEN
      RAISE EXCEPTION 'El plan % (%) no tiene ningún año escolar posible', r.name, r.id;
    END IF;

    UPDATE public.payment_plans SET school_year_id = v_target WHERE id = r.id;
  END LOOP;

  -- Asignaciones en un año distinto al del plan → copia del plan en ese año y se mueven allí.
  FOR a IN
    SELECT DISTINCT spp.plan_id, spp.school_year_id, pp.school_id, pp.name
    FROM public.student_payment_plans spp
    JOIN public.payment_plans pp ON pp.id = spp.plan_id
    WHERE spp.school_year_id <> pp.school_year_id
  LOOP
    -- Mover la asignación retira las cuotas sin pago y siembra las de la copia; si alguna ya tiene
    -- pagos no se puede hacer a ciegas.
    IF EXISTS (
      SELECT 1
      FROM public.student_concept_balances scb
      JOIN public.payment_plan_concepts ppc ON ppc.id = scb.plan_concept_id
      WHERE ppc.plan_id = a.plan_id
        AND scb.school_year_id = a.school_year_id
        AND COALESCE(scb.paid_amount, 0) > 0
    ) THEN
      RAISE EXCEPTION 'El plan % tiene cuotas con pagos en el año %: revisar a mano', a.name, a.school_year_id;
    END IF;

    v_copy := NULL;
    SELECT id INTO v_copy FROM public.payment_plans
    WHERE school_id = a.school_id AND school_year_id = a.school_year_id AND name = a.name
    LIMIT 1;

    IF v_copy IS NULL THEN
      INSERT INTO public.payment_plans (school_id, school_year_id, name, description, is_active)
      SELECT school_id, a.school_year_id, name, description, is_active
      FROM public.payment_plans WHERE id = a.plan_id
      RETURNING id INTO v_copy;

      INSERT INTO public.payment_plan_concepts (
        plan_id, concept_id, amount, currency, display_order, is_mandatory, is_recurring,
        due_day, due_month, discount_type, discount_value
      )
      SELECT v_copy, concept_id, amount, currency, display_order, is_mandatory, is_recurring,
             due_day, due_month, discount_type, discount_value
      FROM public.payment_plan_concepts WHERE plan_id = a.plan_id;
    END IF;

    UPDATE public.student_payment_plans
    SET plan_id = v_copy
    WHERE plan_id = a.plan_id AND school_year_id = a.school_year_id;
  END LOOP;
END $$;

-- 4. Obligatorio -------------------------------------------------------------
ALTER TABLE public.payment_plans ALTER COLUMN school_year_id SET NOT NULL;

-- 5. Guardias de coherencia --------------------------------------------------
-- Un estudiante solo puede tener asignado un plan del mismo año de la asignación.
CREATE OR REPLACE FUNCTION public.ensure_student_plan_matches_year()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_year uuid;
BEGIN
  SELECT school_year_id INTO v_plan_year FROM public.payment_plans WHERE id = NEW.plan_id;
  IF v_plan_year IS DISTINCT FROM NEW.school_year_id THEN
    RAISE EXCEPTION 'El plan de pago pertenece a otro año escolar'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_plan_matches_year ON public.student_payment_plans;
CREATE TRIGGER trg_student_plan_matches_year
BEFORE INSERT OR UPDATE OF plan_id, school_year_id ON public.student_payment_plans
FOR EACH ROW EXECUTE FUNCTION public.ensure_student_plan_matches_year();

-- Un plan ya asignado no puede cambiar de año (dejaría asignaciones en otro año).
CREATE OR REPLACE FUNCTION public.prevent_assigned_payment_plan_year_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.school_year_id IS DISTINCT FROM OLD.school_year_id
     AND EXISTS (SELECT 1 FROM public.student_payment_plans WHERE plan_id = NEW.id) THEN
    RAISE EXCEPTION 'No se puede cambiar el año de un plan que ya está asignado'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_assigned_payment_plan_year_change ON public.payment_plans;
CREATE TRIGGER trg_prevent_assigned_payment_plan_year_change
BEFORE UPDATE OF school_year_id ON public.payment_plans
FOR EACH ROW EXECUTE FUNCTION public.prevent_assigned_payment_plan_year_change();

-- 6. Proteger el historial: no borrar facturas ni exoneraciones en cascada ---------------
ALTER TABLE public.payment_items DROP CONSTRAINT IF EXISTS payment_items_plan_concept_id_fkey;
ALTER TABLE public.payment_items
  ADD CONSTRAINT payment_items_plan_concept_id_fkey
  FOREIGN KEY (plan_concept_id) REFERENCES public.payment_plan_concepts(id) ON DELETE RESTRICT;

ALTER TABLE public.concept_exonerations DROP CONSTRAINT IF EXISTS concept_exonerations_plan_concept_id_fkey;
ALTER TABLE public.concept_exonerations
  ADD CONSTRAINT concept_exonerations_plan_concept_id_fkey
  FOREIGN KEY (plan_concept_id) REFERENCES public.payment_plan_concepts(id) ON DELETE RESTRICT;

-- 7. Sync de cuotas sin pago, ahora también con la moneda ---------------------------------
-- Solo toca cuotas con paid_amount = 0 del plan editado (que ya es de un solo año). Si cambió la
-- moneda, la cuota pasa a la nueva moneda con la tasa vigente de exchange_rates.
CREATE OR REPLACE FUNCTION public.sync_unpaid_balances_for_plan_concept(_plan_concept_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.student_concept_balances scb
  SET currency = v.new_currency,
      exchange_rate_snapshot = v.new_rate,
      original_amount = v.net_amount,
      total_amount = v.net_amount * v.new_rate,
      balance = v.net_amount * v.new_rate,
      updated_at = now()
  FROM (
    SELECT
      b.id,
      COALESCE(ppc.currency, pc.currency, 'VES') AS new_currency,
      public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value) AS net_amount,
      CASE
        WHEN COALESCE(ppc.currency, pc.currency, 'VES') = COALESCE(b.currency, 'VES')
          THEN COALESCE(NULLIF(b.exchange_rate_snapshot, 0), 1)
        WHEN COALESCE(ppc.currency, pc.currency, 'VES') = 'VES' THEN 1
        ELSE COALESCE(NULLIF(er.rate_to_ves, 0), 1)
      END AS new_rate
    FROM public.student_concept_balances b
    JOIN public.payment_plan_concepts ppc ON ppc.id = b.plan_concept_id
    LEFT JOIN public.payment_concepts pc ON pc.id = ppc.concept_id
    LEFT JOIN public.exchange_rates er
      ON er.school_id = b.school_id
     AND er.currency = COALESCE(ppc.currency, pc.currency, 'VES')
    WHERE b.plan_concept_id = _plan_concept_id
      AND COALESCE(b.paid_amount, 0) = 0
  ) v
  WHERE scb.id = v.id;
END;
$$;

-- 8. Copiar planes de un año a otro ------------------------------------------
-- SECURITY INVOKER: aplica la RLS de payment_plans / payment_plan_concepts del usuario.
CREATE OR REPLACE FUNCTION public.copy_payment_plans_to_year(
  _school_id uuid,
  _from_year_id uuid,
  _to_year_id uuid,
  _plan_ids uuid[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  r        record;
  v_new    uuid;
  v_copied integer := 0;
BEGIN
  IF _from_year_id = _to_year_id THEN
    RAISE EXCEPTION 'El año de origen y el de destino deben ser distintos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_years WHERE id = _to_year_id AND school_id = _school_id) THEN
    RAISE EXCEPTION 'El año de destino no pertenece al colegio';
  END IF;

  FOR r IN
    SELECT * FROM public.payment_plans
    WHERE school_id = _school_id
      AND school_year_id = _from_year_id
      AND (_plan_ids IS NULL OR id = ANY (_plan_ids))
    ORDER BY name
  LOOP
    -- Si ya hay un plan con ese nombre en el año destino no se duplica
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.payment_plans
      WHERE school_id = _school_id AND school_year_id = _to_year_id AND lower(name) = lower(r.name)
    );

    INSERT INTO public.payment_plans (school_id, school_year_id, name, description, is_active)
    VALUES (_school_id, _to_year_id, r.name, r.description, r.is_active)
    RETURNING id INTO v_new;

    INSERT INTO public.payment_plan_concepts (
      plan_id, concept_id, amount, currency, display_order, is_mandatory, is_recurring,
      due_day, due_month, discount_type, discount_value
    )
    SELECT v_new, concept_id, amount, currency, display_order, is_mandatory, is_recurring,
           due_day, due_month, discount_type, discount_value
    FROM public.payment_plan_concepts WHERE plan_id = r.id;

    v_copied := v_copied + 1;
  END LOOP;

  RETURN v_copied;
END;
$$;

GRANT EXECUTE ON FUNCTION public.copy_payment_plans_to_year(uuid, uuid, uuid, uuid[]) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
