-- Reparo operacional idempotente para comunicados e notificações mobile.
-- Executar com conexão administrativa somente após revisar o ambiente alvo.
-- Nenhuma credencial é consultada, copiada ou gravada por este procedimento.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';

WITH exact_matches AS (
  SELECT
    profile.uid,
    profile.role,
    organization.id AS organization_id,
    count(*) OVER (PARTITION BY profile.uid) AS match_count
  FROM public.users profile
  JOIN public.organizations organization
    ON organization.status = 'active'
   AND lower(
     regexp_replace(
       organization.display_name,
       '^prefeitura( municipal)?( de)?[[:space:]]+',
       '',
       'i'
     )
   ) = lower(btrim(profile.municipio))
  WHERE profile."isApproved" IS TRUE
    AND profile.role IN ('agent', 'supervisor', 'admin', 'master_admin')
    AND nullif(btrim(profile.municipio), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_members current_member
      WHERE current_member.user_id = profile.uid
        AND current_member.status = 'active'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.internal_staff staff
      WHERE staff.user_id = profile.uid
    )
), inserted AS (
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    joined_at,
    scope
  )
  SELECT
    exact_matches.organization_id,
    exact_matches.uid,
    CASE
      WHEN exact_matches.role = 'master_admin' THEN 'master'
      ELSE exact_matches.role
    END,
    'active',
    now(),
    '{}'::jsonb
  FROM exact_matches
  WHERE exact_matches.match_count = 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_members existing
      WHERE existing.user_id = exact_matches.uid
        AND existing.organization_id = exact_matches.organization_id
    )
  RETURNING organization_id, role
)
SELECT
  organization.display_name AS organization,
  inserted.role,
  count(*) AS memberships_created
FROM inserted
JOIN public.organizations organization
  ON organization.id = inserted.organization_id
GROUP BY organization.display_name, inserted.role
ORDER BY organization.display_name, inserted.role;

COMMIT;

SELECT
  extension.extname,
  extension.extversion,
  EXISTS (
    SELECT 1
    FROM pg_proc procedure
    JOIN pg_namespace namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'net'
      AND procedure.proname = 'http_post'
  ) AS notification_http_ready
FROM pg_extension extension
WHERE extension.extname = 'pg_net';
