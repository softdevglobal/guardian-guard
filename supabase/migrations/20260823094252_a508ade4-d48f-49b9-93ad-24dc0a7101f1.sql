
DROP POLICY IF EXISTS "Create notifications" ON public.notifications;
CREATE POLICY "Create notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  (organisation_id IS NULL OR organisation_id = public.get_user_organisation_id(auth.uid()))
  AND (
    user_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[])
  )
);
