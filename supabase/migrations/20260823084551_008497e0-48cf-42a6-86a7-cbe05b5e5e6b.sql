REVOKE EXECUTE ON FUNCTION public.can_access_form_attachment(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_form_attachment(text) TO authenticated;