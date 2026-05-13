-- Allow changing/removing a student's payment plan without losing payment history.
-- Pending balances from the previous plan are retired, while balances with
-- payments keep the paid amount as historical evidence and stop contributing debt.

CREATE OR REPLACE FUNCTION public.retire_student_plan_balances(
  _student_id uuid,
  _school_id uuid,
  _school_year_id uuid,
  _plan_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove balances that never received a payment.
  DELETE FROM public.student_concept_balances scb
  USING public.payment_plan_concepts ppc
  WHERE scb.plan_concept_id = ppc.id
    AND ppc.plan_id = _plan_id
    AND scb.student_id = _student_id
    AND scb.school_id = _school_id
    AND scb.school_year_id = _school_year_id
    AND COALESCE(scb.paid_amount, 0) <= 0;

  -- Keep historical paid balances, but do not carry pending debt from an old plan.
  UPDATE public.student_concept_balances scb
  SET total_amount = COALESCE(scb.paid_amount, 0),
      balance = 0,
      status = 'paid',
      updated_at = now()
  FROM public.payment_plan_concepts ppc
  WHERE scb.plan_concept_id = ppc.id
    AND ppc.plan_id = _plan_id
    AND scb.student_id = _student_id
    AND scb.school_id = _school_id
    AND scb.school_year_id = _school_year_id
    AND COALESCE(scb.paid_amount, 0) > 0
    AND COALESCE(scb.balance, 0) > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_student_balances_on_plan_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.retire_student_plan_balances(
    OLD.student_id,
    OLD.school_id,
    OLD.school_year_id,
    OLD.plan_id
  );
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_student_payment_plan_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.plan_id IS DISTINCT FROM NEW.plan_id THEN
    PERFORM public.retire_student_plan_balances(
      OLD.student_id,
      OLD.school_id,
      OLD.school_year_id,
      OLD.plan_id
    );

    PERFORM public.create_missing_student_concept_balances_for_assignment(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_student_balances_on_plan_removal ON public.student_payment_plans;
CREATE TRIGGER trg_cleanup_student_balances_on_plan_removal
AFTER DELETE ON public.student_payment_plans
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_student_balances_on_plan_removal();

DROP TRIGGER IF EXISTS trg_sync_balances_on_student_payment_plan_change ON public.student_payment_plans;
CREATE TRIGGER trg_sync_balances_on_student_payment_plan_change
AFTER UPDATE OF plan_id
ON public.student_payment_plans
FOR EACH ROW
EXECUTE FUNCTION public.handle_student_payment_plan_change();

NOTIFY pgrst, 'reload schema';
