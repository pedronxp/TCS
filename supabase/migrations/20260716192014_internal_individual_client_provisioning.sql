-- Individual customer provisioning is intentionally separate from the legacy
-- invite_tokens and organization_invites tables. Authentication invitation
-- secrets are owned and expired by Supabase Auth; this table stores only the
-- auditable business state of the provisioning operation.

CREATE TABLE public.individual_client_provisioning (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('email_invite', 'initial_password')),
  status text NOT NULL CHECK (status IN ('invited', 'active', 'failed')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX individual_client_provisioning_status_created_idx
  ON public.individual_client_provisioning(status, created_at DESC);

ALTER TABLE public.individual_client_provisioning ENABLE ROW LEVEL SECURITY;

CREATE POLICY individual_client_provisioning_internal_read
ON public.individual_client_provisioning
FOR SELECT TO authenticated
USING (private.has_internal_permission('customer.read'));

GRANT SELECT ON public.individual_client_provisioning TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_internal_individual_provisioning(
  p_user_id uuid,
  p_email text,
  p_name text,
  p_mode text,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  normalized_email text := lower(trim(p_email));
  normalized_name text := trim(p_name);
  auth_email text;
  generated_username text;
  operation_hash text;
  previous_result jsonb;
  v_result jsonb;
BEGIN
  IF NOT private.has_internal_permission('customer.write', actor) THEN
    RAISE EXCEPTION 'customer_write_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN
    RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501';
  END IF;
  IF p_mode NOT IN ('email_invite', 'initial_password') THEN
    RAISE EXCEPTION 'invalid_provisioning_mode';
  END IF;
  IF normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR char_length(normalized_email) > 320 THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  IF char_length(normalized_name) NOT BETWEEN 2 AND 150 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  IF char_length(trim(p_reason)) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT lower(u.email) INTO auth_email
  FROM auth.users u
  WHERE u.id = p_user_id;
  IF auth_email IS NULL OR auth_email <> normalized_email THEN
    RAISE EXCEPTION 'auth_user_mismatch' USING ERRCODE = '42501';
  END IF;

  operation_hash := md5(concat_ws('|', p_user_id, normalized_email, normalized_name, p_mode, trim(p_reason)));
  SELECT io.result INTO previous_result
  FROM public.internal_operations io
  WHERE io.actor_id = actor
    AND io.operation_id = p_operation_id
    AND io.request_hash = operation_hash;
  IF previous_result IS NOT NULL THEN RETURN previous_result; END IF;

  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, actor, 'customer.individual.provision', operation_hash);

  generated_username := left(
    COALESCE(NULLIF(regexp_replace(split_part(normalized_email, '@', 1), '[^a-z0-9_.-]', '', 'g'), ''), 'cliente'),
    40
  ) || '-' || left(replace(p_user_id::text, '-', ''), 8);

  INSERT INTO public.users(
    uid, email, name, role, municipio, "isApproved", username, "nameChanged", organization_id
  ) VALUES (
    p_user_id, normalized_email, normalized_name, 'agent', NULL, true,
    generated_username, false, NULL
  )
  ON CONFLICT (uid) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = 'agent',
    "isApproved" = true,
    organization_id = NULL;

  INSERT INTO public.individual_client_provisioning(
    user_id, email, mode, status, created_by
  ) VALUES (
    p_user_id, normalized_email, p_mode,
    CASE WHEN p_mode = 'email_invite' THEN 'invited' ELSE 'active' END,
    actor
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    mode = EXCLUDED.mode,
    status = EXCLUDED.status,
    updated_at = now();

  v_result := jsonb_build_object(
    'ok', true,
    'customer_id', 'user:' || p_user_id::text,
    'user_id', p_user_id,
    'mode', p_mode,
    'status', CASE WHEN p_mode = 'email_invite' THEN 'invited' ELSE 'active' END
  );

  UPDATE public.internal_operations
  SET status = 'succeeded', result = v_result, completed_at = now()
  WHERE actor_id = actor AND operation_id = p_operation_id;

  INSERT INTO public.internal_access_events(
    actor_id, actor_role, action, target_type, target_id, result, reason, metadata
  ) VALUES (
    actor, private.current_internal_role(actor), 'customer.individual.provision',
    'user', p_user_id::text, 'allowed', left(trim(p_reason), 500),
    jsonb_build_object('mode', p_mode, 'email', normalized_email)
  );

  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    NULL, actor, 'individual_client_provisioned', 'user', p_user_id::text,
    jsonb_build_object('mode', p_mode, 'reason', left(trim(p_reason), 500))
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_internal_individual_provisioning(uuid, text, text, text, text, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_internal_individual_provisioning(uuid, text, text, text, text, uuid)
TO authenticated;

NOTIFY pgrst, 'reload schema';
