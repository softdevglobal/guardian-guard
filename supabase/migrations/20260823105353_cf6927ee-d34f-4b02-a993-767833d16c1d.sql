CREATE OR REPLACE FUNCTION public.is_test_title(_title text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(_title, '') ILIKE 'GG SYSTEM TEST%' OR COALESCE(_title, '') ILIKE '[MOCK AUDIT DATA]%'
$$;

REVOKE ALL ON FUNCTION public.is_test_title(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_test_title(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_evidence_on_registration_scope() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_evidence_on_registration_scope() TO service_role;