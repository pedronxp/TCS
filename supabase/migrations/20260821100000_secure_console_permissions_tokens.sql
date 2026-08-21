-- Console controls must be server-authoritative.  Role permissions remain the
-- baseline, while a narrowly scoped override may grant or revoke a known
-- capability for one active internal staff member.  Invitation credentials are
-- also generated and revoked exclusively through audited RPCs.

CREATE TABLE IF NOT EXISTS public.internal_staff_permission_overrides (
  staff_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  effect text NOT NULL CHECK (effect IN ('grant', 'revoke')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_user_id, permission)
);

CREATE INDEX IF NOT EXISTS internal_staff_permission_overrides_staff_idx
  ON public.internal_staff_permission_overrides(staff_user_id, effect);

ALTER TABLE public.internal_staff_permission_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.internal_staff_permission_overrides FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.internal_staff_permission_overrides TO authenticated;
DROP POLICY IF EXISTS internal_staff_permission_overrides_manage_select ON public.internal_staff_permission_overrides;
CREATE POLICY internal_staff_permission_overrides_manage_select
  ON public.internal_staff_permission_overrides
  FOR SELECT TO authenticated
  USING (private.has_internal_permission('staff.manage'));

CREATE OR REPLACE FUNCTION private.is_valid_internal_permission(p_permission text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_permission = ANY (ARRAY[
    'console.read', 'dashboard.executive.read', 'dashboard.technical.read',
    'customer.read', 'customer.sensitive.read', 'customer.sensitive.request', 'customer.write',
    'commercial.read', 'commercial.write', 'support.read', 'support.write',
    'session.read', 'session.terminate', 'staff.read', 'staff.manage', 'audit.read',
    'technical.read', 'technical.write', 'build.request', 'build.approve',
    'configuration.prepare', 'configuration.publish', 'protocol.read', 'protocol.rotate',
    'account.approve', 'account.lock', 'account.recover_invite',
    'token.manage', 'notification.manage'
  ]::text[]);
$$;

CREATE OR REPLACE FUNCTION private.internal_permissions(p_role text)
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_role
    WHEN 'owner' THEN ARRAY[
      'console.read', 'dashboard.executive.read', 'customer.read', 'customer.sensitive.read',
      'customer.write', 'commercial.read', 'commercial.write', 'support.read', 'support.write',
      'session.read', 'session.terminate', 'staff.read', 'staff.manage', 'audit.read',
      'technical.read', 'technical.write', 'build.request', 'build.approve', 'configuration.publish',
      'protocol.read', 'protocol.rotate',
      'account.approve', 'account.lock', 'account.recover_invite',
      'token.manage', 'notification.manage'
    ]::text[]
    WHEN 'developer' THEN ARRAY[
      'console.read', 'dashboard.technical.read', 'customer.read', 'customer.sensitive.request',
      'commercial.read', 'commercial.write', 'support.read', 'support.write', 'session.read', 'session.terminate',
      'audit.read', 'technical.read', 'technical.write', 'build.request', 'configuration.prepare',
      'protocol.read', 'protocol.rotate', 'token.manage', 'notification.manage'
    ]::text[]
    WHEN 'support' THEN ARRAY[
      'console.read', 'customer.read', 'commercial.read', 'support.read', 'support.write', 'protocol.read',
      'account.approve', 'account.recover_invite'
    ]::text[]
    WHEN 'auditor' THEN ARRAY['console.read', 'customer.read', 'commercial.read', 'audit.read', 'protocol.read']::text[]
    ELSE ARRAY[]::text[] END;
$$;

CREATE OR REPLACE FUNCTION private.internal_effective_permissions(p_user_id uuid DEFAULT auth.uid())
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  WITH staff AS (
    SELECT role FROM public.internal_staff
    WHERE user_id = p_user_id AND status = 'active'
  ), base AS (
    SELECT permission
    FROM staff, unnest(private.internal_permissions(staff.role)) AS permission
  ), effective AS (
    SELECT permission FROM base
    WHERE NOT EXISTS (
      SELECT 1 FROM public.internal_staff_permission_overrides override
      WHERE override.staff_user_id = p_user_id
        AND override.permission = base.permission
        AND override.effect = 'revoke'
    )
    UNION
    SELECT permission FROM public.internal_staff_permission_overrides
    WHERE staff_user_id = p_user_id AND effect = 'grant'
  )
  SELECT COALESCE(array_agg(permission ORDER BY permission), ARRAY[]::text[])
  FROM effective;
$$;

CREATE OR REPLACE FUNCTION private.has_internal_permission(
  p_permission text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL
    AND p_permission = ANY(private.internal_effective_permissions(p_user_id));
$$;

CREATE OR REPLACE FUNCTION public.get_internal_staff_profile()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE staff public.internal_staff;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO staff FROM public.internal_staff WHERE user_id = auth.uid() AND status = 'active';
  IF staff.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', staff.id,
    'user_id', staff.user_id,
    'role', staff.role,
    'status', staff.status,
    'display_name', staff.display_name,
    'permissions', to_jsonb(private.internal_effective_permissions(staff.user_id)),
    'assurance_level', COALESCE(auth.jwt()->>'aal', 'aal1')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.manage_internal_staff_permissions(
  p_user_id uuid,
  p_grants text[],
  p_revokes text[],
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target_role text;
  v_target_status text;
  v_grants text[];
  v_revokes text[];
  v_before jsonb;
  v_after jsonb;
  v_hash text;
  v_previous jsonb;
BEGIN
  IF v_actor IS NULL OR p_user_id IS NULL OR p_operation_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF private.current_internal_role(v_actor) IS DISTINCT FROM 'owner' OR NOT private.has_internal_permission('staff.manage', v_actor) THEN
    RAISE EXCEPTION 'staff_permission_management_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023'; END IF;

  SELECT COALESCE(array_agg(DISTINCT btrim(permission) ORDER BY btrim(permission)), ARRAY[]::text[])
  INTO v_grants FROM unnest(coalesce(p_grants, ARRAY[]::text[])) AS permission WHERE btrim(permission) <> '';
  SELECT COALESCE(array_agg(DISTINCT btrim(permission) ORDER BY btrim(permission)), ARRAY[]::text[])
  INTO v_revokes FROM unnest(coalesce(p_revokes, ARRAY[]::text[])) AS permission WHERE btrim(permission) <> '';
  IF v_grants && v_revokes THEN RAISE EXCEPTION 'permission_override_conflict' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_grants || v_revokes) AS permission WHERE NOT private.is_valid_internal_permission(permission)) THEN
    RAISE EXCEPTION 'invalid_internal_permission' USING ERRCODE = '22023';
  END IF;

  SELECT role, status INTO v_target_role, v_target_status FROM public.internal_staff WHERE user_id = p_user_id FOR UPDATE;
  IF v_target_role IS NULL OR v_target_status <> 'active' THEN RAISE EXCEPTION 'active_internal_staff_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_target_role = 'owner' AND v_revokes && ARRAY['console.read', 'staff.manage']::text[] THEN
    RAISE EXCEPTION 'owner_core_permissions_cannot_be_revoked' USING ERRCODE = '42501';
  END IF;

  v_hash := md5(concat_ws('|', p_user_id, array_to_string(v_grants, ','), array_to_string(v_revokes, ','), btrim(p_reason)));
  SELECT result INTO v_previous FROM public.internal_operations
  WHERE actor_id = v_actor AND operation_id = p_operation_id AND request_hash = v_hash;
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, v_actor, 'staff.permissions.manage', v_hash);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('permission', permission, 'effect', effect) ORDER BY permission), '[]'::jsonb)
  INTO v_before FROM public.internal_staff_permission_overrides WHERE staff_user_id = p_user_id;
  DELETE FROM public.internal_staff_permission_overrides WHERE staff_user_id = p_user_id;
  INSERT INTO public.internal_staff_permission_overrides(staff_user_id, permission, effect, created_by)
  SELECT p_user_id, permission, 'grant', v_actor FROM unnest(v_grants) AS permission
  UNION ALL
  SELECT p_user_id, permission, 'revoke', v_actor FROM unnest(v_revokes) AS permission;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('permission', permission, 'effect', effect) ORDER BY permission), '[]'::jsonb)
  INTO v_after FROM public.internal_staff_permission_overrides WHERE staff_user_id = p_user_id;

  v_previous := jsonb_build_object('ok', true, 'user_id', p_user_id, 'permissions', to_jsonb(private.internal_effective_permissions(p_user_id)));
  UPDATE public.internal_operations SET status = 'succeeded', result = v_previous, completed_at = now()
  WHERE actor_id = v_actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (v_actor, private.current_internal_role(v_actor), 'staff.permissions.manage', 'internal_staff', p_user_id::text, 'allowed', left(btrim(p_reason), 500), jsonb_build_object('before', v_before, 'after', v_after));
  RETURN v_previous;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_internal_staff_permission_overrides()
RETURNS TABLE(staff_user_id uuid, permission text, effect text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_internal_permission('staff.manage') THEN
    RAISE EXCEPTION 'staff_permission_management_not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT override.staff_user_id, override.permission, override.effect
  FROM public.internal_staff_permission_overrides AS override
  ORDER BY override.staff_user_id, override.permission;
END;
$$;

-- Invite codes are credentials.  The console receives a code once, while
-- subsequent monitoring/revocation uses a non-secret management id.
ALTER TABLE public.invite_tokens
  ADD COLUMN IF NOT EXISTS management_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE public.invite_tokens SET management_id = gen_random_uuid() WHERE management_id IS NULL;
ALTER TABLE public.invite_tokens ALTER COLUMN management_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invite_tokens_management_id_idx ON public.invite_tokens(management_id);
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.invite_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.invite_tokens TO service_role;

CREATE OR REPLACE FUNCTION private.can_manage_invite_tokens(p_municipio text, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_role text; v_municipio text;
BEGIN
  IF private.has_internal_permission('token.manage', p_user_id) OR private.has_internal_permission('commercial.write', p_user_id) THEN RETURN true; END IF;
  SELECT role, municipio INTO v_role, v_municipio FROM public.users WHERE uid = p_user_id AND "isApproved" = true;
  RETURN v_role = 'master_admin' OR (v_role = 'admin' AND nullif(btrim(v_municipio), '') = nullif(btrim(p_municipio), ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_console_invite_token(
  p_role text,
  p_municipio text,
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
  v_code text;
  v_management_id uuid := gen_random_uuid();
  v_actor_name text;
  v_expires_at timestamptz;
  v_hash text;
  v_previous jsonb;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR p_operation_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_role NOT IN ('agent', 'supervisor', 'admin') THEN RAISE EXCEPTION 'invalid_invite_role' USING ERRCODE = '22023'; END IF;
  IF char_length(btrim(coalesce(p_municipio, ''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'municipio_required' USING ERRCODE = '22023'; END IF;
  IF p_expires_in_minutes NOT BETWEEN 15 AND 10080 THEN RAISE EXCEPTION 'invalid_expiration' USING ERRCODE = '22023'; END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023'; END IF;
  IF NOT private.can_manage_invite_tokens(p_municipio, v_actor) THEN RAISE EXCEPTION 'token_management_not_allowed' USING ERRCODE = '42501'; END IF;
  IF private.has_internal_permission('token.manage', v_actor) AND NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;

  v_hash := md5(concat_ws('|', p_role, btrim(p_municipio), p_expires_in_minutes, btrim(p_reason)));
  SELECT result INTO v_previous FROM public.internal_operations WHERE actor_id = v_actor AND operation_id = p_operation_id AND request_hash = v_hash;
  IF v_previous IS NOT NULL THEN RETURN v_previous || jsonb_build_object('token_reveal_available', false); END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, v_actor, 'token.create', v_hash);

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  v_expires_at := now() + make_interval(mins => p_expires_in_minutes);
  SELECT name INTO v_actor_name FROM public.users WHERE uid = v_actor;
  INSERT INTO public.invite_tokens(management_id, codigo, role, municipio, "criadoPor", "criadoPorNome", usado, "expiraEm", "criadoEm")
  VALUES (v_management_id, v_code, p_role, btrim(p_municipio), v_actor, coalesce(v_actor_name, 'Console TCS'), false, v_expires_at, now());

  v_result := jsonb_build_object('ok', true, 'management_id', v_management_id, 'role', p_role, 'municipio', btrim(p_municipio), 'expires_at', v_expires_at);
  UPDATE public.internal_operations SET status = 'succeeded', result = v_result, completed_at = now()
  WHERE actor_id = v_actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (v_actor, private.current_internal_role(v_actor), 'token.create', 'invite_token', v_management_id::text, 'allowed', left(btrim(p_reason), 500), jsonb_build_object('role', p_role, 'municipio', btrim(p_municipio), 'expires_at', v_expires_at));
  RETURN v_result || jsonb_build_object('token', v_code, 'token_reveal_available', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_console_invite_tokens(p_municipio text DEFAULT NULL)
RETURNS TABLE(management_id uuid, role text, municipio text, created_at timestamptz, expires_at timestamptz, used boolean, revoked_at timestamptz, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_scope text := nullif(btrim(p_municipio), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.can_manage_invite_tokens(coalesce(v_scope, (SELECT municipio FROM public.users WHERE uid = auth.uid())), auth.uid()) THEN RAISE EXCEPTION 'token_management_not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT token.management_id, token.role, token.municipio, token."criadoEm", token."expiraEm", coalesce(token.usado, false), token.revoked_at,
    CASE WHEN token.revoked_at IS NOT NULL THEN 'revoked' WHEN coalesce(token.usado, false) THEN 'used' WHEN token."expiraEm" <= now() THEN 'expired' ELSE 'active' END
  FROM public.invite_tokens token
  WHERE (v_scope IS NULL OR token.municipio = v_scope)
    AND private.can_manage_invite_tokens(token.municipio, auth.uid())
  ORDER BY token."criadoEm" DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_console_invite_token(p_management_id uuid, p_reason text, p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor uuid := auth.uid(); v_token public.invite_tokens; v_hash text; v_previous jsonb;
BEGIN
  IF v_actor IS NULL OR p_management_id IS NULL OR p_operation_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_token FROM public.invite_tokens WHERE management_id = p_management_id FOR UPDATE;
  IF v_token.management_id IS NULL THEN RAISE EXCEPTION 'invite_token_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT private.can_manage_invite_tokens(v_token.municipio, v_actor) THEN RAISE EXCEPTION 'token_management_not_allowed' USING ERRCODE = '42501'; END IF;
  IF private.has_internal_permission('token.manage', v_actor) AND NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  v_hash := md5(concat_ws('|', p_management_id, btrim(p_reason)));
  SELECT result INTO v_previous FROM public.internal_operations WHERE actor_id = v_actor AND operation_id = p_operation_id AND request_hash = v_hash;
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash) VALUES (p_operation_id, v_actor, 'token.revoke', v_hash);
  UPDATE public.invite_tokens SET revoked_at = now(), revoked_by = v_actor WHERE management_id = p_management_id AND revoked_at IS NULL;
  v_previous := jsonb_build_object('ok', true, 'management_id', p_management_id, 'revoked', true);
  UPDATE public.internal_operations SET status = 'succeeded', result = v_previous, completed_at = now() WHERE actor_id = v_actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (v_actor, private.current_internal_role(v_actor), 'token.revoke', 'invite_token', p_management_id::text, 'allowed', left(btrim(p_reason), 500), jsonb_build_object('municipio', v_token.municipio));
  RETURN v_previous;
END;
$$;

REVOKE ALL ON FUNCTION private.is_valid_internal_permission(text), private.internal_effective_permissions(uuid), private.can_manage_invite_tokens(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_valid_internal_permission(text), private.internal_effective_permissions(uuid), private.can_manage_invite_tokens(text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.manage_internal_staff_permissions(uuid, text[], text[], text, uuid), public.list_internal_staff_permission_overrides(), public.create_console_invite_token(text, text, integer, text, uuid), public.list_console_invite_tokens(text), public.revoke_console_invite_token(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_internal_staff_permissions(uuid, text[], text[], text, uuid), public.list_internal_staff_permission_overrides(), public.create_console_invite_token(text, text, integer, text, uuid), public.list_console_invite_tokens(text), public.revoke_console_invite_token(uuid, text, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
