-- Infraestrutura de mídia usada pelo app móvel e pelo painel.
-- Buckets novos são privados; ambientes que já possuem os buckets preservam
-- sua configuração atual para não invalidar URLs legadas.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('fotos', 'fotos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('laudos', 'laudos', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- A coluna já era consumida pelo app, mas não estava versionada nas migrations.
ALTER TABLE public.vistorias
  ADD COLUMN IF NOT EXISTS laudo_url TEXT;

DROP POLICY IF EXISTS "tcs_media_read" ON storage.objects;
CREATE POLICY "tcs_media_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN ('fotos', 'laudos')
  AND EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.uid = auth.uid()
       AND u."isApproved" = true
       AND u.role IN ('agent', 'supervisor', 'admin', 'master_admin')
  )
);

DROP POLICY IF EXISTS "tcs_media_insert" ON storage.objects;
CREATE POLICY "tcs_media_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('fotos', 'laudos')
  AND EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.uid = auth.uid()
       AND u."isApproved" = true
       AND u.role IN ('agent', 'supervisor', 'admin', 'master_admin')
  )
);

DROP POLICY IF EXISTS "tcs_media_update" ON storage.objects;
CREATE POLICY "tcs_media_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('fotos', 'laudos')
  AND (
    owner_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
        FROM public.users u
       WHERE u.uid = auth.uid()
         AND u."isApproved" = true
         AND u.role IN ('admin', 'master_admin')
    )
  )
)
WITH CHECK (
  bucket_id IN ('fotos', 'laudos')
  AND (
    owner_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
        FROM public.users u
       WHERE u.uid = auth.uid()
         AND u."isApproved" = true
         AND u.role IN ('admin', 'master_admin')
    )
  )
);

DROP POLICY IF EXISTS "tcs_media_delete" ON storage.objects;
CREATE POLICY "tcs_media_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN ('fotos', 'laudos')
  AND (
    owner_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
        FROM public.users u
       WHERE u.uid = auth.uid()
         AND u."isApproved" = true
         AND u.role IN ('admin', 'master_admin')
    )
  )
);
