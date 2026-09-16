-- A municipal invitation is an organization credential, not merely a city name.
-- Requiring the UF prevents issuing an invite to a same-named municipality in a
-- different state and makes the account/subscription prerequisite explicit.

DROP FUNCTION IF EXISTS public.create_console_invite_token(text, text, integer, text, uuid);

CREATE FUNCTION public.create_console_invite_token(
  p_role text,
  p_municipio text,
  p_uf text,
  p_expires_in_minutes integer,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_organization_id uuid;
  v_code text;
  v_management_id uuid := gen_random_uuid();
  v_actor_name text;
  v_expires_at timestamptz;
  v_hash text;
  v_previous jsonb;
  v_result jsonb;
  v_municipio text := nullif(btrim(p_municipio), '');
  v_uf text := upper(nullif(btrim(p_uf), ''));
BEGIN
  IF v_actor IS NULL OR p_operation_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_role NOT IN ('agent', 'supervisor', 'admin') THEN RAISE EXCEPTION 'invalid_invite_role' USING ERRCODE = '22023'; END IF;
  IF char_length(v_municipio) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'municipio_required' USING ERRCODE = '22023'; END IF;
  IF v_uf !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'state_required' USING ERRCODE = '22023'; END IF;
  IF p_expires_in_minutes NOT BETWEEN 15 AND 10080 THEN RAISE EXCEPTION 'invalid_expiration' USING ERRCODE = '22023'; END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023'; END IF;
  IF NOT private.can_manage_invite_tokens(v_municipio, v_actor) THEN RAISE EXCEPTION 'token_management_not_allowed' USING ERRCODE = '42501'; END IF;
  IF private.has_internal_permission('token.manage', v_actor) AND NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;

  SELECT organization.id INTO v_organization_id
  FROM public.organizations AS organization
  WHERE lower(btrim(organization.municipality_name)) = lower(v_municipio)
    AND upper(organization.state_code) = v_uf
    AND organization.status IN ('onboarding', 'pilot', 'active')
  ORDER BY organization.created_at
  LIMIT 1;
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'municipal_organization_not_found' USING ERRCODE = '23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions AS subscription
    WHERE subscription.organization_id = v_organization_id
      AND subscription.status IN ('trial', 'active', 'grace')
  ) THEN
    RAISE EXCEPTION 'municipal_subscription_inactive' USING ERRCODE = '42501';
  END IF;

  v_hash := md5(concat_ws('|', p_role, v_municipio, v_uf, p_expires_in_minutes, btrim(p_reason)));
  SELECT result INTO v_previous FROM public.internal_operations WHERE actor_id = v_actor AND operation_id = p_operation_id AND request_hash = v_hash;
  IF v_previous IS NOT NULL THEN RETURN v_previous || jsonb_build_object('token_reveal_available', false); END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, v_actor, 'token.create', v_hash);

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  v_expires_at := now() + make_interval(mins => p_expires_in_minutes);
  SELECT name INTO v_actor_name FROM public.users WHERE uid = v_actor;
  INSERT INTO public.invite_tokens(management_id, codigo, role, municipio, organization_id, "criadoPor", "criadoPorNome", usado, "expiraEm", "criadoEm")
  VALUES (v_management_id, v_code, p_role, v_municipio, v_organization_id, v_actor, coalesce(v_actor_name, 'Console TCS'), false, v_expires_at, now());

  v_result := jsonb_build_object('ok', true, 'management_id', v_management_id, 'role', p_role, 'municipio', v_municipio, 'uf', v_uf, 'expires_at', v_expires_at);
  UPDATE public.internal_operations SET status = 'succeeded', result = v_result, completed_at = now()
  WHERE actor_id = v_actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (v_actor, private.current_internal_role(v_actor), 'token.create', 'invite_token', v_management_id::text, 'allowed', left(btrim(p_reason), 500), jsonb_build_object('role', p_role, 'municipio', v_municipio, 'uf', v_uf, 'organization_id', v_organization_id, 'expires_at', v_expires_at));
  RETURN v_result || jsonb_build_object('token', v_code, 'token_reveal_available', true);
END;
$$;

REVOKE ALL ON FUNCTION public.create_console_invite_token(text, text, text, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_console_invite_token(text, text, text, integer, text, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
