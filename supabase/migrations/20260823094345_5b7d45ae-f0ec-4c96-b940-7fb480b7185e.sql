
DROP POLICY IF EXISTS "Create policy versions" ON public.policy_versions;
CREATE POLICY "Create policy versions"
ON public.policy_versions FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[])
  AND EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_versions.policy_id
      AND p.organisation_id IS NOT DISTINCT FROM public.get_user_organisation_id(auth.uid())
  )
);
