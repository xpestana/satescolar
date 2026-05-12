-- These helper/trigger functions are internal only. They should not be callable
-- directly through the public API by anonymous or authenticated clients.
REVOKE EXECUTE ON FUNCTION public.create_missing_student_concept_balances_for_plan_concept(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_missing_student_concept_balances_for_assignment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_payment_plan_concept_balance_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_student_payment_plan_balance_sync() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';