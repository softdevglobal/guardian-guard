DROP POLICY IF EXISTS "Insert audit logs" ON public.audit_logs;
CREATE POLICY "Insert audit logs" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (organisation_id IS NULL OR organisation_id = public.get_user_organisation_id(auth.uid()))
);

DROP POLICY IF EXISTS "Insert AI logs" ON public.ai_activity_logs;
CREATE POLICY "Insert AI logs" ON public.ai_activity_logs
FOR INSERT TO authenticated
WITH CHECK (
  (human_reviewer_id IS NULL OR human_reviewer_id = auth.uid())
  AND (organisation_id IS NULL OR organisation_id = public.get_user_organisation_id(auth.uid()))
);

DROP POLICY IF EXISTS "Create alerts" ON public.alerts;
CREATE POLICY "Create alerts" ON public.alerts
FOR INSERT TO authenticated
WITH CHECK (
  organisation_id = public.get_user_organisation_id(auth.uid())
  AND (
    assigned_to IS NULL
    OR public.get_user_organisation_id(assigned_to) = public.get_user_organisation_id(auth.uid())
  )
);