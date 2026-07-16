-- Internal customer detail and audited organization management.

CREATE OR REPLACE FUNCTION public.get_internal_customer_detail(p_customer_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  customer_kind text;
  subject_id uuid;
  can_sensitive boolean;
  result jsonb;
BEGIN
  IF NOT private.has_internal_permission('customer.read') THEN
    RAISE EXCEPTION 'customer_read_not_allowed' USING ERRCODE = '42501';
  END IF;

  customer_kind := split_part(p_customer_id, ':', 1);
  BEGIN
    subject_id := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END;
  IF customer_kind NOT IN ('organization', 'user') OR subject_id IS NULL THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END IF;
  can_sensitive := private.can_access_sensitive_customer(p_customer_id);

  IF customer_kind = 'organization' THEN
    SELECT jsonb_build_object(
      'customer', jsonb_build_object(
        'customer_id', p_customer_id,
        'kind', 'organization',
        'subject_id', o.id,
        'display_name', o.display_name,
        'legal_name', o.legal_name,
        'municipality_name', o.municipality_name,
        'state_code', o.state_code,
        'status', o.status,
        'contact_name', CASE WHEN private.current_internal_role() = 'owner' THEN o.contact_name END,
        'contact_email', CASE WHEN private.current_internal_role() = 'owner' THEN o.contact_email END,
        'contract_reference', CASE WHEN private.current_internal_role() = 'owner' THEN o.contract_reference END,
        'session_policy', o.session_policy,
        'session_timeout_minutes', o.session_timeout_minutes,
        'offline_tolerance_minutes', o.offline_tolerance_minutes,
        'created_at', o.created_at,
        'updated_at', o.updated_at
      ),
      'subscription', (
        SELECT jsonb_build_object(
          'id', s.id, 'status', s.status, 'plan_id', s.plan_id, 'plan_name', p.name,
          'starts_at', s.starts_at, 'trial_ends_at', s.trial_ends_at,
          'current_period_start', s.current_period_start, 'current_period_end', s.current_period_end,
          'grace_ends_at', s.grace_ends_at, 'canceled_at', s.canceled_at,
          'overrides', s.overrides
        )
        FROM public.subscriptions s
        JOIN public.plans p ON p.id = s.plan_id
        WHERE s.organization_id = o.id
        ORDER BY s.created_at DESC LIMIT 1
      ),
      'usage', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'resource_code', c.resource_code, 'consumed', c.consumed,
          'period_start', c.period_start, 'period_end', c.period_end,
          'hard_limit', l.hard_limit, 'warning_percent', l.warning_percent
        ) ORDER BY c.resource_code)
        FROM public.usage_counters c
        LEFT JOIN LATERAL (
          SELECT pl.hard_limit, pl.warning_percent
          FROM public.subscriptions s2
          JOIN public.plan_limits pl ON pl.plan_id = s2.plan_id AND pl.resource_code = c.resource_code
          WHERE s2.organization_id = o.id
          ORDER BY s2.created_at DESC LIMIT 1
        ) l ON true
        WHERE c.organization_id = o.id
      ), '[]'::jsonb),
      'users', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', m.id, 'user_id', m.user_id, 'name', u.name,
          'email', CASE WHEN can_sensitive THEN u.email END,
          'role', m.role, 'status', m.status, 'joined_at', m.joined_at,
          'last_login', u."lastLogin"
        ) ORDER BY u.name NULLS LAST)
        FROM public.organization_members m
        LEFT JOIN public.users u ON u.uid = m.user_id
        WHERE m.organization_id = o.id
      ), '[]'::jsonb),
      'sessions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id, 'user_id', s.user_id, 'device_name', s.device_name,
          'platform', s.platform, 'status', s.status,
          'last_heartbeat_at', s.last_heartbeat_at, 'started_at', s.started_at,
          'ended_at', s.ended_at, 'end_reason', s.end_reason
        ) ORDER BY s.last_heartbeat_at DESC)
        FROM public.active_sessions s WHERE s.organization_id = o.id
      ), '[]'::jsonb),
      'inspections', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco",
          'status', v.status, 'occurred_at', v."dataVistoria",
          'agent_name', v."agenteNome",
          'address', CASE WHEN can_sensitive THEN COALESCE(v.endereco, concat_ws(' ', v."enderecoRua", v."enderecoNumero")) END
        ) ORDER BY v."dataVistoria" DESC)
        FROM (
          SELECT * FROM public.vistorias
          WHERE organization_id = o.id
          ORDER BY "dataVistoria" DESC LIMIT 50
        ) v
      ), '[]'::jsonb),
      'tickets', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', t.id, 'public_code', t.public_code, 'subject', t.subject,
          'priority', t.priority, 'status', t.status, 'assigned_to', t.assigned_to,
          'response_due_at', t.response_due_at, 'resolution_due_at', t.resolution_due_at,
          'escalate_at', t.escalate_at, 'created_at', t.created_at
        ) ORDER BY t.created_at DESC)
        FROM public.support_tickets t WHERE t.organization_id = o.id
      ), '[]'::jsonb),
      'onboarding', (
        SELECT to_jsonb(ob) FROM public.organization_onboarding ob WHERE ob.organization_id = o.id
      ),
      'audit', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', a.id, 'event_type', a.event_type, 'entity_type', a.entity_type,
          'entity_id', a.entity_id, 'metadata', private.sanitize_internal_metadata(a.metadata),
          'created_at', a.created_at
        ) ORDER BY a.created_at DESC)
        FROM (
          SELECT * FROM public.subscription_audit_events
          WHERE organization_id = o.id
          ORDER BY created_at DESC LIMIT 100
        ) a
      ), '[]'::jsonb),
      'can_view_sensitive', can_sensitive
    ) INTO result
    FROM public.organizations o
    WHERE o.id = subject_id;
  ELSE
    SELECT jsonb_build_object(
      'customer', jsonb_build_object(
        'customer_id', p_customer_id, 'kind', 'individual', 'subject_id', u.uid,
        'display_name', COALESCE(NULLIF(trim(u.name), ''), 'Conta individual'),
        'municipality_name', u.municipio,
        'status', CASE WHEN u."isApproved" THEN 'active' ELSE 'onboarding' END,
        'contact_email', CASE WHEN private.current_internal_role() = 'owner' THEN u.email END,
        'created_at', u."createdAt", 'updated_at', u."lastLogin"
      ),
      'subscription', (
        SELECT jsonb_build_object(
          'id', s.id, 'status', s.status, 'plan_id', s.plan_id, 'plan_name', p.name,
          'starts_at', s.starts_at, 'trial_ends_at', s.trial_ends_at,
          'current_period_start', s.current_period_start, 'current_period_end', s.current_period_end,
          'grace_ends_at', s.grace_ends_at, 'canceled_at', s.canceled_at,
          'overrides', s.overrides
        )
        FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
        WHERE s.user_id = u.uid ORDER BY s.created_at DESC LIMIT 1
      ),
      'usage', COALESCE((
        SELECT jsonb_agg(to_jsonb(c) - 'user_id' - 'organization_id' ORDER BY c.resource_code)
        FROM public.usage_counters c WHERE c.user_id = u.uid
      ), '[]'::jsonb),
      'users', jsonb_build_array(jsonb_build_object(
        'user_id', u.uid, 'name', u.name,
        'email', CASE WHEN can_sensitive THEN u.email END,
        'role', u.role, 'status', CASE WHEN u."isApproved" THEN 'active' ELSE 'onboarding' END,
        'last_login', u."lastLogin"
      )),
      'sessions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id, 'user_id', s.user_id, 'device_name', s.device_name,
          'platform', s.platform, 'status', s.status,
          'last_heartbeat_at', s.last_heartbeat_at, 'started_at', s.started_at,
          'ended_at', s.ended_at, 'end_reason', s.end_reason
        ) ORDER BY s.last_heartbeat_at DESC)
        FROM public.active_sessions s WHERE s.user_id = u.uid
      ), '[]'::jsonb),
      'inspections', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco",
          'status', v.status, 'occurred_at', v."dataVistoria",
          'address', CASE WHEN can_sensitive THEN COALESCE(v.endereco, concat_ws(' ', v."enderecoRua", v."enderecoNumero")) END
        ) ORDER BY v."dataVistoria" DESC)
        FROM (SELECT * FROM public.vistorias WHERE "agenteUid" = u.uid::text ORDER BY "dataVistoria" DESC LIMIT 50) v
      ), '[]'::jsonb),
      'tickets', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', t.id, 'public_code', t.public_code, 'subject', t.subject,
          'priority', t.priority, 'status', t.status, 'assigned_to', t.assigned_to,
          'response_due_at', t.response_due_at, 'resolution_due_at', t.resolution_due_at,
          'escalate_at', t.escalate_at, 'created_at', t.created_at
        ) ORDER BY t.created_at DESC)
        FROM public.support_tickets t WHERE t.user_id = u.uid
      ), '[]'::jsonb),
      'onboarding', NULL,
      'audit', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', a.id, 'event_type', a.event_type, 'entity_type', a.entity_type,
          'entity_id', a.entity_id, 'metadata', private.sanitize_internal_metadata(a.metadata),
          'created_at', a.created_at
        ) ORDER BY a.created_at DESC)
        FROM (SELECT * FROM public.subscription_audit_events WHERE entity_id = u.uid::text ORDER BY created_at DESC LIMIT 100) a
      ), '[]'::jsonb),
      'can_view_sensitive', can_sensitive
    ) INTO result
    FROM public.users u WHERE u.uid = subject_id AND u.organization_id IS NULL;
  END IF;

  IF result IS NULL THEN RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.mutate_internal_organization(uuid, text, jsonb, text, uuid);

CREATE OR REPLACE FUNCTION public.mutate_internal_organization(
  p_organization_id text,
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
  target public.organizations;
  previous public.organizations;
  operation_hash text;
  previous_result jsonb;
  v_result jsonb;
  onboarding jsonb := COALESCE(p_payload->'onboarding', '{}'::jsonb);
  v_organization_id uuid;
BEGIN
  IF NOT private.has_internal_permission('customer.write', actor) THEN
    RAISE EXCEPTION 'customer_write_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  IF p_action NOT IN ('create', 'update') THEN RAISE EXCEPTION 'invalid_customer_action'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'invalid_customer_payload'; END IF;
  IF char_length(trim(p_reason)) < 8 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF p_action = 'update' THEN
    BEGIN v_organization_id := p_organization_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_organization_id'; END;
  END IF;

  operation_hash := md5(concat_ws('|', p_organization_id, p_action, p_payload::text, trim(p_reason)));
  SELECT io.result INTO previous_result
  FROM public.internal_operations io
  WHERE io.actor_id = actor AND io.operation_id = p_operation_id AND io.request_hash = operation_hash;
  IF previous_result IS NOT NULL THEN RETURN previous_result; END IF;

  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, actor, 'customer.' || p_action, operation_hash);

  IF p_action = 'create' THEN
    IF COALESCE(p_organization_id, '') <> '' THEN RAISE EXCEPTION 'organization_id_must_be_empty'; END IF;
    IF char_length(trim(COALESCE(p_payload->>'display_name', ''))) < 3 THEN RAISE EXCEPTION 'display_name_required'; END IF;
    IF COALESCE(p_payload->>'slug', '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'invalid_slug'; END IF;
    INSERT INTO public.organizations(
      slug, display_name, legal_name, municipality_name, state_code, status,
      contact_name, contact_email, contract_reference, session_policy,
      session_timeout_minutes, offline_tolerance_minutes
    ) VALUES (
      p_payload->>'slug', trim(p_payload->>'display_name'), nullif(trim(p_payload->>'legal_name'), ''),
      nullif(trim(p_payload->>'municipality_name'), ''), nullif(upper(trim(p_payload->>'state_code')), ''),
      COALESCE(nullif(p_payload->>'status', ''), 'onboarding'), nullif(trim(p_payload->>'contact_name'), ''),
      nullif(trim(p_payload->>'contact_email'), ''), nullif(trim(p_payload->>'contract_reference'), ''),
      COALESCE(nullif(p_payload->>'session_policy', ''), 'block'),
      COALESCE((p_payload->>'session_timeout_minutes')::integer, 480),
      COALESCE((p_payload->>'offline_tolerance_minutes')::integer, 1440)
    ) RETURNING * INTO target;
  ELSE
    SELECT * INTO previous FROM public.organizations WHERE id = v_organization_id FOR UPDATE;
    IF previous.id IS NULL THEN RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002'; END IF;
    UPDATE public.organizations SET
      display_name = CASE WHEN p_payload ? 'display_name' THEN trim(p_payload->>'display_name') ELSE display_name END,
      legal_name = CASE WHEN p_payload ? 'legal_name' THEN nullif(trim(p_payload->>'legal_name'), '') ELSE legal_name END,
      municipality_name = CASE WHEN p_payload ? 'municipality_name' THEN nullif(trim(p_payload->>'municipality_name'), '') ELSE municipality_name END,
      state_code = CASE WHEN p_payload ? 'state_code' THEN nullif(upper(trim(p_payload->>'state_code')), '') ELSE state_code END,
      status = CASE WHEN p_payload ? 'status' THEN p_payload->>'status' ELSE status END,
      contact_name = CASE WHEN p_payload ? 'contact_name' THEN nullif(trim(p_payload->>'contact_name'), '') ELSE contact_name END,
      contact_email = CASE WHEN p_payload ? 'contact_email' THEN nullif(trim(p_payload->>'contact_email'), '') ELSE contact_email END,
      contract_reference = CASE WHEN p_payload ? 'contract_reference' THEN nullif(trim(p_payload->>'contract_reference'), '') ELSE contract_reference END,
      session_policy = CASE WHEN p_payload ? 'session_policy' THEN p_payload->>'session_policy' ELSE session_policy END,
      session_timeout_minutes = CASE WHEN p_payload ? 'session_timeout_minutes' THEN (p_payload->>'session_timeout_minutes')::integer ELSE session_timeout_minutes END,
      offline_tolerance_minutes = CASE WHEN p_payload ? 'offline_tolerance_minutes' THEN (p_payload->>'offline_tolerance_minutes')::integer ELSE offline_tolerance_minutes END,
      updated_at = now()
    WHERE id = v_organization_id RETURNING * INTO target;
  END IF;

  INSERT INTO public.organization_onboarding(
    organization_id, pilot_started_at, coordinator_trained_at, checklist,
    review_due_at, review_completed_at, updated_at
  ) VALUES (
    target.id, nullif(onboarding->>'pilot_started_at', '')::timestamptz,
    nullif(onboarding->>'coordinator_trained_at', '')::timestamptz,
    COALESCE(onboarding->'checklist', '{}'::jsonb), nullif(onboarding->>'review_due_at', '')::timestamptz,
    nullif(onboarding->>'review_completed_at', '')::timestamptz, now()
  ) ON CONFLICT (organization_id) DO UPDATE SET
    pilot_started_at = CASE WHEN onboarding ? 'pilot_started_at' THEN EXCLUDED.pilot_started_at ELSE public.organization_onboarding.pilot_started_at END,
    coordinator_trained_at = CASE WHEN onboarding ? 'coordinator_trained_at' THEN EXCLUDED.coordinator_trained_at ELSE public.organization_onboarding.coordinator_trained_at END,
    checklist = CASE WHEN onboarding ? 'checklist' THEN EXCLUDED.checklist ELSE public.organization_onboarding.checklist END,
    review_due_at = CASE WHEN onboarding ? 'review_due_at' THEN EXCLUDED.review_due_at ELSE public.organization_onboarding.review_due_at END,
    review_completed_at = CASE WHEN onboarding ? 'review_completed_at' THEN EXCLUDED.review_completed_at ELSE public.organization_onboarding.review_completed_at END,
    updated_at = now();

  v_result := jsonb_build_object('ok', true, 'customer_id', 'organization:' || target.id::text, 'organization_id', target.id);
  UPDATE public.internal_operations SET status = 'succeeded', result = v_result, completed_at = now()
  WHERE actor_id = actor AND operation_id = p_operation_id;

  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (
    actor, private.current_internal_role(actor), 'customer.' || p_action, 'organization', target.id::text,
    'allowed', left(trim(p_reason), 500), private.sanitize_internal_metadata(jsonb_build_object(
      'before', CASE WHEN previous.id IS NULL THEN NULL ELSE jsonb_build_object('status', previous.status, 'display_name', previous.display_name) END,
      'after', jsonb_build_object('status', target.status, 'display_name', target.display_name)
    ))
  );
  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (target.id, actor, 'customer_' || p_action, 'organization', target.id::text,
    private.sanitize_internal_metadata(jsonb_build_object('reason', left(trim(p_reason), 500))));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_internal_customer_detail(text),
  public.mutate_internal_organization(text, text, jsonb, text, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_customer_detail(text),
  public.mutate_internal_organization(text, text, jsonb, text, uuid)
TO authenticated;

NOTIFY pgrst, 'reload schema';
