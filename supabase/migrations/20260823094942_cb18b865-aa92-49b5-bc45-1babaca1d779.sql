
REVOKE EXECUTE ON FUNCTION public.assert_same_org_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_staff_eligibility(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_staff_assignment_eligible(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_incident_handler_training(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_staff_eligibility_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_staff_assignment_eligible_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_incident_handler_training_impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_staff_eligibility(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_staff_assignment_eligible(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_incident_handler_training(uuid) TO authenticated, service_role;
