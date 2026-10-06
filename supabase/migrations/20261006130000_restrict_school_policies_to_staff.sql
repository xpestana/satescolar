-- Restringe al personal del colegio las políticas "School users ..." (corrección de seguridad).
--
-- Problema: 147 políticas daban acceso a quien tuviera CUALQUIER fila en user_roles del colegio,
-- sin mirar el rol:
--   EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = X.school_id)
-- Los representantes y los docentes también tienen fila en user_roles (rol 'representative' /
-- 'teacher'), así que un representante podía leer —y en muchas tablas escribir— notas, pagos,
-- saldos, nómina, representantes, etc. de TODO su colegio desde la API.
--
-- Corrección:
-- 1. Esa condición pasa a ser public.is_school_staff(X.school_id): rol 'school' (dueño y
--    sub-usuarios). El resto de cada expresión se conserva tal cual.
-- 2. Los docentes conservan la LECTURA que usa su portal (estudiantes, inscripciones,
--    asignaciones, configuración de notas y boletas) con public.is_school_staff_or_teacher().
--    Sus escrituras siguen acotadas a sus asignaciones por las políticas "Teachers can ..." que
--    ya existían.
-- 3. Los representantes ganan solo tres lecturas que su portal usaba a través del hueco:
--    tasas de cambio, grupos del formulario y métodos de pago del colegio. Lo demás ya tenía
--    políticas propias acotadas a su familia.
-- 4. user_has_school_access_to_student (política "School users can view their students") tenía
--    el mismo defecto: ahora exige personal del colegio o docente del colegio.
--
-- Idempotente: cada política se borra y se vuelve a crear con el mismo nombre.

CREATE OR REPLACE FUNCTION public.is_school_staff(_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.school_id = _school_id AND ur.role = 'school'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_school_teacher(_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.user_id = auth.uid() AND t.school_id = _school_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_school_staff_or_teacher(_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_school_staff(_school_id) OR public.is_school_teacher(_school_id)
$$;

CREATE OR REPLACE FUNCTION public.is_school_family(_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_schools fs
    JOIN public.families f ON f.id = fs.family_id
    WHERE fs.school_id = _school_id AND f.user_id = auth.uid()
  )
$$;

-- SECURITY DEFINER para no recursar entre las políticas de teachers y subject_teacher_assignments
CREATE OR REPLACE FUNCTION public.teaches_my_children(_teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subject_teacher_assignments sta
    WHERE sta.teacher_id = _teacher_id
      AND public.representative_child_in_assignment(auth.uid(), sta.id)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.teaches_my_children(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teaches_my_children(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_school_staff(uuid), public.is_school_teacher(uuid),
  public.is_school_staff_or_teacher(uuid), public.is_school_family(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_school_staff(uuid), public.is_school_teacher(uuid),
  public.is_school_staff_or_teacher(uuid), public.is_school_family(uuid) TO authenticated, service_role;

-- Las tres funciones de membresía que usan otras políticas tenían el mismo defecto (cualquier
-- fila en user_roles). Pasan a exigir personal del colegio (rol 'school'):
--   user_has_school_access_to_student → students (ver/editar/borrar)
--   user_has_school_access_to_family  → families (ver/editar/borrar)
--   user_shares_school                → student_grade_access, grade_visibility_settings,
--                                       delinquency_config, carnet_config, user_roles, permisos…
-- (un representante podía desbloquearse las notas, publicar momentos o ver todas las familias).
CREATE OR REPLACE FUNCTION public.user_has_school_access_to_student(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_schools ss
    JOIN public.user_roles ur ON ur.school_id = ss.school_id
    WHERE ss.student_id = _student_id AND ur.user_id = _user_id AND ur.role = 'school'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_school_access_to_family(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_schools fs
    JOIN public.user_roles ur ON ur.school_id = fs.school_id
    WHERE fs.family_id = _family_id AND ur.user_id = _user_id AND ur.role = 'school'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_shares_school(requesting_user_id uuid, target_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = requesting_user_id AND school_id = target_school_id AND role = 'school'
  )
$$;

-- Los docentes leen los estudiantes de su colegio (listas de notas, asistencia, aula), sin editar.
-- SECURITY DEFINER para no recursar entre las políticas de students y student_schools.
CREATE OR REPLACE FUNCTION public.teacher_can_view_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_schools ss
    JOIN public.teachers t ON t.school_id = ss.school_id
    WHERE ss.student_id = _student_id AND t.user_id = auth.uid()
  )
$$;
REVOKE EXECUTE ON FUNCTION public.teacher_can_view_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_can_view_student(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Teachers can view their school students" ON public.students;
CREATE POLICY "Teachers can view their school students" ON public.students AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.teacher_can_view_student(id));

-- ── Políticas reescritas (147) ──────────────────────────────────────────

DROP POLICY IF EXISTS "School users can view their attendance" ON public.attendance_records;
CREATE POLICY "School users can view their attendance" ON public.attendance_records AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_school_staff(attendance_records.school_id));

DROP POLICY IF EXISTS "School users can view their tokens" ON public.attendance_tokens;
CREATE POLICY "School users can view their tokens" ON public.attendance_tokens AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_school_staff(attendance_tokens.school_id));

DROP POLICY IF EXISTS "school_boleta_templates_all" ON public.boleta_templates;
CREATE POLICY "school_boleta_templates_all" ON public.boleta_templates AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(school_id))
  WITH CHECK (public.is_school_staff(school_id));

DROP POLICY IF EXISTS "School users can manage access codes" ON public.classroom_access_codes;
CREATE POLICY "School users can manage access codes" ON public.classroom_access_codes AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_access_codes.school_id))
  WITH CHECK (public.is_school_staff(classroom_access_codes.school_id));

DROP POLICY IF EXISTS "School users can view access logs" ON public.classroom_access_log;
CREATE POLICY "School users can view access logs" ON public.classroom_access_log AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(classroom_access_log.school_id));

DROP POLICY IF EXISTS "School users can manage activities" ON public.classroom_activities;
CREATE POLICY "School users can manage activities" ON public.classroom_activities AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_activities.school_id))
  WITH CHECK (public.is_school_staff(classroom_activities.school_id));

DROP POLICY IF EXISTS "School users can manage activity attachments" ON public.classroom_activity_attachments;
CREATE POLICY "School users can manage activity attachments" ON public.classroom_activity_attachments AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_activity_attachments.school_id))
  WITH CHECK (public.is_school_staff(classroom_activity_attachments.school_id));

DROP POLICY IF EXISTS "School users can manage comments" ON public.classroom_comments;
CREATE POLICY "School users can manage comments" ON public.classroom_comments AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_comments.school_id))
  WITH CHECK (public.is_school_staff(classroom_comments.school_id));

DROP POLICY IF EXISTS "School users can manage classroom config" ON public.classroom_config;
CREATE POLICY "School users can manage classroom config" ON public.classroom_config AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_config.school_id))
  WITH CHECK (public.is_school_staff(classroom_config.school_id));

DROP POLICY IF EXISTS "School users can manage events" ON public.classroom_events;
CREATE POLICY "School users can manage events" ON public.classroom_events AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_events.school_id))
  WITH CHECK (public.is_school_staff(classroom_events.school_id));

DROP POLICY IF EXISTS "School users can insert notifications" ON public.classroom_notifications;
CREATE POLICY "School users can insert notifications" ON public.classroom_notifications AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((public.is_school_staff_or_teacher(classroom_notifications.school_id) OR is_admin()));

DROP POLICY IF EXISTS "School users can manage post attachments" ON public.classroom_post_attachments;
CREATE POLICY "School users can manage post attachments" ON public.classroom_post_attachments AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_post_attachments.school_id))
  WITH CHECK (public.is_school_staff(classroom_post_attachments.school_id));

DROP POLICY IF EXISTS "School users can manage posts" ON public.classroom_posts;
CREATE POLICY "School users can manage posts" ON public.classroom_posts AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_posts.school_id))
  WITH CHECK (public.is_school_staff(classroom_posts.school_id));

DROP POLICY IF EXISTS "School users can manage reactions" ON public.classroom_reactions;
CREATE POLICY "School users can manage reactions" ON public.classroom_reactions AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_reactions.school_id))
  WITH CHECK (public.is_school_staff(classroom_reactions.school_id));

DROP POLICY IF EXISTS "School users can manage rubric criteria" ON public.classroom_rubric_criteria;
CREATE POLICY "School users can manage rubric criteria" ON public.classroom_rubric_criteria AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_rubric_criteria.school_id))
  WITH CHECK (public.is_school_staff(classroom_rubric_criteria.school_id));

DROP POLICY IF EXISTS "School users can manage rubrics" ON public.classroom_rubrics;
CREATE POLICY "School users can manage rubrics" ON public.classroom_rubrics AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_rubrics.school_id))
  WITH CHECK (public.is_school_staff(classroom_rubrics.school_id));

DROP POLICY IF EXISTS "School users can view submission attachments" ON public.classroom_submission_attachments;
CREATE POLICY "School users can view submission attachments" ON public.classroom_submission_attachments AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_submission_attachments.school_id))
  WITH CHECK (public.is_school_staff(classroom_submission_attachments.school_id));

DROP POLICY IF EXISTS "School users can manage submissions" ON public.classroom_submissions;
CREATE POLICY "School users can manage submissions" ON public.classroom_submissions AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_submissions.school_id))
  WITH CHECK (public.is_school_staff(classroom_submissions.school_id));

DROP POLICY IF EXISTS "School users can manage topics" ON public.classroom_topics;
CREATE POLICY "School users can manage topics" ON public.classroom_topics AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(classroom_topics.school_id))
  WITH CHECK (public.is_school_staff(classroom_topics.school_id));

DROP POLICY IF EXISTS "School users manage their concept_exonerations" ON public.concept_exonerations;
CREATE POLICY "School users manage their concept_exonerations" ON public.concept_exonerations AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(concept_exonerations.school_id))
  WITH CHECK (public.is_school_staff(concept_exonerations.school_id));

DROP POLICY IF EXISTS "School users can delete their templates" ON public.document_templates;
CREATE POLICY "School users can delete their templates" ON public.document_templates AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(document_templates.school_id));

DROP POLICY IF EXISTS "School users can insert their templates" ON public.document_templates;
CREATE POLICY "School users can insert their templates" ON public.document_templates AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(document_templates.school_id));

DROP POLICY IF EXISTS "School users can update their templates" ON public.document_templates;
CREATE POLICY "School users can update their templates" ON public.document_templates AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(document_templates.school_id));

DROP POLICY IF EXISTS "School users can view their templates" ON public.document_templates;
CREATE POLICY "School users can view their templates" ON public.document_templates AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(document_templates.school_id));

DROP POLICY IF EXISTS "School users can insert their email history" ON public.email_history;
CREATE POLICY "School users can insert their email history" ON public.email_history AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(email_history.school_id));

DROP POLICY IF EXISTS "School users can view their email history" ON public.email_history;
CREATE POLICY "School users can view their email history" ON public.email_history AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(email_history.school_id));

DROP POLICY IF EXISTS "School users can delete their enrollment display config" ON public.enrollment_display_config;
CREATE POLICY "School users can delete their enrollment display config" ON public.enrollment_display_config AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(enrollment_display_config.school_id));

DROP POLICY IF EXISTS "School users can insert their enrollment display config" ON public.enrollment_display_config;
CREATE POLICY "School users can insert their enrollment display config" ON public.enrollment_display_config AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(enrollment_display_config.school_id));

DROP POLICY IF EXISTS "School users can update their enrollment display config" ON public.enrollment_display_config;
CREATE POLICY "School users can update their enrollment display config" ON public.enrollment_display_config AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(enrollment_display_config.school_id));

DROP POLICY IF EXISTS "School users can view their enrollment display config" ON public.enrollment_display_config;
CREATE POLICY "School users can view their enrollment display config" ON public.enrollment_display_config AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(enrollment_display_config.school_id));

DROP POLICY IF EXISTS "School users can delete their planilla sections" ON public.enrollment_planilla_sections;
CREATE POLICY "School users can delete their planilla sections" ON public.enrollment_planilla_sections AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_school_staff(enrollment_planilla_sections.school_id));

DROP POLICY IF EXISTS "School users can insert their planilla sections" ON public.enrollment_planilla_sections;
CREATE POLICY "School users can insert their planilla sections" ON public.enrollment_planilla_sections AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_school_staff(enrollment_planilla_sections.school_id));

DROP POLICY IF EXISTS "School users can update their planilla sections" ON public.enrollment_planilla_sections;
CREATE POLICY "School users can update their planilla sections" ON public.enrollment_planilla_sections AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_school_staff(enrollment_planilla_sections.school_id));

DROP POLICY IF EXISTS "School users can view their planilla sections" ON public.enrollment_planilla_sections;
CREATE POLICY "School users can view their planilla sections" ON public.enrollment_planilla_sections AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_school_staff(enrollment_planilla_sections.school_id));

DROP POLICY IF EXISTS "School users can delete their enrollments" ON public.enrollments;
CREATE POLICY "School users can delete their enrollments" ON public.enrollments AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(enrollments.school_id));

DROP POLICY IF EXISTS "School users can insert their enrollments" ON public.enrollments;
CREATE POLICY "School users can insert their enrollments" ON public.enrollments AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(enrollments.school_id));

DROP POLICY IF EXISTS "School users can update their enrollments" ON public.enrollments;
CREATE POLICY "School users can update their enrollments" ON public.enrollments AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(enrollments.school_id));

DROP POLICY IF EXISTS "School users can view their enrollments" ON public.enrollments;
CREATE POLICY "School users can view their enrollments" ON public.enrollments AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff_or_teacher(enrollments.school_id));

DROP POLICY IF EXISTS "School users can view evaluation plans" ON public.evaluation_plan_items;
CREATE POLICY "School users can view evaluation plans" ON public.evaluation_plan_items AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(evaluation_plan_items.school_id));

DROP POLICY IF EXISTS "School users can manage their exchange_rates" ON public.exchange_rates;
CREATE POLICY "School users can manage their exchange_rates" ON public.exchange_rates AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(exchange_rates.school_id))
  WITH CHECK (public.is_school_staff(exchange_rates.school_id));

DROP POLICY IF EXISTS "School users manage their family_credits" ON public.family_credits;
CREATE POLICY "School users manage their family_credits" ON public.family_credits AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(family_credits.school_id))
  WITH CHECK (public.is_school_staff(family_credits.school_id));

DROP POLICY IF EXISTS "School users can delete family_schools" ON public.family_schools;
CREATE POLICY "School users can delete family_schools" ON public.family_schools AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(family_schools.school_id));

DROP POLICY IF EXISTS "School users can insert family_schools" ON public.family_schools;
CREATE POLICY "School users can insert family_schools" ON public.family_schools AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(family_schools.school_id));

DROP POLICY IF EXISTS "School users can view their family_schools" ON public.family_schools;
CREATE POLICY "School users can view their family_schools" ON public.family_schools AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(family_schools.school_id));

DROP POLICY IF EXISTS "School users can manage final grades" ON public.final_grades;
CREATE POLICY "School users can manage final grades" ON public.final_grades AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(final_grades.school_id))
  WITH CHECK (public.is_school_staff(final_grades.school_id));

DROP POLICY IF EXISTS "School users can delete their form field groups" ON public.form_field_groups;
CREATE POLICY "School users can delete their form field groups" ON public.form_field_groups AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(form_field_groups.school_id));

DROP POLICY IF EXISTS "School users can insert their form field groups" ON public.form_field_groups;
CREATE POLICY "School users can insert their form field groups" ON public.form_field_groups AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(form_field_groups.school_id));

DROP POLICY IF EXISTS "School users can update their form field groups" ON public.form_field_groups;
CREATE POLICY "School users can update their form field groups" ON public.form_field_groups AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(form_field_groups.school_id));

DROP POLICY IF EXISTS "School users can view their form field groups" ON public.form_field_groups;
CREATE POLICY "School users can view their form field groups" ON public.form_field_groups AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(form_field_groups.school_id));

DROP POLICY IF EXISTS "School users can delete their form fields" ON public.form_fields;
CREATE POLICY "School users can delete their form fields" ON public.form_fields AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(form_fields.school_id));

DROP POLICY IF EXISTS "School users can insert their form fields" ON public.form_fields;
CREATE POLICY "School users can insert their form fields" ON public.form_fields AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(form_fields.school_id));

DROP POLICY IF EXISTS "School users can update their form fields" ON public.form_fields;
CREATE POLICY "School users can update their form fields" ON public.form_fields AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(form_fields.school_id));

DROP POLICY IF EXISTS "School users can view their form fields" ON public.form_fields;
CREATE POLICY "School users can view their form fields" ON public.form_fields AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(form_fields.school_id));

DROP POLICY IF EXISTS "School users can manage gcrp students" ON public.gcrp_assignment_students;
CREATE POLICY "School users can manage gcrp students" ON public.gcrp_assignment_students AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(gcrp_assignment_students.school_id))
  WITH CHECK (public.is_school_staff(gcrp_assignment_students.school_id));

DROP POLICY IF EXISTS "School users can insert their grades config" ON public.grades_config;
CREATE POLICY "School users can insert their grades config" ON public.grades_config AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(grades_config.school_id));

DROP POLICY IF EXISTS "School users can update their grades config" ON public.grades_config;
CREATE POLICY "School users can update their grades config" ON public.grades_config AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(grades_config.school_id));

DROP POLICY IF EXISTS "School users can view their grades config" ON public.grades_config;
CREATE POLICY "School users can view their grades config" ON public.grades_config AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff_or_teacher(grades_config.school_id));

DROP POLICY IF EXISTS "school_users_manage_invoice_templates" ON public.invoice_templates;
CREATE POLICY "school_users_manage_invoice_templates" ON public.invoice_templates AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(invoice_templates.school_id))
  WITH CHECK (public.is_school_staff(invoice_templates.school_id));

DROP POLICY IF EXISTS "School users can manage their payment_concepts" ON public.payment_concepts;
CREATE POLICY "School users can manage their payment_concepts" ON public.payment_concepts AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(payment_concepts.school_id))
  WITH CHECK (public.is_school_staff(payment_concepts.school_id));

DROP POLICY IF EXISTS "School users manage their payment_edit_log" ON public.payment_edit_log;
CREATE POLICY "School users manage their payment_edit_log" ON public.payment_edit_log AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(payment_edit_log.school_id))
  WITH CHECK (public.is_school_staff(payment_edit_log.school_id));

DROP POLICY IF EXISTS "School users can manage their payment_items" ON public.payment_items;
CREATE POLICY "School users can manage their payment_items" ON public.payment_items AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1 FROM public.payments p WHERE ((p.id = payment_items.payment_id) AND public.is_school_staff(p.school_id)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.payments p WHERE ((p.id = payment_items.payment_id) AND public.is_school_staff(p.school_id)))));

DROP POLICY IF EXISTS "School users can manage their payment_method_entries" ON public.payment_method_entries;
CREATE POLICY "School users can manage their payment_method_entries" ON public.payment_method_entries AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1 FROM public.payments p WHERE ((p.id = payment_method_entries.payment_id) AND public.is_school_staff(p.school_id)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.payments p WHERE ((p.id = payment_method_entries.payment_id) AND public.is_school_staff(p.school_id)))));

DROP POLICY IF EXISTS "school_users_manage_payment_others" ON public.payment_others;
CREATE POLICY "school_users_manage_payment_others" ON public.payment_others AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(payment_others.school_id))
  WITH CHECK (public.is_school_staff(payment_others.school_id));

DROP POLICY IF EXISTS "School users can manage their payment_plan_concepts" ON public.payment_plan_concepts;
CREATE POLICY "School users can manage their payment_plan_concepts" ON public.payment_plan_concepts AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1 FROM public.payment_plans pp WHERE ((pp.id = payment_plan_concepts.plan_id) AND public.is_school_staff(pp.school_id)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.payment_plans pp WHERE ((pp.id = payment_plan_concepts.plan_id) AND public.is_school_staff(pp.school_id)))));

DROP POLICY IF EXISTS "School users can manage their payment_plans" ON public.payment_plans;
CREATE POLICY "School users can manage their payment_plans" ON public.payment_plans AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(payment_plans.school_id))
  WITH CHECK (public.is_school_staff(payment_plans.school_id));

DROP POLICY IF EXISTS "School users update their payment_reports" ON public.payment_reports;
CREATE POLICY "School users update their payment_reports" ON public.payment_reports AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(payment_reports.school_id))
  WITH CHECK (public.is_school_staff(payment_reports.school_id));

DROP POLICY IF EXISTS "School users view their payment_reports" ON public.payment_reports;
CREATE POLICY "School users view their payment_reports" ON public.payment_reports AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(payment_reports.school_id));

DROP POLICY IF EXISTS "School users can delete their payments" ON public.payments;
CREATE POLICY "School users can delete their payments" ON public.payments AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(payments.school_id));

DROP POLICY IF EXISTS "School users can manage their payments" ON public.payments;
CREATE POLICY "School users can manage their payments" ON public.payments AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(payments.school_id))
  WITH CHECK (public.is_school_staff(payments.school_id));

DROP POLICY IF EXISTS "School users manage their payroll_audit_log" ON public.payroll_audit_log;
CREATE POLICY "School users manage their payroll_audit_log" ON public.payroll_audit_log AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(payroll_audit_log.school_id))
  WITH CHECK (public.is_school_staff(payroll_audit_log.school_id));

DROP POLICY IF EXISTS "School users manage their payroll_beneficiaries" ON public.payroll_beneficiaries;
CREATE POLICY "School users manage their payroll_beneficiaries" ON public.payroll_beneficiaries AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(payroll_beneficiaries.school_id))
  WITH CHECK (public.is_school_staff(payroll_beneficiaries.school_id));

DROP POLICY IF EXISTS "School users manage their payroll_concepts" ON public.payroll_concepts;
CREATE POLICY "School users manage their payroll_concepts" ON public.payroll_concepts AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(payroll_concepts.school_id))
  WITH CHECK (public.is_school_staff(payroll_concepts.school_id));

DROP POLICY IF EXISTS "School users manage their payroll_payment_items" ON public.payroll_payment_items;
CREATE POLICY "School users manage their payroll_payment_items" ON public.payroll_payment_items AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1 FROM public.payroll_payments p WHERE ((p.id = payroll_payment_items.payment_id) AND public.is_school_staff(p.school_id)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.payroll_payments p WHERE ((p.id = payroll_payment_items.payment_id) AND public.is_school_staff(p.school_id)))));

DROP POLICY IF EXISTS "School users manage their payroll_payment_methods" ON public.payroll_payment_methods;
CREATE POLICY "School users manage their payroll_payment_methods" ON public.payroll_payment_methods AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(payroll_payment_methods.school_id))
  WITH CHECK (public.is_school_staff(payroll_payment_methods.school_id));

DROP POLICY IF EXISTS "School users manage their payroll_payments" ON public.payroll_payments;
CREATE POLICY "School users manage their payroll_payments" ON public.payroll_payments AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(payroll_payments.school_id))
  WITH CHECK (public.is_school_staff(payroll_payments.school_id));

DROP POLICY IF EXISTS "School users manage their payroll_periods" ON public.payroll_periods;
CREATE POLICY "School users manage their payroll_periods" ON public.payroll_periods AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(payroll_periods.school_id))
  WITH CHECK (public.is_school_staff(payroll_periods.school_id));

DROP POLICY IF EXISTS "School users can delete their planilla config" ON public.planilla_general_config;
CREATE POLICY "School users can delete their planilla config" ON public.planilla_general_config AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(planilla_general_config.school_id));

DROP POLICY IF EXISTS "School users can insert their planilla config" ON public.planilla_general_config;
CREATE POLICY "School users can insert their planilla config" ON public.planilla_general_config AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(planilla_general_config.school_id));

DROP POLICY IF EXISTS "School users can update their planilla config" ON public.planilla_general_config;
CREATE POLICY "School users can update their planilla config" ON public.planilla_general_config AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(planilla_general_config.school_id));

DROP POLICY IF EXISTS "School users can view their planilla config" ON public.planilla_general_config;
CREATE POLICY "School users can view their planilla config" ON public.planilla_general_config AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff_or_teacher(planilla_general_config.school_id));

DROP POLICY IF EXISTS "School users can delete their signature blocks" ON public.planilla_signature_blocks;
CREATE POLICY "School users can delete their signature blocks" ON public.planilla_signature_blocks AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(planilla_signature_blocks.school_id));

DROP POLICY IF EXISTS "School users can insert their signature blocks" ON public.planilla_signature_blocks;
CREATE POLICY "School users can insert their signature blocks" ON public.planilla_signature_blocks AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(planilla_signature_blocks.school_id));

DROP POLICY IF EXISTS "School users can update their signature blocks" ON public.planilla_signature_blocks;
CREATE POLICY "School users can update their signature blocks" ON public.planilla_signature_blocks AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(planilla_signature_blocks.school_id));

DROP POLICY IF EXISTS "School users can view their signature blocks" ON public.planilla_signature_blocks;
CREATE POLICY "School users can view their signature blocks" ON public.planilla_signature_blocks AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(planilla_signature_blocks.school_id));

DROP POLICY IF EXISTS "School users can delete their preschool indicators" ON public.preschool_component_indicators;
CREATE POLICY "School users can delete their preschool indicators" ON public.preschool_component_indicators AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(preschool_component_indicators.school_id));

DROP POLICY IF EXISTS "School users can insert their preschool indicators" ON public.preschool_component_indicators;
CREATE POLICY "School users can insert their preschool indicators" ON public.preschool_component_indicators AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(preschool_component_indicators.school_id));

DROP POLICY IF EXISTS "School users can update their preschool indicators" ON public.preschool_component_indicators;
CREATE POLICY "School users can update their preschool indicators" ON public.preschool_component_indicators AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(preschool_component_indicators.school_id));

DROP POLICY IF EXISTS "School users can view their preschool indicators" ON public.preschool_component_indicators;
CREATE POLICY "School users can view their preschool indicators" ON public.preschool_component_indicators AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff_or_teacher(preschool_component_indicators.school_id));

DROP POLICY IF EXISTS "School users can manage preschool indicator grades" ON public.preschool_final_indicator_grades;
CREATE POLICY "School users can manage preschool indicator grades" ON public.preschool_final_indicator_grades AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(preschool_final_indicator_grades.school_id))
  WITH CHECK (public.is_school_staff(preschool_final_indicator_grades.school_id));

DROP POLICY IF EXISTS "School users can manage preschool final reports" ON public.preschool_final_reports;
CREATE POLICY "School users can manage preschool final reports" ON public.preschool_final_reports AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(preschool_final_reports.school_id))
  WITH CHECK (public.is_school_staff(preschool_final_reports.school_id));

DROP POLICY IF EXISTS "School users can delete their preschool scales" ON public.preschool_grading_scales;
CREATE POLICY "School users can delete their preschool scales" ON public.preschool_grading_scales AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(preschool_grading_scales.school_id));

DROP POLICY IF EXISTS "School users can insert their preschool scales" ON public.preschool_grading_scales;
CREATE POLICY "School users can insert their preschool scales" ON public.preschool_grading_scales AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(preschool_grading_scales.school_id));

DROP POLICY IF EXISTS "School users can update their preschool scales" ON public.preschool_grading_scales;
CREATE POLICY "School users can update their preschool scales" ON public.preschool_grading_scales AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(preschool_grading_scales.school_id));

DROP POLICY IF EXISTS "School users can view their preschool scales" ON public.preschool_grading_scales;
CREATE POLICY "School users can view their preschool scales" ON public.preschool_grading_scales AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff_or_teacher(preschool_grading_scales.school_id));

DROP POLICY IF EXISTS "School users can delete their preschool components" ON public.preschool_indicator_components;
CREATE POLICY "School users can delete their preschool components" ON public.preschool_indicator_components AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(preschool_indicator_components.school_id));

DROP POLICY IF EXISTS "School users can insert their preschool components" ON public.preschool_indicator_components;
CREATE POLICY "School users can insert their preschool components" ON public.preschool_indicator_components AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(preschool_indicator_components.school_id));

DROP POLICY IF EXISTS "School users can update their preschool components" ON public.preschool_indicator_components;
CREATE POLICY "School users can update their preschool components" ON public.preschool_indicator_components AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(preschool_indicator_components.school_id));

DROP POLICY IF EXISTS "School users can view their preschool components" ON public.preschool_indicator_components;
CREATE POLICY "School users can view their preschool components" ON public.preschool_indicator_components AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff_or_teacher(preschool_indicator_components.school_id));

DROP POLICY IF EXISTS "School users can manage primary indicator grades" ON public.primary_final_indicator_grades;
CREATE POLICY "School users can manage primary indicator grades" ON public.primary_final_indicator_grades AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(primary_final_indicator_grades.school_id))
  WITH CHECK (public.is_school_staff(primary_final_indicator_grades.school_id));

DROP POLICY IF EXISTS "School users can manage primary final reports" ON public.primary_final_reports;
CREATE POLICY "School users can manage primary final reports" ON public.primary_final_reports AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(primary_final_reports.school_id))
  WITH CHECK (public.is_school_staff(primary_final_reports.school_id));

DROP POLICY IF EXISTS "School users can view primary final reports" ON public.primary_final_reports;
CREATE POLICY "School users can view primary final reports" ON public.primary_final_reports AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(primary_final_reports.school_id));

DROP POLICY IF EXISTS "School users can delete their primary indicators" ON public.primary_grade_indicators;
CREATE POLICY "School users can delete their primary indicators" ON public.primary_grade_indicators AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(primary_grade_indicators.school_id));

DROP POLICY IF EXISTS "School users can insert their primary indicators" ON public.primary_grade_indicators;
CREATE POLICY "School users can insert their primary indicators" ON public.primary_grade_indicators AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(primary_grade_indicators.school_id));

DROP POLICY IF EXISTS "School users can update their primary indicators" ON public.primary_grade_indicators;
CREATE POLICY "School users can update their primary indicators" ON public.primary_grade_indicators AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(primary_grade_indicators.school_id));

DROP POLICY IF EXISTS "School users can view their primary indicators" ON public.primary_grade_indicators;
CREATE POLICY "School users can view their primary indicators" ON public.primary_grade_indicators AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff_or_teacher(primary_grade_indicators.school_id));

DROP POLICY IF EXISTS "School users can delete their primary scales" ON public.primary_grading_scales;
CREATE POLICY "School users can delete their primary scales" ON public.primary_grading_scales AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(primary_grading_scales.school_id));

DROP POLICY IF EXISTS "School users can insert their primary scales" ON public.primary_grading_scales;
CREATE POLICY "School users can insert their primary scales" ON public.primary_grading_scales AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(primary_grading_scales.school_id));

DROP POLICY IF EXISTS "School users can update their primary scales" ON public.primary_grading_scales;
CREATE POLICY "School users can update their primary scales" ON public.primary_grading_scales AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(primary_grading_scales.school_id));

DROP POLICY IF EXISTS "School users can view their primary scales" ON public.primary_grading_scales;
CREATE POLICY "School users can view their primary scales" ON public.primary_grading_scales AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff_or_teacher(primary_grading_scales.school_id));

DROP POLICY IF EXISTS "School users can delete their indicator areas" ON public.primary_indicator_areas;
CREATE POLICY "School users can delete their indicator areas" ON public.primary_indicator_areas AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(primary_indicator_areas.school_id));

DROP POLICY IF EXISTS "School users can insert their indicator areas" ON public.primary_indicator_areas;
CREATE POLICY "School users can insert their indicator areas" ON public.primary_indicator_areas AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(primary_indicator_areas.school_id));

DROP POLICY IF EXISTS "School users can update their indicator areas" ON public.primary_indicator_areas;
CREATE POLICY "School users can update their indicator areas" ON public.primary_indicator_areas AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(primary_indicator_areas.school_id));

DROP POLICY IF EXISTS "School users can view their indicator areas" ON public.primary_indicator_areas;
CREATE POLICY "School users can view their indicator areas" ON public.primary_indicator_areas AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff_or_teacher(primary_indicator_areas.school_id));

DROP POLICY IF EXISTS "School users can manage their representatives" ON public.representatives;
CREATE POLICY "School users can manage their representatives" ON public.representatives AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1 FROM public.family_schools fs WHERE ((fs.family_id = representatives.family_id) AND public.is_school_staff(fs.school_id)))));

DROP POLICY IF EXISTS "school_users_resumen_final" ON public.resumen_final_config;
CREATE POLICY "school_users_resumen_final" ON public.resumen_final_config AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(school_id));

DROP POLICY IF EXISTS "school_users_resumen_final_subject_overrides" ON public.resumen_final_subject_overrides;
CREATE POLICY "school_users_resumen_final_subject_overrides" ON public.resumen_final_subject_overrides AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(school_id));

DROP POLICY IF EXISTS "School users can view their school_modules" ON public.school_modules;
CREATE POLICY "School users can view their school_modules" ON public.school_modules AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(school_modules.school_id));

DROP POLICY IF EXISTS "School users can delete their school_payment_methods" ON public.school_payment_methods;
CREATE POLICY "School users can delete their school_payment_methods" ON public.school_payment_methods AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(school_payment_methods.school_id));

DROP POLICY IF EXISTS "School users can insert their school_payment_methods" ON public.school_payment_methods;
CREATE POLICY "School users can insert their school_payment_methods" ON public.school_payment_methods AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(school_payment_methods.school_id));

DROP POLICY IF EXISTS "School users can update their school_payment_methods" ON public.school_payment_methods;
CREATE POLICY "School users can update their school_payment_methods" ON public.school_payment_methods AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(school_payment_methods.school_id));

DROP POLICY IF EXISTS "School users can view their school_payment_methods" ON public.school_payment_methods;
CREATE POLICY "School users can view their school_payment_methods" ON public.school_payment_methods AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(school_payment_methods.school_id));

DROP POLICY IF EXISTS "School users can manage their school_payment_settings" ON public.school_payment_settings;
CREATE POLICY "School users can manage their school_payment_settings" ON public.school_payment_settings AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(school_payment_settings.school_id))
  WITH CHECK (public.is_school_staff(school_payment_settings.school_id));

DROP POLICY IF EXISTS "School users can insert their subjects" ON public.school_subjects;
CREATE POLICY "School users can insert their subjects" ON public.school_subjects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(school_subjects.school_id));

DROP POLICY IF EXISTS "School users can update their subjects" ON public.school_subjects;
CREATE POLICY "School users can update their subjects" ON public.school_subjects AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(school_subjects.school_id));

DROP POLICY IF EXISTS "School users can view their subjects" ON public.school_subjects;
CREATE POLICY "School users can view their subjects" ON public.school_subjects AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(school_subjects.school_id));

DROP POLICY IF EXISTS "School users can delete their school years" ON public.school_years;
CREATE POLICY "School users can delete their school years" ON public.school_years AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(school_years.school_id));

DROP POLICY IF EXISTS "School users can insert their school years" ON public.school_years;
CREATE POLICY "School users can insert their school years" ON public.school_years AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(school_years.school_id));

DROP POLICY IF EXISTS "School users can update their school years" ON public.school_years;
CREATE POLICY "School users can update their school years" ON public.school_years AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(school_years.school_id));

DROP POLICY IF EXISTS "School users can view their school years" ON public.school_years;
CREATE POLICY "School users can view their school years" ON public.school_years AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(school_years.school_id));

DROP POLICY IF EXISTS "School users can view their assigned school" ON public.schools;
CREATE POLICY "School users can view their assigned school" ON public.schools AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_school_staff(schools.id));

DROP POLICY IF EXISTS "School users can delete their sections" ON public.sections;
CREATE POLICY "School users can delete their sections" ON public.sections AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(sections.school_id));

DROP POLICY IF EXISTS "School users can insert their sections" ON public.sections;
CREATE POLICY "School users can insert their sections" ON public.sections AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(sections.school_id));

DROP POLICY IF EXISTS "School users can update their sections" ON public.sections;
CREATE POLICY "School users can update their sections" ON public.sections AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(sections.school_id));

DROP POLICY IF EXISTS "School users can view their sections" ON public.sections;
CREATE POLICY "School users can view their sections" ON public.sections AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(sections.school_id));

DROP POLICY IF EXISTS "School users can manage their student_concept_balances" ON public.student_concept_balances;
CREATE POLICY "School users can manage their student_concept_balances" ON public.student_concept_balances AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(student_concept_balances.school_id))
  WITH CHECK (public.is_school_staff(student_concept_balances.school_id));

DROP POLICY IF EXISTS "School users can view grades" ON public.student_grades;
CREATE POLICY "School users can view grades" ON public.student_grades AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(student_grades.school_id));

DROP POLICY IF EXISTS "School users can manage their student_payment_plans" ON public.student_payment_plans;
CREATE POLICY "School users can manage their student_payment_plans" ON public.student_payment_plans AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(student_payment_plans.school_id))
  WITH CHECK (public.is_school_staff(student_payment_plans.school_id));

DROP POLICY IF EXISTS "School users can manage their student_schools" ON public.student_schools;
CREATE POLICY "School users can manage their student_schools" ON public.student_schools AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(student_schools.school_id));

DROP POLICY IF EXISTS "School users can delete their assignments" ON public.subject_teacher_assignments;
CREATE POLICY "School users can delete their assignments" ON public.subject_teacher_assignments AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(subject_teacher_assignments.school_id));

DROP POLICY IF EXISTS "School users can insert their assignments" ON public.subject_teacher_assignments;
CREATE POLICY "School users can insert their assignments" ON public.subject_teacher_assignments AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(subject_teacher_assignments.school_id));

DROP POLICY IF EXISTS "School users can update their assignments" ON public.subject_teacher_assignments;
CREATE POLICY "School users can update their assignments" ON public.subject_teacher_assignments AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(subject_teacher_assignments.school_id));

DROP POLICY IF EXISTS "School users can view their assignments" ON public.subject_teacher_assignments;
CREATE POLICY "School users can view their assignments" ON public.subject_teacher_assignments AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff_or_teacher(subject_teacher_assignments.school_id));

DROP POLICY IF EXISTS "School users can manage their teacher signatures" ON public.teacher_signatures;
CREATE POLICY "School users can manage their teacher signatures" ON public.teacher_signatures AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(teacher_signatures.school_id))
  WITH CHECK (public.is_school_staff(teacher_signatures.school_id));

DROP POLICY IF EXISTS "School users can delete their teachers" ON public.teachers;
CREATE POLICY "School users can delete their teachers" ON public.teachers AS PERMISSIVE FOR DELETE TO public
  USING (public.is_school_staff(teachers.school_id));

DROP POLICY IF EXISTS "School users can insert their teachers" ON public.teachers;
CREATE POLICY "School users can insert their teachers" ON public.teachers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_school_staff(teachers.school_id));

DROP POLICY IF EXISTS "School users can update their teachers" ON public.teachers;
CREATE POLICY "School users can update their teachers" ON public.teachers AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_school_staff(teachers.school_id));

DROP POLICY IF EXISTS "School users can view their teachers" ON public.teachers;
CREATE POLICY "School users can view their teachers" ON public.teachers AS PERMISSIVE FOR SELECT TO public
  USING (public.is_school_staff(teachers.school_id));

-- ── Lecturas que el portal del docente necesita y venían del hueco ──────────────────────────

-- Docentes del propio colegio (useTeacherData, TeacherSignatureCard, docente principal de la boleta)
DROP POLICY IF EXISTS "Teachers can view their school teachers" ON public.teachers;
CREATE POLICY "Teachers can view their school teachers" ON public.teachers AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_school_teacher(school_id));

-- Plantillas de boleta y firmas del colegio (vista previa de la boleta de primaria)
DROP POLICY IF EXISTS "Teachers can view boleta templates" ON public.boleta_templates;
CREATE POLICY "Teachers can view boleta templates" ON public.boleta_templates AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_school_teacher(school_id));

DROP POLICY IF EXISTS "Teachers can view school teacher signatures" ON public.teacher_signatures;
CREATE POLICY "Teachers can view school teacher signatures" ON public.teacher_signatures AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_school_teacher(school_id));

-- ── Lecturas que el portal del representante necesita y venían del hueco ─────────────────────

-- PaymentReportModal: tasa del día para convertir el monto reportado
DROP POLICY IF EXISTS "Families can view their school exchange_rates" ON public.exchange_rates;
CREATE POLICY "Families can view their school exchange_rates" ON public.exchange_rates AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_school_family(school_id));

-- RepAddStudent / RepAddRepresentative: grupos del formulario dinámico
DROP POLICY IF EXISTS "Families can view their school form field groups" ON public.form_field_groups;
CREATE POLICY "Families can view their school form field groups" ON public.form_field_groups AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_school_family(school_id));

-- RepPayments / PaymentReportModal: métodos de pago activos del colegio
DROP POLICY IF EXISTS "Families can view their school payment methods" ON public.school_payment_methods;
CREATE POLICY "Families can view their school payment methods" ON public.school_payment_methods AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_active AND public.is_school_family(school_id));

-- ChildClassroom / CommentsAndReactions: nombre del docente de las áreas de sus hijos
DROP POLICY IF EXISTS "Families can view their children teachers" ON public.teachers;
CREATE POLICY "Families can view their children teachers" ON public.teachers AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.teaches_my_children(id));

-- ChildClassroom: nombre del área (catálogo del colegio, no depende de la publicación de notas)
DROP POLICY IF EXISTS "Families can view their school subjects" ON public.school_subjects;
CREATE POLICY "Families can view their school subjects" ON public.school_subjects AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_school_family(school_id));

NOTIFY pgrst, 'reload schema';
