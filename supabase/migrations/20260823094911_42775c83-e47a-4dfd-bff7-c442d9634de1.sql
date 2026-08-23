
-- 1. Remove direct client access to internal-only helper checks.
--    These are used solely by triggers/other SECURITY DEFINER functions,
--    which execute as the function owner and are unaffected by these revokes.
REVOKE EXECUTE ON FUNCTION public.check_declining_outcomes(uuid, uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.has_current_training(uuid, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.shift_submission_blockers(uuid) FROM authenticated, anon;

-- 2. Cross-organisation guard for the staff/training checks that ARE client callable.
--    Implemented as thin wrappers so the existing logic is preserved byte-for-byte.
CREATE OR REPLACE FUNCTION public.assert_same_org_staff(_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target_org uuid;
  _caller uuid := auth.uid();
BEGIN
  -- Service-role / internal execution has no JWT subject.
  IF _caller IS NULL THEN
    RETURN;
  END IF;
  IF public.is_platform_admin(_caller) THEN
    RETURN;
  END IF;
  IF _staff_id = _caller THEN
    RETURN;
  END IF;
  SELECT organisation_id INTO _target_org FROM public.user_profiles WHERE id = _staff_id;
  IF _target_org IS NULL OR _target_org IS DISTINCT FROM public.get_user_organisation_id(_caller) THEN
    RAISE EXCEPTION 'Not authorised to evaluate this staff member';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.assert_same_org_staff(uuid) FROM authenticated, anon;

ALTER FUNCTION public.evaluate_staff_eligibility(uuid) RENAME TO evaluate_staff_eligibility_impl;
CREATE OR REPLACE FUNCTION public.evaluate_staff_eligibility(_staff_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.assert_same_org_staff(_staff_id);
  RETURN public.evaluate_staff_eligibility_impl(_staff_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.evaluate_staff_eligibility_impl(uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_staff_eligibility(uuid) TO authenticated;

ALTER FUNCTION public.check_staff_assignment_eligible(uuid) RENAME TO check_staff_assignment_eligible_impl;
CREATE OR REPLACE FUNCTION public.check_staff_assignment_eligible(_staff_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.assert_same_org_staff(_staff_id);
  RETURN public.check_staff_assignment_eligible_impl(_staff_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_staff_assignment_eligible_impl(uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_staff_assignment_eligible(uuid) TO authenticated;

ALTER FUNCTION public.check_incident_handler_training(uuid) RENAME TO check_incident_handler_training_impl;
CREATE OR REPLACE FUNCTION public.check_incident_handler_training(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.assert_same_org_staff(_user_id);
  RETURN public.check_incident_handler_training_impl(_user_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_incident_handler_training_impl(uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_incident_handler_training(uuid) TO authenticated;

-- 3. Alerts: allow org-scoped compliance oversight to triage/reassign alerts.
DROP POLICY IF EXISTS "Compliance manage org alerts" ON public.alerts;
CREATE POLICY "Compliance manage org alerts"
ON public.alerts FOR UPDATE TO authenticated
USING (
  organisation_id = public.get_user_organisation_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[])
)
WITH CHECK (
  organisation_id = public.get_user_organisation_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[])
);
