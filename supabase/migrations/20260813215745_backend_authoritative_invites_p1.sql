-- Invitation codes are credentials. Generation, expiry, role assignment and
-- rate limits must be enforced atomically in the database, never by the app.
CREATE OR REPLACE FUNCTION public.create_legacy_invite_token(
  p_role text,
  p_municipio text,
  p_expires_in_hours integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_municipio text;
  v_actor_name text;
  v_actor_limit integer;
  v_role text := lower(btrim(coalesce(p_role, '')));
  v_municipio text := btrim(coalesce(p_municipio, ''));
  v_created_this_hour integer;
  v_created_this_month integer;
  v_bytes bytea;
  v_raw text;
  v_code text;
  v_attempt integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT role, municipio, name, token_limit
  INTO v_actor_role, v_actor_municipio, v_actor_name, v_actor_limit
  FROM public.users
  WHERE uid = auth.uid() AND coalesce("isApproved", false);
  IF v_actor_role NOT IN ('admin', 'master_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('agent', 'supervisor', 'admin') THEN
    RAISE EXCEPTION 'invalid_invite_role' USING ERRCODE = '22023';
  END IF;
  IF p_expires_in_hours IS NULL OR p_expires_in_hours < 1 OR p_expires_in_hours > 720 THEN
    RAISE EXCEPTION 'invalid_invite_expiry' USING ERRCODE = '22023';
  END IF;
  IF v_municipio = '' OR NOT EXISTS (
    SELECT 1 FROM public.municipios WHERE nome = v_municipio AND ativo
  ) THEN
    RAISE EXCEPTION 'invalid_municipio' USING ERRCODE = '22023';
  END IF;
  IF v_actor_role = 'admin' AND (v_municipio IS DISTINCT FROM v_actor_municipio OR v_role = 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_created_this_hour
  FROM public.invite_tokens
  WHERE "criadoPor" = auth.uid()::text AND "criadoEm" >= now() - interval '1 hour';
  IF v_created_this_hour >= 10 THEN
    RAISE EXCEPTION 'invite_hourly_limit_reached' USING ERRCODE = '42901';
  END IF;
  IF v_actor_role <> 'master_admin' THEN
    SELECT count(*) INTO v_created_this_month
    FROM public.invite_tokens
    WHERE "criadoPor" = auth.uid()::text
      AND "criadoEm" >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
    IF v_created_this_month >= coalesce(v_actor_limit, 20) THEN
      RAISE EXCEPTION 'invite_monthly_limit_reached' USING ERRCODE = '42901';
    END IF;
  END IF;

  FOR v_attempt IN 1..5 LOOP
    v_bytes := extensions.gen_random_bytes(12);
    SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(v_bytes, position) % 32) + 1, 1), '')
    INTO v_raw
    FROM generate_series(0, 11) AS position;
    v_code := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4);
    BEGIN
      INSERT INTO public.invite_tokens (
        codigo, role, municipio, usado, "expiraEm", "criadoPor", "criadoPorNome", "criadoEm"
      ) VALUES (
        v_code, v_role, v_municipio, false, now() + make_interval(hours => p_expires_in_hours),
        auth.uid()::text, coalesce(v_actor_name, ''), now()
      );
      RETURN jsonb_build_object('codigo', v_code, 'expiraEm', now() + make_interval(hours => p_expires_in_hours));
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
  RAISE EXCEPTION 'invite_code_generation_failed' USING ERRCODE = 'P0001';
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_legacy_invite_tokens(p_codigos text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_municipio text;
  v_codes text[];
  v_deleted integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT role, municipio INTO v_actor_role, v_actor_municipio
  FROM public.users WHERE uid = auth.uid() AND coalesce("isApproved", false);
  IF v_actor_role NOT IN ('admin', 'master_admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  SELECT coalesce(array_agg(DISTINCT upper(btrim(code))), ARRAY[]::text[])
  INTO v_codes
  FROM unnest(coalesce(p_codigos, ARRAY[]::text[])) AS code
  WHERE btrim(code) <> '';
  IF cardinality(v_codes) = 0 OR cardinality(v_codes) > 100 THEN
    RAISE EXCEPTION 'invalid_invite_selection' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.invite_tokens AS invite
  WHERE invite.codigo = ANY(v_codes)
    AND (
      v_actor_role = 'master_admin'
      OR (invite."criadoPor" = auth.uid()::text AND invite.municipio = v_actor_municipio)
    );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_legacy_invite_token(text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_legacy_invite_tokens(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_legacy_invite_token(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_legacy_invite_tokens(text[]) TO authenticated;
