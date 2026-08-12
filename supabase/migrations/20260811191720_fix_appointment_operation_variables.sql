-- The appointment RPC was introduced after the generic idempotency-variable
-- hardening. Its local names matched internal_operations columns, making the
-- request-hash lookup ambiguous at runtime.

CREATE OR REPLACE FUNCTION public.create_internal_customer_appointment(
  p_customer_id text,
  p_title text,
  p_scheduled_at timestamptz,
  p_address text DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_operation_id uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  kind text := split_part(p_customer_id, ':', 1);
  target_id uuid;
  target_org_id uuid;
  target_municipality text;
  assigned_agent_id uuid;
  assigned_agent_name text;
  actor_name text;
  actor_public_id uuid;
  appointment public.agendamentos;
  v_request_hash text;
  previous_result jsonb;
  v_result jsonb;
BEGIN
  IF NOT private.has_internal_permission('customer.write', actor) THEN
    RAISE EXCEPTION 'customer_write_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF kind NOT IN ('organization', 'user') THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END IF;
  BEGIN
    target_id := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END;
  IF char_length(trim(coalesce(p_title, ''))) < 3 OR char_length(trim(p_title)) > 160 THEN
    RAISE EXCEPTION 'invalid_appointment_title';
  END IF;
  IF p_scheduled_at IS NULL OR p_scheduled_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'invalid_appointment_date';
  END IF;
  IF char_length(coalesce(p_address, '')) > 500 OR char_length(coalesce(p_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'appointment_content_too_long';
  END IF;

  IF kind = 'organization' THEN
    SELECT o.id, nullif(trim(o.municipality_name), '')
      INTO target_org_id, target_municipality
    FROM public.organizations o
    WHERE o.id = target_id AND o.status <> 'archived';

    IF target_org_id IS NULL THEN
      RAISE EXCEPTION 'customer_not_found';
    END IF;

    assigned_agent_id := p_agent_id;
    IF assigned_agent_id IS NOT NULL THEN
      SELECT u.name INTO assigned_agent_name
      FROM public.users u
      WHERE u.uid = assigned_agent_id
        AND u.organization_id = target_org_id
        AND u.role = 'agent'
        AND coalesce(u."isApproved", false);
      IF assigned_agent_name IS NULL THEN
        RAISE EXCEPTION 'agent_not_in_customer_scope' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSE
    SELECT u.organization_id, nullif(trim(u.municipio), ''), u.uid, u.name
      INTO target_org_id, target_municipality, assigned_agent_id, assigned_agent_name
    FROM public.users u
    WHERE u.uid = target_id AND coalesce(u."isApproved", false);

    IF assigned_agent_id IS NULL THEN
      RAISE EXCEPTION 'customer_not_found';
    END IF;
    IF p_agent_id IS NOT NULL AND p_agent_id <> assigned_agent_id THEN
      RAISE EXCEPTION 'agent_not_in_customer_scope' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF target_municipality IS NULL THEN
    RAISE EXCEPTION 'customer_municipality_required';
  END IF;

  SELECT s.display_name INTO actor_name
  FROM public.internal_staff s
  WHERE s.user_id = actor AND s.status = 'active';
  SELECT u.uid INTO actor_public_id FROM public.users u WHERE u.uid = actor;

  v_request_hash := md5(concat_ws(
    '|', p_customer_id, trim(p_title), p_scheduled_at,
    coalesce(trim(p_address), ''), coalesce(p_agent_id::text, ''),
    coalesce(trim(p_notes), '')
  ));
  SELECT io.result INTO previous_result
  FROM public.internal_operations io
  WHERE io.actor_id = actor
    AND io.operation_id = p_operation_id
    AND io.request_hash = v_request_hash;
  IF previous_result IS NOT NULL THEN
    RETURN previous_result;
  END IF;

  INSERT INTO public.internal_operations (
    operation_id, actor_id, action, request_hash
  ) VALUES (
    p_operation_id, actor, 'customer.appointment.create', v_request_hash
  );

  INSERT INTO public.agendamentos (
    titulo, endereco, municipio, data_agendada,
    criado_por_uid, criado_por_nome, agente_uid, agente_nome,
    observacoes, status, organization_id, origem
  ) VALUES (
    trim(p_title), nullif(trim(p_address), ''), target_municipality, p_scheduled_at,
    actor_public_id, coalesce(actor_name, 'TCS Console'), assigned_agent_id, assigned_agent_name,
    nullif(trim(p_notes), ''), 'pendente', target_org_id, 'web'
  )
  RETURNING * INTO appointment;

  v_result := jsonb_build_object(
    'id', appointment.id,
    'title', appointment.titulo,
    'status', appointment.status,
    'scheduled_at', appointment.data_agendada,
    'agent_name', appointment.agente_nome,
    'address', appointment.endereco,
    'origin', appointment.origem
  );

  UPDATE public.internal_operations AS io
  SET status = 'succeeded', result = v_result, completed_at = now()
  WHERE io.actor_id = actor AND io.operation_id = p_operation_id;

  INSERT INTO public.internal_access_events (
    actor_id, actor_role, action, target_type, target_id, result, metadata
  ) VALUES (
    actor, private.current_internal_role(actor), 'customer.appointment.create',
    'appointment', appointment.id::text, 'allowed',
    jsonb_build_object('customer_id', p_customer_id, 'origin', 'web')
  );

  RETURN v_result;
END;
$$;
