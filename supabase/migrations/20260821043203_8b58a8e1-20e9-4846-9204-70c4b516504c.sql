CREATE POLICY "task evidence upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-evidence'
  AND (storage.foldername(name))[1] = public.get_user_organisation_id(auth.uid())::text
  AND public.can_edit_shift(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "task evidence read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-evidence'
  AND public.can_access_shift(((storage.foldername(name))[2])::uuid)
);