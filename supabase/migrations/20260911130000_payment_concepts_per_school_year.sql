-- ============================================================================
-- Conceptos de pago por año escolar
--
-- Complemento de 20260911120000_payment_plans_per_school_year.sql. Los planes ya son por año,
-- pero los conceptos (el catálogo que el colegio edita en la pestaña Conceptos, con su monto y
-- moneda) seguían compartidos: cambiar "Mes de Agosto" para 2026-2027 lo cambiaba también en
-- 2025-2026, y el precio no llegaba a los planes.
--
--   * payment_concepts.school_year_id: cada año tiene sus conceptos.
--   * payment_concepts.lineage_id: identidad estable entre años (las copias comparten el del
--     original). La factura marca los conceptos por linaje, así que las plantillas de /formatos
--     (claves "concept:{id}") siguen funcionando para todos los años.
--   * Cambiar monto/moneda de un concepto actualiza las cuotas de los planes de ese año que usaban
--     el precio anterior, y el trigger existente recalcula sus cuotas sin pagos.
--   * Copiar planes a otro año copia también sus conceptos.
-- Idempotente.
-- ============================================================================

BEGIN;

-- 1. Linaje ------------------------------------------------------------------
ALTER TABLE public.payment_concepts ADD COLUMN IF NOT EXISTS lineage_id uuid;
UPDATE public.payment_concepts SET lineage_id = id WHERE lineage_id IS NULL;
ALTER TABLE public.payment_concepts ALTER COLUMN lineage_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_concepts_lineage ON public.payment_concepts (lineage_id);

-- Un concepto nuevo (sin linaje) inicia su propio linaje
CREATE OR REPLACE FUNCTION public.set_payment_concept_lineage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;
  NEW.lineage_id := COALESCE(NEW.lineage_id, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_payment_concept_lineage ON public.payment_concepts;
CREATE TRIGGER trg_set_payment_concept_lineage
BEFORE INSERT ON public.payment_concepts
FOR EACH ROW EXECUTE FUNCTION public.set_payment_concept_lineage();

-- 2. Año ---------------------------------------------------------------------
ALTER TABLE public.payment_concepts
  ADD COLUMN IF NOT EXISTS school_year_id uuid REFERENCES public.school_years(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_payment_concepts_school_year
  ON public.payment_concepts (school_id, school_year_id);

DO $$
DECLARE
  r        record;
  a        record;
  v_target uuid;
  v_copy   uuid;
BEGIN
  -- Cada concepto sin año → el año más antiguo de los planes que lo usan; si ningún plan lo usa,
  -- el año más antiguo con planes del colegio; si no, el activo; si no, el más reciente.
  FOR r IN SELECT * FROM public.payment_concepts WHERE school_year_id IS NULL LOOP
    v_target := NULL;

    SELECT sy.id INTO v_target
    FROM public.payment_plan_concepts ppc
    JOIN public.payment_plans pp ON pp.id = ppc.plan_id
    JOIN public.school_years sy ON sy.id = pp.school_year_id
    WHERE ppc.concept_id = r.id
    ORDER BY sy.year_range ASC
    LIMIT 1;

    IF v_target IS NULL THEN
      SELECT sy.id INTO v_target
      FROM public.payment_plans pp
      JOIN public.school_years sy ON sy.id = pp.school_year_id
      WHERE pp.school_id = r.school_id
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
      RAISE EXCEPTION 'El concepto % (%) no tiene ningún año escolar posible', r.name, r.id;
    END IF;

    UPDATE public.payment_concepts SET school_year_id = v_target WHERE id = r.id;
  END LOOP;

  -- Planes de otro año que usan el concepto → copia del concepto en ese año (mismo linaje)
  FOR a IN
    SELECT DISTINCT ppc.concept_id, pp.school_year_id
    FROM public.payment_plan_concepts ppc
    JOIN public.payment_plans pp ON pp.id = ppc.plan_id
    JOIN public.payment_concepts pc ON pc.id = ppc.concept_id
    WHERE pc.school_year_id <> pp.school_year_id
  LOOP
    v_copy := NULL;
    SELECT c2.id INTO v_copy
    FROM public.payment_concepts c1
    JOIN public.payment_concepts c2 ON c2.lineage_id = c1.lineage_id AND c2.school_year_id = a.school_year_id
    WHERE c1.id = a.concept_id
    LIMIT 1;

    IF v_copy IS NULL THEN
      INSERT INTO public.payment_concepts (
        school_id, school_year_id, lineage_id, name, description, concept_type, default_amount, currency, is_active
      )
      SELECT school_id, a.school_year_id, lineage_id, name, description, concept_type, default_amount, currency, is_active
      FROM public.payment_concepts WHERE id = a.concept_id
      RETURNING id INTO v_copy;
    END IF;

    UPDATE public.payment_plan_concepts ppc
    SET concept_id = v_copy
    FROM public.payment_plans pp
    WHERE pp.id = ppc.plan_id
      AND ppc.concept_id = a.concept_id
      AND pp.school_year_id = a.school_year_id;
  END LOOP;
END $$;

ALTER TABLE public.payment_concepts ALTER COLUMN school_year_id SET NOT NULL;

-- 3. Guardias ----------------------------------------------------------------
-- La cuota de un plan solo puede usar un concepto del mismo año del plan.
CREATE OR REPLACE FUNCTION public.ensure_plan_concept_matches_year()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_year    uuid;
  v_concept_year uuid;
BEGIN
  SELECT school_year_id INTO v_plan_year FROM public.payment_plans WHERE id = NEW.plan_id;
  SELECT school_year_id INTO v_concept_year FROM public.payment_concepts WHERE id = NEW.concept_id;
  IF v_plan_year IS DISTINCT FROM v_concept_year THEN
    RAISE EXCEPTION 'El concepto pertenece a otro año escolar que el plan'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_concept_matches_year ON public.payment_plan_concepts;
CREATE TRIGGER trg_plan_concept_matches_year
BEFORE INSERT OR UPDATE OF plan_id, concept_id ON public.payment_plan_concepts
FOR EACH ROW EXECUTE FUNCTION public.ensure_plan_concept_matches_year();

-- El linaje no se edita, y un concepto usado por planes no cambia de año.
CREATE OR REPLACE FUNCTION public.protect_payment_concept_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.lineage_id := OLD.lineage_id;
  IF NEW.school_year_id IS DISTINCT FROM OLD.school_year_id
     AND EXISTS (SELECT 1 FROM public.payment_plan_concepts WHERE concept_id = NEW.id) THEN
    RAISE EXCEPTION 'No se puede cambiar el año de un concepto que ya está en un plan'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payment_concept_identity ON public.payment_concepts;
CREATE TRIGGER trg_protect_payment_concept_identity
BEFORE UPDATE ON public.payment_concepts
FOR EACH ROW EXECUTE FUNCTION public.protect_payment_concept_identity();

-- 4. El precio del concepto llega a los planes de su año ------------------------------------
-- Solo las cuotas de plan que tenían el precio anterior del concepto (las que "lo siguen"); una
-- cuota con un monto propio del plan se respeta. Al actualizar payment_plan_concepts, el trigger
-- trg_sync_balances_on_payment_plan_concept recalcula las cuotas sin pagos de ese año.
CREATE OR REPLACE FUNCTION public.propagate_payment_concept_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.default_amount IS DISTINCT FROM OLD.default_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency THEN
    UPDATE public.payment_plan_concepts
    SET amount = NEW.default_amount,
        currency = NEW.currency
    WHERE concept_id = NEW.id
      AND amount IS NOT DISTINCT FROM OLD.default_amount
      AND COALESCE(currency, OLD.currency, 'VES') = COALESCE(OLD.currency, 'VES');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_payment_concept_price ON public.payment_concepts;
CREATE TRIGGER trg_propagate_payment_concept_price
AFTER UPDATE OF default_amount, currency ON public.payment_concepts
FOR EACH ROW EXECUTE FUNCTION public.propagate_payment_concept_price();

-- 5. Copiar entre años -------------------------------------------------------
-- Devuelve el concepto equivalente en el año destino (mismo linaje o, si no, mismo nombre),
-- creándolo si no existe. SECURITY INVOKER: aplica la RLS del usuario.
CREATE OR REPLACE FUNCTION public.ensure_payment_concept_in_year(_concept_id uuid, _to_year_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  c    record;
  v_id uuid;
BEGIN
  SELECT * INTO c FROM public.payment_concepts WHERE id = _concept_id;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'Concepto % no encontrado', _concept_id;
  END IF;
  IF c.school_year_id = _to_year_id THEN
    RETURN c.id;
  END IF;

  SELECT id INTO v_id FROM public.payment_concepts
  WHERE school_id = c.school_id AND school_year_id = _to_year_id AND lineage_id = c.lineage_id
  ORDER BY created_at
  LIMIT 1;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.payment_concepts
    WHERE school_id = c.school_id AND school_year_id = _to_year_id AND lower(name) = lower(c.name)
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.payment_concepts (
      school_id, school_year_id, lineage_id, name, description, concept_type, default_amount, currency, is_active
    )
    VALUES (
      c.school_id, _to_year_id, c.lineage_id, c.name, c.description, c.concept_type, c.default_amount, c.currency, c.is_active
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.copy_payment_concepts_to_year(
  _school_id uuid,
  _from_year_id uuid,
  _to_year_id uuid,
  _concept_ids uuid[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  r        record;
  v_copied integer := 0;
BEGIN
  IF _from_year_id = _to_year_id THEN
    RAISE EXCEPTION 'El año de origen y el de destino deben ser distintos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_years WHERE id = _to_year_id AND school_id = _school_id) THEN
    RAISE EXCEPTION 'El año de destino no pertenece al colegio';
  END IF;

  FOR r IN
    SELECT id, lineage_id, name FROM public.payment_concepts
    WHERE school_id = _school_id
      AND school_year_id = _from_year_id
      AND (_concept_ids IS NULL OR id = ANY (_concept_ids))
    ORDER BY name
  LOOP
    -- Si ya existe (mismo linaje o mismo nombre) en el año destino no se duplica
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.payment_concepts
      WHERE school_id = _school_id AND school_year_id = _to_year_id
        AND (lineage_id = r.lineage_id OR lower(name) = lower(r.name))
    );
    PERFORM public.ensure_payment_concept_in_year(r.id, _to_year_id);
    v_copied := v_copied + 1;
  END LOOP;

  RETURN v_copied;
END;
$$;

-- Copiar planes: ahora cada cuota apunta al concepto del año destino (se copia si falta)
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
  pc       record;
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
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.payment_plans
      WHERE school_id = _school_id AND school_year_id = _to_year_id AND lower(name) = lower(r.name)
    );

    INSERT INTO public.payment_plans (school_id, school_year_id, name, description, is_active)
    VALUES (_school_id, _to_year_id, r.name, r.description, r.is_active)
    RETURNING id INTO v_new;

    FOR pc IN SELECT * FROM public.payment_plan_concepts WHERE plan_id = r.id ORDER BY display_order LOOP
      INSERT INTO public.payment_plan_concepts (
        plan_id, concept_id, amount, currency, display_order, is_mandatory, is_recurring,
        due_day, due_month, discount_type, discount_value
      )
      VALUES (
        v_new, public.ensure_payment_concept_in_year(pc.concept_id, _to_year_id), pc.amount, pc.currency,
        pc.display_order, pc.is_mandatory, pc.is_recurring, pc.due_day, pc.due_month,
        pc.discount_type, pc.discount_value
      );
    END LOOP;

    v_copied := v_copied + 1;
  END LOOP;

  RETURN v_copied;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_payment_concept_in_year(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_payment_concepts_to_year(uuid, uuid, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_payment_plans_to_year(uuid, uuid, uuid, uuid[]) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
