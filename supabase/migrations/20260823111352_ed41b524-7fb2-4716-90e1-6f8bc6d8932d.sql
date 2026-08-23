
REVOKE EXECUTE ON FUNCTION public.organisation_applicable_requirements(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.organisation_active_modules(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_org_policies(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_service_selections(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organisation_applicable_requirements(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.organisation_active_modules(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_org_policies(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_service_selections(uuid, text) TO authenticated, service_role;
