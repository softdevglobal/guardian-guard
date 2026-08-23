DROP POLICY IF EXISTS "form attachments upload" ON storage.objects;
CREATE POLICY "form attachments upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'form-attachments'
  AND public.can_access_form_attachment(name)
);