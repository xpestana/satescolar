-- Phase 5 of docs/desc/19-modulos.md: enforce school modules in the database.
--
-- Until now modules were enforced in the UI and in Edge Functions only. This adds a RESTRICTIVE
-- policy for INSERT and UPDATE on every table that belongs to a sellable module, so a school
-- without the module cannot create or edit that data even through the API.
--
-- Design notes:
-- - Restrictive policies are ANDed with the existing permissive ones, so current rules (roles,
--   ownership, permissions) stay exactly as they are; this only adds the module condition.
-- - Reads (SELECT) are not restricted: the locked overlay renders the real page blurred, and a
--   school keeps seeing its history after a module expires.
-- - Deletes are not restricted: removing data gives no value from a module and some Registro
--   flows clean up related rows.
-- - Applies to the authenticated role (every app user). anon is left as is: it cannot execute
--   school_has_module and no app flow writes these tables anonymously.
-- - Admins (is_admin()) pass. service_role (Edge Functions, crons) and SECURITY DEFINER
--   functions/triggers owned by postgres bypass RLS, e.g. the triggers that create classroom
--   access codes and attendance tokens when Registro data is created.
-- - Docentes/Áreas (TEACHING_MODULES) stay UI-only: those tables are written by Registro flows.
--
-- Idempotent: drops and recreates the policies.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- Mensajes Masivos
      ('email_history', 'messaging'),
      -- Pagos (incluye nómina y morosidad)
      ('payments', 'payments'),
      ('payment_concepts', 'payments'),
      ('payment_plans', 'payments'),
      ('payment_reports', 'payments'),
      ('payment_others', 'payments'),
      ('payment_edit_log', 'payments'),
      ('student_payment_plans', 'payments'),
      ('student_concept_balances', 'payments'),
      ('concept_exonerations', 'payments'),
      ('family_credits', 'payments'),
      ('school_payment_methods', 'payments'),
      ('school_payment_settings', 'payments'),
      ('invoice_templates', 'payments'),
      ('delinquency_config', 'payments'),
      ('delinquency_notifications', 'payments'),
      ('payroll_audit_log', 'payments'),
      ('payroll_beneficiaries', 'payments'),
      ('payroll_concepts', 'payments'),
      ('payroll_payment_methods', 'payments'),
      ('payroll_payments', 'payments'),
      ('payroll_periods', 'payments'),
      -- Notas, Boletas y Sábana
      ('student_grades', 'grades'),
      ('final_grades', 'grades'),
      ('evaluation_plan_items', 'grades'),
      ('grades_config', 'grades'),
      ('grade_visibility_settings', 'grades'),
      ('student_grade_access', 'grades'),
      ('boleta_templates', 'grades'),
      ('teacher_signatures', 'grades'),
      ('preschool_final_indicator_grades', 'grades'),
      ('preschool_final_reports', 'grades'),
      ('preschool_component_indicators', 'grades'),
      ('preschool_grading_scales', 'grades'),
      ('preschool_indicator_components', 'grades'),
      ('primary_final_indicator_grades', 'grades'),
      ('primary_final_reports', 'grades'),
      ('primary_grade_indicators', 'grades'),
      ('primary_grading_scales', 'grades'),
      ('primary_indicator_areas', 'grades'),
      -- Planillajes del Ministerio
      ('resumen_final_config', 'ministry_forms'),
      ('resumen_final_subject_overrides', 'ministry_forms'),
      -- Control de Asistencias
      ('attendance_records', 'attendance'),
      -- Aula Virtual
      ('classroom_access_codes', 'virtual_classroom'),
      ('classroom_access_log', 'virtual_classroom'),
      ('classroom_activities', 'virtual_classroom'),
      ('classroom_activity_attachments', 'virtual_classroom'),
      ('classroom_comments', 'virtual_classroom'),
      ('classroom_config', 'virtual_classroom'),
      ('classroom_events', 'virtual_classroom'),
      ('classroom_notifications', 'virtual_classroom'),
      ('classroom_post_attachments', 'virtual_classroom'),
      ('classroom_posts', 'virtual_classroom'),
      ('classroom_reactions', 'virtual_classroom'),
      ('classroom_rubric_criteria', 'virtual_classroom'),
      ('classroom_rubrics', 'virtual_classroom'),
      ('classroom_submission_attachments', 'virtual_classroom'),
      ('classroom_submissions', 'virtual_classroom'),
      ('classroom_topics', 'virtual_classroom')
    ) AS v(tbl, module)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS module_gate_insert ON public.%I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS module_gate_update ON public.%I', r.tbl);

    EXECUTE format(
      'CREATE POLICY module_gate_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated '
      'WITH CHECK (public.is_admin() OR public.school_has_module(school_id, %L))',
      r.tbl, r.module
    );
    EXECUTE format(
      'CREATE POLICY module_gate_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated '
      'USING (public.is_admin() OR public.school_has_module(school_id, %L)) '
      'WITH CHECK (public.is_admin() OR public.school_has_module(school_id, %L))',
      r.tbl, r.module, r.module
    );
  END LOOP;
END $$;
