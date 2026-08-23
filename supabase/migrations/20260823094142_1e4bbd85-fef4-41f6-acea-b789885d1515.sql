
DROP POLICY IF EXISTS "Tenant admin updates own unverified documents" ON public.organisation_documents;
CREATE POLICY "Tenant admin updates own unverified documents"
ON public.organisation_documents FOR UPDATE TO authenticated
USING (
  organisation_id = public.get_user_organisation_id(auth.uid())
  AND public.is_tenant_admin()
  AND verification_status <> 'verified'
)
WITH CHECK (
  organisation_id = public.get_user_organisation_id(auth.uid())
  AND public.is_tenant_admin()
  AND verification_status <> 'verified'
  AND verified_by IS NULL
  AND verified_at IS NULL
);

DROP POLICY IF EXISTS "Users submit complaints" ON public.complaints;
CREATE POLICY "Users submit complaints"
ON public.complaints FOR INSERT TO authenticated
WITH CHECK (
  organisation_id = public.get_user_organisation_id(auth.uid())
  AND (submitted_by IS NULL OR submitted_by = auth.uid())
);
