-- P1: move identity and municipality mutations behind narrow authenticated RPCs.
-- The client may submit intent, but the database owns authorization, validation,
-- normalization and the final state transition.

CREATE OR REPLACE FUNCTION public.update_my_display_name(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_name) < 2 OR char_length(v_name) > 120 OR v_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid_display_name' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users SET name = v_name WHERE uid = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('name', v_name);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_my_phone(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_phone text := btrim(coalesce(p_phone, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users SET phone = v_phone WHERE uid = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('phone', v_phone);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_my_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_token text := nullif(btrim(coalesce(p_token, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF v_token IS NOT NULL AND (char_length(v_token) < 20 OR char_length(v_token) > 1024 OR v_token ~ '[[:cntrl:]]') THEN
    RAISE EXCEPTION 'invalid_push_token' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users SET "fcmToken" = v_token WHERE uid = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002'; END IF;
END;
$function$;

-- The authorization-field trigger remains the final guard. This capability
-- marker is transaction-local and set only after the RPC authorizes the actor.
CREATE OR REPLACE FUNCTION private.protect_user_authorization_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF private.is_owner_admin() THEN RETURN NEW; END IF;

  IF current_setting('tcs.server_approval_target', true) = OLD.uid::text
     AND NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.municipio IS NOT DISTINCT FROM OLD.municipio
     AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
     AND NEW."isApproved" IS DISTINCT FROM OLD."isApproved" THEN
    RETURN NEW;
  END IF;

  IF current_setting('tcs.customer_bootstrap_user_id', true) = OLD.uid::text
     AND NEW."isApproved" = true
     AND NEW.municipio IS NOT NULL
     AND NEW.organization_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.organization_members AS membership
       JOIN public.organizations AS organization ON organization.id = membership.organization_id
       WHERE membership.user_id = OLD.uid
         AND membership.organization_id = NEW.organization_id
         AND membership.status = 'active'
         AND organization.municipality_name = NEW.municipio
         AND NEW.role = CASE
           WHEN membership.role IN ('master', 'admin') THEN 'admin'
           WHEN membership.role = 'supervisor' THEN 'supervisor'
           ELSE 'agent'
         END
     ) THEN
    RETURN NEW;
  END IF;

  IF current_setting('tcs.customer_bootstrap_user_id', true) = OLD.uid::text
     AND coalesce(OLD."isApproved", false) = false
     AND OLD.role = 'agent'
     AND OLD.municipio IS NULL
     AND OLD.organization_id IS NULL
     AND NEW."isApproved" = true
     AND NEW.role = 'agent'
     AND NEW.municipio IS NULL
     AND NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.municipio IS DISTINCT FROM OLD.municipio
     OR NEW."isApproved" IS DISTINCT FROM OLD."isApproved" THEN
    RAISE EXCEPTION 'authorization_fields_are_server_managed' USING ERRCODE = '42501';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     AND NEW.organization_id IS DISTINCT FROM private.current_organization_id() THEN
    RAISE EXCEPTION 'organization_field_is_server_managed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_user_approval(p_target_uid uuid, p_is_approved boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_municipio text;
  v_target_role text;
  v_target_municipio text;
BEGIN
  IF auth.uid() IS NULL OR p_target_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_target_uid = auth.uid() THEN
    RAISE EXCEPTION 'cannot_change_own_approval' USING ERRCODE = '42501';
  END IF;

  SELECT role, municipio INTO v_actor_role, v_actor_municipio
  FROM public.users WHERE uid = auth.uid();
  SELECT role, municipio INTO v_target_role, v_target_municipio
  FROM public.users WHERE uid = p_target_uid FOR UPDATE;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'target_profile_not_found' USING ERRCODE = 'P0002'; END IF;

  IF v_actor_role = 'master_admin' THEN
    IF v_target_role = 'master_admin' THEN
      RAISE EXCEPTION 'cannot_change_master_approval' USING ERRCODE = '42501';
    END IF;
  ELSIF v_actor_role IN ('admin', 'supervisor')
    AND v_target_role = 'agent'
    AND v_actor_municipio IS NOT NULL
    AND v_actor_municipio = v_target_municipio THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('tcs.server_approval_target', p_target_uid::text, true);
  UPDATE public.users SET "isApproved" = p_is_approved WHERE uid = p_target_uid;
  RETURN jsonb_build_object('uid', p_target_uid, 'isApproved', p_is_approved);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_municipio(p_nome text, p_estado text, p_uf text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_nome text := btrim(coalesce(p_nome, ''));
  v_estado text := btrim(coalesce(p_estado, ''));
  v_uf text := upper(btrim(coalesce(p_uf, '')));
BEGIN
  IF (SELECT role FROM public.users WHERE uid = auth.uid()) IS DISTINCT FROM 'master_admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_nome) < 2 OR char_length(v_nome) > 120 OR v_nome ~ '[[:cntrl:]]'
     OR char_length(v_estado) < 2 OR char_length(v_estado) > 120 OR v_estado ~ '[[:cntrl:]]'
     OR v_uf !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'invalid_municipio' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.municipios (nome, estado, uf, ativo, criado_em, criado_por, dominios_email)
  VALUES (v_nome, v_estado, v_uf, true, now(), auth.uid(), NULL);
  RETURN jsonb_build_object('nome', v_nome, 'estado', v_estado, 'uf', v_uf);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_municipio_email_domains(p_nome text, p_dominios text[])
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_nome text := btrim(coalesce(p_nome, ''));
  v_dominios text[];
BEGIN
  IF (SELECT role FROM public.users WHERE uid = auth.uid()) IS DISTINCT FROM 'master_admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_nome = '' THEN RAISE EXCEPTION 'municipio_required' USING ERRCODE = '22023'; END IF;

  SELECT coalesce(array_agg(domain ORDER BY domain), ARRAY[]::text[])
  INTO v_dominios
  FROM (
    SELECT DISTINCT lower(btrim(value)) AS domain
    FROM unnest(coalesce(p_dominios, ARRAY[]::text[])) AS value
    WHERE btrim(value) <> ''
  ) AS normalized;

  IF EXISTS (
    SELECT 1 FROM unnest(v_dominios) AS domain
    WHERE char_length(domain) > 253
       OR domain !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
  ) THEN
    RAISE EXCEPTION 'invalid_email_domain' USING ERRCODE = '22023';
  END IF;

  UPDATE public.municipios
  SET dominios_email = nullif(v_dominios, ARRAY[]::text[])
  WHERE nome = v_nome;
  IF NOT FOUND THEN RAISE EXCEPTION 'municipio_not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN v_dominios;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_my_display_name(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_phone(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_push_token(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_user_approval(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_municipio(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_municipio_email_domains(text, text[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_my_display_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_push_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_approval(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_municipio(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_municipio_email_domains(text, text[]) TO authenticated;
