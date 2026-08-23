
-- user_profiles
DROP POLICY IF EXISTS "Admins compliance HR can view all profiles" ON public.user_profiles;
CREATE POLICY "Admins compliance HR view org profiles"
ON public.user_profiles FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','hr_admin']::app_role[])
    AND organisation_id IS NOT DISTINCT FROM public.get_user_organisation_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Super admins can manage profiles" ON public.user_profiles;
CREATE POLICY "Super admins manage org profiles"
ON public.user_profiles FOR ALL TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    AND organisation_id IS NOT DISTINCT FROM public.get_user_organisation_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    AND organisation_id IS NOT DISTINCT FROM public.get_user_organisation_id(auth.uid())
  )
);

-- audit_logs
DROP POLICY IF EXISTS "Admins compliance view audit" ON public.audit_logs;
CREATE POLICY "Admins compliance view org audit"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[])
    AND organisation_id IS NOT DISTINCT FROM public.get_user_organisation_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Executives view audit" ON public.audit_logs;
CREATE POLICY "Executives view org audit"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'executive'::app_role)
  AND organisation_id IS NOT DISTINCT FROM public.get_user_organisation_id(auth.uid())
);

-- ai_activity_logs
DROP POLICY IF EXISTS "Admins compliance view AI logs" ON public.ai_activity_logs;
CREATE POLICY "Admins compliance view org AI logs"
ON public.ai_activity_logs FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[])
    AND organisation_id IS NOT DISTINCT FROM public.get_user_organisation_id(auth.uid())
  )
);

-- training_completions
DROP POLICY IF EXISTS "Admins view all completions" ON public.training_completions;
CREATE POLICY "Admins view org completions"
ON public.training_completions FOR SELECT TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','hr_admin']::app_role[])
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = training_completions.user_id
      AND up.organisation_id IS NOT DISTINCT FROM public.get_user_organisation_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins update completions" ON public.training_completions;
CREATE POLICY "Admins update org completions"
ON public.training_completions FOR UPDATE TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','hr_admin']::app_role[])
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = training_completions.user_id
      AND up.organisation_id IS NOT DISTINCT FROM public.get_user_organisation_id(auth.uid())
  )
);

-- policy_acknowledgements
DROP POLICY IF EXISTS "Admins view acknowledgements" ON public.policy_acknowledgements;
CREATE POLICY "Admins view org acknowledgements"
ON public.policy_acknowledgements FOR SELECT TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','hr_admin']::app_role[])
  AND EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_acknowledgements.policy_id
      AND p.organisation_id IS NOT DISTINCT FROM public.get_user_organisation_id(auth.uid())
  )
);
