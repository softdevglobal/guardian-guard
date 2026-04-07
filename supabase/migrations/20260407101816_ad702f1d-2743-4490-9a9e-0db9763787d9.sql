
-- Fix user_profiles UPDATE policy - restrict self-update to safe fields only
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can update own safe fields" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND organisation_id IS NOT DISTINCT FROM (SELECT organisation_id FROM public.user_profiles WHERE id = auth.uid())
    AND permitted_modules IS NOT DISTINCT FROM (SELECT permitted_modules FROM public.user_profiles WHERE id = auth.uid())
    AND clearance_status IS NOT DISTINCT FROM (SELECT clearance_status FROM public.user_profiles WHERE id = auth.uid())
    AND data_scope IS NOT DISTINCT FROM (SELECT data_scope FROM public.user_profiles WHERE id = auth.uid())
    AND team_id IS NOT DISTINCT FROM (SELECT team_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- Fix audit log insert policy - require user_id = auth.uid()
DROP POLICY IF EXISTS "Insert audit logs" ON public.audit_logs;

CREATE POLICY "Insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
