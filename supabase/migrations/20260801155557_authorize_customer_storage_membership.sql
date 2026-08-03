-- Replace role/municipality-based Storage authorization with immutable object
-- ownership and organization membership. Historical objects remain readable
-- only when they can be resolved to an inspection in the caller's scope.

CREATE OR REPLACE FUNCTION private.can_access_customer_storage_object(
  p_bucket text,
  p_name text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH object_path AS (
    SELECT storage.foldername(p_name) AS folders
  ), scoped_owner AS (
    SELECT CASE
      WHEN folders[1] = 'users'
       AND folders[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN folders[2]::uuid
      ELSE NULL
    END AS user_id
    FROM object_path
  )
  SELECT p_user_id IS NOT NULL
    AND p_bucket IN ('fotos', 'laudos')
    AND (
      private.is_owner_admin(p_user_id)
      OR EXISTS (
        SELECT 1 FROM scoped_owner WHERE user_id = p_user_id
      )
      OR EXISTS (
        SELECT 1
        FROM scoped_owner
        JOIN public.organization_members AS object_owner
          ON object_owner.user_id = scoped_owner.user_id
         AND object_owner.status = 'active'
        JOIN public.organization_members AS reader
          ON reader.organization_id = object_owner.organization_id
         AND reader.user_id = p_user_id
         AND reader.status = 'active'
      )
      OR EXISTS (
        SELECT 1
        FROM public.vistorias AS inspection
        WHERE (
          inspection."agenteUid" = p_user_id::text
          OR inspection.organization_id = private.current_organization_id(p_user_id)
        )
        AND (
          (p_bucket = 'laudos' AND (
            inspection.laudo_url = 'laudos:' || p_name
            OR p_name LIKE '%/' || inspection.id::text || '.pdf'
          ))
          OR (p_bucket = 'fotos' AND (
            inspection."fotoUrl" = 'fotos:' || p_name
            OR p_name LIKE '%/' || inspection.id::text || '/%'
            OR p_name LIKE '%/' || inspection.id::text || '.jpg'
          ))
        )
      )
    )
$$;

CREATE OR REPLACE FUNCTION private.can_write_customer_storage_object(
  p_bucket text,
  p_name text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL
    AND p_bucket IN ('fotos', 'laudos')
    AND (storage.foldername(p_name))[1] = 'users'
    AND (storage.foldername(p_name))[2] = p_user_id::text
    AND NOT (storage.foldername(p_name)) @> ARRAY['..']
$$;

REVOKE ALL ON FUNCTION private.can_access_customer_storage_object(text, text, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_write_customer_storage_object(text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_access_customer_storage_object(text, text, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_write_customer_storage_object(text, text, uuid)
  TO authenticated;

DROP POLICY IF EXISTS "tcs_media_read" ON storage.objects;
CREATE POLICY "tcs_media_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  (SELECT private.can_access_customer_storage_object(bucket_id, name, auth.uid()))
);

DROP POLICY IF EXISTS "tcs_media_insert" ON storage.objects;
CREATE POLICY "tcs_media_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT private.can_write_customer_storage_object(bucket_id, name, auth.uid()))
);

DROP POLICY IF EXISTS "tcs_media_update" ON storage.objects;
CREATE POLICY "tcs_media_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  owner_id = (SELECT auth.uid()::text)
  AND (SELECT private.can_write_customer_storage_object(bucket_id, name, auth.uid()))
)
WITH CHECK (
  owner_id = (SELECT auth.uid()::text)
  AND (SELECT private.can_write_customer_storage_object(bucket_id, name, auth.uid()))
);

DROP POLICY IF EXISTS "tcs_media_delete" ON storage.objects;
CREATE POLICY "tcs_media_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  owner_id = (SELECT auth.uid()::text)
  AND (SELECT private.can_write_customer_storage_object(bucket_id, name, auth.uid()))
);

COMMENT ON FUNCTION private.can_access_customer_storage_object(text, text, uuid) IS
  'Authorizes customer media by immutable user path, same-organization membership, or a resolvable historical inspection.';
COMMENT ON FUNCTION private.can_write_customer_storage_object(text, text, uuid) IS
  'Requires new customer media paths to be rooted at users/<auth.uid>/.';
