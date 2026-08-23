REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.is_tenant_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated;