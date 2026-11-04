-- Starting values get a fixed past date, so a school can correct them on the day it sets them up:
-- versions are unique per date, and a correction made the same day would otherwise collide.

CREATE OR REPLACE FUNCTION public.ensure_payroll_tax_defaults(_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from date := date '2026-01-01';
  v_concept record;
  v_concept_id uuid;
BEGIN
  IF NOT public.payroll_can(_school_id, 'payroll.config') THEN
    RAISE EXCEPTION 'NOT_ALLOWED: no tiene permiso para configurar retenciones';
  END IF;

  INSERT INTO public.payroll_tax_settings (school_id) VALUES (_school_id)
  ON CONFLICT (school_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.payroll_tax_parameters WHERE school_id = _school_id) THEN
    INSERT INTO public.payroll_tax_parameters (school_id, valid_from, tax_unit_value, created_by)
    VALUES (_school_id, v_from, 43, v_uid);
  END IF;

  IF EXISTS (SELECT 1 FROM public.payroll_islr_concepts WHERE school_id = _school_id) THEN
    RETURN;
  END IF;

  FOR v_concept IN
    SELECT * FROM (VALUES
      ('Honorarios profesionales', 1, 3::numeric, 'auto', 5::numeric),
      ('Contratistas y servicios', 2, 1::numeric, 'none', 2::numeric),
      ('Arrendamiento de bienes muebles', 3, 3::numeric, 'auto', 5::numeric),
      ('Publicidad y propaganda', 4, 3::numeric, 'auto', 5::numeric)
    ) AS d(name, display_order, natural_pct, natural_mode, legal_pct)
  LOOP
    INSERT INTO public.payroll_islr_concepts (school_id, name, display_order)
    VALUES (_school_id, v_concept.name, v_concept.display_order)
    RETURNING id INTO v_concept_id;

    INSERT INTO public.payroll_islr_rate_versions
      (school_id, concept_id, person_type, valid_from, rate_pct, subtrahend_mode, minimum_mode, created_by)
    VALUES
      (_school_id, v_concept_id, 'natural_resident', v_from, v_concept.natural_pct,
       v_concept.natural_mode, v_concept.natural_mode, v_uid),
      (_school_id, v_concept_id, 'legal_domiciled', v_from, v_concept.legal_pct, 'none', 'none', v_uid);
  END LOOP;
END;
$$;
