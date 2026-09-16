-- Repara a matriz de permissões do owner após a liberação global de vistorias.
-- Mantém as permissões do console e adiciona as capacidades mobile do owner.

CREATE OR REPLACE FUNCTION private.internal_permissions(p_role text)
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT private.internal_permissions_before_whatsapp(p_role)
    || CASE p_role
      WHEN 'owner' THEN ARRAY['whatsapp.read', 'whatsapp.recover', 'whatsapp.manage']::text[]
      WHEN 'developer' THEN ARRAY['whatsapp.read', 'whatsapp.recover', 'whatsapp.manage']::text[]
      WHEN 'support' THEN ARRAY['whatsapp.read', 'whatsapp.recover']::text[]
      WHEN 'auditor' THEN ARRAY['whatsapp.read']::text[]
      ELSE ARRAY[]::text[]
    END
    || CASE WHEN p_role = 'owner'
      THEN ARRAY['mobile.inspection.manage', 'mobile.map.read']::text[]
      ELSE ARRAY[]::text[]
    END;
$$;

NOTIFY pgrst, 'reload schema';
