-- Audited mutation RPC for individual customers (public.users without organization).
-- Mirrors the structure of mutate_internal_organization but targets the users table.

CREATE OR REPLACE FUNCTION public.mutate_internal_individual(
  p_customer_id text,
  p_action text,
  p_payload jsonb,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  subject_id uuid;
  v_user public.users;
  previous_name text;
  previous_email text;
  previous_approved boolean;
  operation_hash text;
  previous_result jsonb;
  v_result jsonb;
  v_display_name text;
  v_contact_email text;
  v_status text;
  v_new_approved boolean;
BEGIN
  IF NOT private.has_internal_permission('customer.write', actor) THEN
    RAISE EXCEPTION 'customer_write_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN
    RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('update') THEN
    RAISE EXCEPTION 'invalid_customer_action';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_customer_payload';
  END IF;
  IF char_length(trim(p_reason)) < 8 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  -- Parse customer_id: must be "user:<uuid>"
  IF split_part(p_customer_id, ':', 1) <> 'user' THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END IF;
  BEGIN
    subject_id := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END;
  IF subject_id IS NULL THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END IF;

  -- Idempotency: return cached result for duplicate operation
  operation_hash := md5(concat_ws('|', p_customer_id, p_action, p_payload::text, trim(p_reason)));
  SELECT io.result INTO previous_result
  FROM public.internal_operations io
  WHERE io.actor_id = actor AND io.operation_id = p_operation_id AND io.request_hash = operation_hash;
  IF previous_result IS NOT NULL THEN RETURN previous_result; END IF;

  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, actor, 'customer.update', operation_hash);

  -- Lock and fetch current record
  SELECT * INTO v_user
  FROM public.users
  WHERE uid = subject_id AND organization_id IS NULL
  FOR UPDATE;

  IF v_user.uid IS NULL THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  previous_name := v_user.name;
  previous_email := v_user.email;
  previous_approved := v_user."isApproved";

  -- Apply display_name update
  IF p_payload ? 'display_name' THEN
    v_display_name := trim(p_payload->>'display_name');
    IF char_length(v_display_name) < 2 THEN
      RAISE EXCEPTION 'display_name_too_short';
    END IF;
  ELSE
    v_display_name := v_user.name;
  END IF;

  -- Apply status update (map to isApproved)
  IF p_payload ? 'status' THEN
    v_status := p_payload->>'status';
    IF v_status NOT IN ('onboarding', 'active', 'suspended', 'archived') THEN
      RAISE EXCEPTION 'invalid_status';
    END IF;
    v_new_approved := v_status = 'active';
  ELSE
    v_new_approved := v_user."isApproved";
  END IF;

  -- Apply contact_email update (requires customer.sensitive.read permission)
  IF p_payload ? 'contact_email' THEN
    IF NOT private.has_internal_permission('customer.sensitive.read', actor) THEN
      RAISE EXCEPTION 'sensitive_write_not_allowed' USING ERRCODE = '42501';
    END IF;
    v_contact_email := nullif(trim(p_payload->>'contact_email'), '');
    IF v_contact_email IS NOT NULL AND v_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'invalid_email';
    END IF;
  ELSE
    v_contact_email := NULL; -- no change
  END IF;

  -- Update public.users
  UPDATE public.users SET
    name = v_display_name,
    "isApproved" = v_new_approved,
    email = CASE WHEN p_payload ? 'contact_email' AND v_contact_email IS NOT NULL
                 THEN v_contact_email ELSE email END
  WHERE uid = subject_id;

  -- Update auth.users email if contact_email provided
  IF p_payload ? 'contact_email' AND v_contact_email IS NOT NULL AND v_contact_email <> v_user.email THEN
    UPDATE auth.users SET
      email = v_contact_email,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = subject_id;
  END IF;

  v_result := jsonb_build_object(
    'ok', true,
    'customer_id', p_customer_id
  );

  UPDATE public.internal_operations
  SET status = 'succeeded', result = v_result, completed_at = now()
  WHERE actor_id = actor AND operation_id = p_operation_id;

  INSERT INTO public.internal_access_events(
    actor_id, actor_role, action, target_type, target_id, result, reason, metadata
  ) VALUES (
    actor, private.current_internal_role(actor), 'customer.update',
    'user', subject_id::text, 'allowed', left(trim(p_reason), 500),
    private.sanitize_internal_metadata(jsonb_build_object(
      'before', jsonb_build_object('name', previous_name, 'is_approved', previous_approved),
      'after', jsonb_build_object('name', v_display_name, 'is_approved', v_new_approved)
    ))
  );

  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    NULL, actor, 'customer_update', 'user', subject_id::text,
    private.sanitize_internal_metadata(jsonb_build_object(
      'reason', left(trim(p_reason), 500),
      'customer_id', p_customer_id
    ))
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mutate_internal_individual(text, text, jsonb, text, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mutate_internal_individual(text, text, jsonb, text, uuid)
TO authenticated;

NOTIFY pgrst, 'reload schema';
