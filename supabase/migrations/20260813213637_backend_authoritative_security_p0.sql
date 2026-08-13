-- P0: The database and trusted server components are the authorization boundary.
-- This migration intentionally keeps the public registration flow, but removes
-- table enumeration, arbitrary state transitions, and public execution of
-- privileged routines.

-- Invitation codes are credentials. They must only be checked through the
-- narrowly-scoped RPC below, never listed or mutated by browser clients.
DROP POLICY IF EXISTS tokens_anon_check ON public.invite_tokens;
DROP POLICY IF EXISTS allow_mark_token_used ON public.invite_tokens;
DROP POLICY IF EXISTS allow_self_insert_on_signup ON public.users;

-- Private tables are only accessed by controlled SECURITY DEFINER functions.
-- Enabling RLS makes an accidental future grant fail closed.
ALTER TABLE private.customer_affiliation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.inspection_ownership_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.internal_agent_identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.signup_invite_claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.customer_affiliation_states FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.inspection_ownership_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.internal_agent_identity_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.signup_invite_claims FROM PUBLIC, anon, authenticated;

-- No client should be able to complete a legacy invitation or mark a token as
-- consumed while impersonating another account. Signup is handled by the auth
-- lifecycle and prepare_legacy_invite_signup instead.
REVOKE ALL ON FUNCTION public.consumir_token(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_token_used(text, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- Privileged routines: remove the default PUBLIC/anon entry point and retain
-- execution only for authenticated calls that also pass the internal role check.
REVOKE ALL ON FUNCTION public.admin_reset_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(uuid, text) TO authenticated;
ALTER FUNCTION public.admin_reset_password(uuid, text)
  SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog';

REVOKE ALL ON FUNCTION public.internal_reset_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_reset_password(uuid, text) TO authenticated;
ALTER FUNCTION public.internal_reset_password(uuid, text)
  SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog';

REVOKE ALL ON FUNCTION public.master_delete_user(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_delete_user(uuid, boolean) TO authenticated;
ALTER FUNCTION public.master_delete_user(uuid, boolean)
  SET search_path TO 'public', 'auth', 'pg_catalog';

REVOKE ALL ON FUNCTION public.provision_organization_with_coordinator(jsonb, text, text, boolean, text)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.portal_get_workspace(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_get_workspace(text) TO authenticated;

REVOKE ALL ON FUNCTION public.portal_create_organization_invite(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_create_organization_invite(text, text, integer) TO authenticated;

-- Push tokens are private device credentials. Edge functions use service_role;
-- browser roles must never be allowed to resolve another user's token.
REVOKE ALL ON FUNCTION public.get_push_token_by_uid(uuid) FROM PUBLIC, anon, authenticated;

-- Keep the compatibility RPC callable during signup, but eliminate account
-- enumeration. The authoritative auth flow returns generic errors on conflict.
CREATE OR REPLACE FUNCTION public.check_email_registered(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT false;
$function$;
REVOKE ALL ON FUNCTION public.check_email_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_registered(text) TO anon, authenticated;

-- The registration UI needs only the invite role and municipality after a code
-- is supplied. Do not reveal who created the invitation.
CREATE OR REPLACE FUNCTION public.validate_invite_token(p_codigo text)
RETURNS TABLE(
  codigo text,
  municipio text,
  role text,
  "criadoPor" text,
  valido boolean,
  motivo text,
  "expiraEm" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    invite.codigo,
    invite.municipio,
    invite.role,
    NULL::text,
    CASE
      WHEN coalesce(invite.usado, false) THEN false
      WHEN invite."expiraEm" IS NOT NULL AND invite."expiraEm" < now() THEN false
      ELSE true
    END,
    CASE
      WHEN coalesce(invite.usado, false) THEN 'Token já utilizado. Solicite um novo ao administrador.'
      WHEN invite."expiraEm" IS NOT NULL AND invite."expiraEm" < now() THEN 'Token expirado. Solicite um novo ao administrador.'
      ELSE 'ok'
    END,
    invite."expiraEm"
  FROM public.invite_tokens AS invite
  WHERE upper(trim(invite.codigo)) = upper(trim(p_codigo))
  LIMIT 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.validate_invite_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invite_token(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.prepare_legacy_invite_signup(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_legacy_invite_signup(text, text) TO anon, authenticated;

-- Master dashboards calculate aggregate data on the server and derive the
-- target municipality from the current authenticated profile.
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis_master()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
BEGIN
  SELECT role INTO v_actor_role FROM public.users WHERE uid = auth.uid();
  IF v_actor_role IS DISTINCT FROM 'master_admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'totalVistorias', (SELECT count(*) FROM public.vistorias),
    'altoRisco', (SELECT count(*) FROM public.vistorias WHERE "nivelRisco" IN ('r3', 'r4')),
    'totalUsuarios', (SELECT count(*) FROM public.users),
    'totalMunicipios', (SELECT count(DISTINCT municipio) FROM public.vistorias WHERE municipio IS NOT NULL)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.get_dashboard_kpis_master() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis_master() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis_admin(p_municipio text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_municipio text;
  v_target_municipio text;
  v_hoje timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  SELECT role, municipio INTO v_actor_role, v_actor_municipio
  FROM public.users WHERE uid = auth.uid();

  IF v_actor_role = 'master_admin' THEN
    v_target_municipio := nullif(trim(p_municipio), '');
  ELSIF v_actor_role = 'admin' THEN
    v_target_municipio := v_actor_municipio;
    IF v_target_municipio IS NULL OR nullif(trim(p_municipio), '') IS DISTINCT FROM v_target_municipio THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_target_municipio IS NULL THEN
    RAISE EXCEPTION 'municipio_required' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'total', (SELECT count(*) FROM public.vistorias WHERE municipio = v_target_municipio),
    'hoje', (SELECT count(*) FROM public.vistorias WHERE municipio = v_target_municipio AND "dataVistoria" >= v_hoje),
    'altoRisco', (SELECT count(*) FROM public.vistorias WHERE municipio = v_target_municipio AND "nivelRisco" IN ('r3', 'r4')),
    'medio', (SELECT count(*) FROM public.vistorias WHERE municipio = v_target_municipio AND "nivelRisco" = 'r2'),
    'agentes', (SELECT count(*) FROM public.users WHERE municipio = v_target_municipio AND role = 'agent' AND "isApproved" = true)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.get_dashboard_kpis_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis_admin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_risk_by_municipio()
RETURNS TABLE(municipio text, alto bigint, baixo bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
BEGIN
  SELECT role INTO v_actor_role FROM public.users WHERE uid = auth.uid();
  IF v_actor_role IS DISTINCT FROM 'master_admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    inspection.municipio,
    count(*) FILTER (WHERE inspection."nivelRisco" IN ('r3', 'r4')),
    count(*) FILTER (WHERE inspection."nivelRisco" IN ('r1', 'r2'))
  FROM public.vistorias AS inspection
  WHERE inspection.municipio IS NOT NULL AND inspection.municipio <> ''
  GROUP BY inspection.municipio
  HAVING count(*) > 0
  ORDER BY 2 DESC, 3 DESC
  LIMIT 30;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_risk_by_municipio() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_risk_by_municipio() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_top_municipios(p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
BEGIN
  SELECT role INTO v_actor_role FROM public.users WHERE uid = auth.uid();
  IF v_actor_role IS DISTINCT FROM 'master_admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(row_to_json(item)), '[]'::jsonb)
    FROM (
      SELECT municipio AS nome, count(*) AS count
      FROM public.vistorias
      WHERE municipio IS NOT NULL
      GROUP BY municipio
      ORDER BY count DESC
      LIMIT greatest(1, least(coalesce(p_limit, 10), 50))
    ) AS item
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.get_top_municipios(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_top_municipios(integer) TO authenticated;

-- Trigger/event-trigger helpers are never HTTP/RPC entry points. Remove their
-- default execute grants generically so future definitions fail closed as well.
DO $block$
DECLARE
  function_name regprocedure;
BEGIN
  FOR function_name IN
    SELECT procedure.oid::regprocedure
    FROM pg_proc AS procedure
    WHERE procedure.prosecdef
      AND procedure.prorettype IN ('trigger'::regtype, 'event_trigger'::regtype)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', function_name);
  END LOOP;
END;
$block$;
