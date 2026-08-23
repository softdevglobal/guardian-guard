-- 1. Parent-ownership checks on INSERT policies -------------------------------

DROP POLICY IF EXISTS "Create incident versions" ON public.incident_versions;
CREATE POLICY "Create incident versions" ON public.incident_versions
FOR INSERT TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.incidents i
    WHERE i.id = incident_versions.incident_id
      AND i.organisation_id = public.get_user_organisation_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Create incident workflow" ON public.incident_workflow_history;
CREATE POLICY "Create incident workflow" ON public.incident_workflow_history
FOR INSERT TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.incidents i
    WHERE i.id = incident_workflow_history.incident_id
      AND i.organisation_id = public.get_user_organisation_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Create complaint workflow" ON public.complaint_workflow_history;
CREATE POLICY "Create complaint workflow" ON public.complaint_workflow_history
FOR INSERT TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_workflow_history.complaint_id
      AND c.organisation_id = public.get_user_organisation_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Create incident actions" ON public.incident_actions;
CREATE POLICY "Create incident actions" ON public.incident_actions
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.incidents i
    WHERE i.id = incident_actions.incident_id
      AND i.organisation_id = public.get_user_organisation_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Create risk mitigations" ON public.risk_mitigations;
CREATE POLICY "Create risk mitigations" ON public.risk_mitigations
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.risks r
    WHERE r.id = risk_mitigations.risk_id
      AND r.organisation_id = public.get_user_organisation_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Record participant progress" ON public.participant_progress;
CREATE POLICY "Record participant progress" ON public.participant_progress
FOR INSERT TO authenticated
WITH CHECK (
  recorded_by = auth.uid()
  AND public.can_access_participant(participant_id)
);

-- 2. form-attachments storage ownership ---------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_form_attachment(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (storage.foldername(_object_name))[1] IS NULL THEN false
    WHEN (storage.foldername(_object_name))[1] !~ '^[0-9a-fA-F-]{36}$' THEN false
    WHEN (storage.foldername(_object_name))[1] = auth.uid()::text THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = ((storage.foldername(_object_name))[1])::uuid
        AND up.organisation_id = public.get_user_organisation_id(auth.uid())
        AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','hr_admin','supervisor']::app_role[])
    )
  END
$$;

DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
CREATE POLICY "form attachments read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'form-attachments' AND public.can_access_form_attachment(name));

DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "form attachments upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'form-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
