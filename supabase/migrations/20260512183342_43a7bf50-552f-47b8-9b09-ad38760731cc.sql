-- Canonical FK integrity for payment history (payments, payment_items, payment_method_entries)
-- Idempotent and safe on Cloud (already has constraints) and VPS (may be missing them).

CREATE OR REPLACE FUNCTION pg_temp.ensure_unique(_table regclass, _col text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_attnum smallint;
BEGIN
  SELECT attnum INTO v_attnum FROM pg_attribute
  WHERE attrelid = _table AND attname = _col AND NOT attisdropped;
  IF v_attnum IS NULL THEN
    RAISE EXCEPTION 'Column %.% does not exist', _table, _col;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = _table AND contype IN ('p','u') AND conkey = ARRAY[v_attnum]
  ) THEN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I UNIQUE (%I)',
      _table::text,
      replace(_table::text,'public.','') || '_' || _col || '_key',
      _col);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.ensure_fk(
  _conname text, _table regclass, _col text,
  _ref_table regclass, _ref_col text, _on_delete text DEFAULT 'CASCADE'
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_attnum smallint;
  v_refnum smallint;
  v_orphans bigint;
BEGIN
  SELECT attnum INTO v_attnum FROM pg_attribute
    WHERE attrelid = _table AND attname = _col AND NOT attisdropped;
  SELECT attnum INTO v_refnum FROM pg_attribute
    WHERE attrelid = _ref_table AND attname = _ref_col AND NOT attisdropped;
  IF v_attnum IS NULL OR v_refnum IS NULL THEN
    RAISE EXCEPTION 'Cannot create FK %: missing column', _conname;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'f' AND conrelid = _table AND confrelid = _ref_table
      AND conkey = ARRAY[v_attnum] AND confkey = ARRAY[v_refnum]
  ) THEN
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT count(*) FROM %s c WHERE c.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %s p WHERE p.%I = c.%I)',
    _table::text, _col, _ref_table::text, _ref_col, _col
  ) INTO v_orphans;
  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'Cannot add FK %: % orphan rows in %.% pointing to missing %.%',
      _conname, v_orphans, _table::text, _col, _ref_table::text, _ref_col;
  END IF;

  EXECUTE format(
    'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(%I) ON DELETE %s',
    _table::text, _conname, _col, _ref_table::text, _ref_col, _on_delete
  );
END $$;

-- Ensure referenced PK/UNIQUE keys exist
SELECT pg_temp.ensure_unique('public.payments'::regclass,                'id');
SELECT pg_temp.ensure_unique('public.payment_plan_concepts'::regclass,   'id');
SELECT pg_temp.ensure_unique('public.schools'::regclass,                 'id');
SELECT pg_temp.ensure_unique('public.school_years'::regclass,            'id');
SELECT pg_temp.ensure_unique('public.students'::regclass,                'id');

-- payments
SELECT pg_temp.ensure_fk('payments_school_id_fkey',      'public.payments'::regclass, 'school_id',
                         'public.schools'::regclass,      'id', 'CASCADE');
SELECT pg_temp.ensure_fk('payments_school_year_id_fkey', 'public.payments'::regclass, 'school_year_id',
                         'public.school_years'::regclass, 'id', 'CASCADE');
SELECT pg_temp.ensure_fk('payments_student_id_fkey',     'public.payments'::regclass, 'student_id',
                         'public.students'::regclass,     'id', 'CASCADE');

-- payment_items
SELECT pg_temp.ensure_fk('payment_items_payment_id_fkey',      'public.payment_items'::regclass, 'payment_id',
                         'public.payments'::regclass,            'id', 'CASCADE');
SELECT pg_temp.ensure_fk('payment_items_plan_concept_id_fkey', 'public.payment_items'::regclass, 'plan_concept_id',
                         'public.payment_plan_concepts'::regclass, 'id', 'CASCADE');

-- payment_method_entries
SELECT pg_temp.ensure_fk('payment_method_entries_payment_id_fkey', 'public.payment_method_entries'::regclass, 'payment_id',
                         'public.payments'::regclass, 'id', 'CASCADE');

NOTIFY pgrst, 'reload schema';