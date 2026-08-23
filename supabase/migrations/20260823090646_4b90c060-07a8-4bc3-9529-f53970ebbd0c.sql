DROP POLICY IF EXISTS "org docs tenant read" ON storage.objects;
CREATE POLICY "org docs tenant read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND (
      public.is_platform_admin()
      OR (storage.foldername(name))[1] = public.get_user_organisation_id(auth.uid())::text
    )
  );

DROP POLICY IF EXISTS "org docs tenant upload" ON storage.objects;
CREATE POLICY "org docs tenant upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = public.get_user_organisation_id(auth.uid())::text
    AND public.is_tenant_admin()
  );

DROP POLICY IF EXISTS "org docs tenant update" ON storage.objects;
CREATE POLICY "org docs tenant update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = public.get_user_organisation_id(auth.uid())::text
    AND public.is_tenant_admin()
  )
  WITH CHECK (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = public.get_user_organisation_id(auth.uid())::text
  );