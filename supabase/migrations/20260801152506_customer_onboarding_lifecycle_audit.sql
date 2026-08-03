-- Persisted onboarding lifecycle, resumable checklist and authoritative audit.
-- Customer clients only call narrow RPCs; private state and audit rows are not
-- directly writable through the Data API.

ALTER TABLE private.customer_bootstrap_states
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'unknown';

ALTER TABLE private.customer_bootstrap_states
  DROP CONSTRAINT IF EXISTS customer_bootstrap_states_checklist_object;
ALTER TABLE private.customer_bootstrap_states
  ADD CONSTRAINT customer_bootstrap_states_checklist_object
  CHECK (jsonb_typeof(checklist) = 'object');

ALTER TABLE private.customer_bootstrap_states
  DROP CONSTRAINT IF EXISTS customer_bootstrap_states_source_allowed;
ALTER TABLE private.customer_bootstrap_states
  ADD CONSTRAINT customer_bootstrap_states_source_allowed
  CHECK (source IN ('web', 'android', 'ios', 'invite', 'unknown'));

UPDATE private.customer_bootstrap_states AS bootstrap
SET checklist = CASE bootstrap.account_kind
  WHEN 'individual' THEN jsonb_build_object(
    'identity', true,
    'organization', true,
    'plan', true,
    'team', true,
    'configuration', bootstrap.status = 'completed',
    'first_operation', EXISTS (
      SELECT 1
      FROM public.vistorias AS inspection
      WHERE inspection."agenteUid" = bootstrap.user_id::text
    )
  )
  ELSE coalesce((
    SELECT jsonb_set(
      onboarding.checklist,
      '{team}',
      to_jsonb(EXISTS (
        SELECT 1
        FROM public.organization_members AS member
        WHERE member.organization_id = bootstrap.organization_id
          AND member.user_id <> bootstrap.user_id
          AND member.status = 'active'
      )),
      true
    )
    FROM public.organization_onboarding AS onboarding
    WHERE onboarding.organization_id = bootstrap.organization_id
  ), jsonb_build_object(
    'identity', true,
    'organization', true,
    'plan', true,
    'team', false,
    'configuration', false,
    'first_operation', false
  ))
END
WHERE bootstrap.checklist = '{}'::jsonb;

CREATE OR REPLACE FUNCTION private.initialize_customer_bootstrap_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.checklist = '{}'::jsonb THEN
    NEW.checklist := CASE NEW.account_kind
      WHEN 'individual' THEN jsonb_build_object(
        'identity', true,
        'organization', true,
        'plan', true,
        'team', true,
        'configuration', false,
        'first_operation', false
      )
      ELSE jsonb_build_object(
        'identity', true,
        'organization', true,
        'plan', true,
        'team', false,
        'configuration', false,
        'first_operation', false
      )
    END;
  END IF;
  IF NEW.account_kind = 'individual' AND NEW.status = 'completed' THEN
    NEW.status := 'in_progress';
    NEW.current_step := 'configuration';
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.initialize_customer_bootstrap_checklist()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS customer_bootstrap_initialize_checklist
  ON private.customer_bootstrap_states;
CREATE TRIGGER customer_bootstrap_initialize_checklist
  BEFORE INSERT ON private.customer_bootstrap_states
  FOR EACH ROW
  EXECUTE FUNCTION private.initialize_customer_bootstrap_checklist();

UPDATE private.customer_bootstrap_states
SET status = 'in_progress',
    current_step = CASE
      WHEN NOT coalesce((checklist->>'configuration')::boolean, false) THEN 'configuration'
      ELSE 'first_operation'
    END,
    completed_at = NULL,
    updated_at = now()
WHERE account_kind = 'individual'
  AND status = 'completed'
  AND EXISTS (SELECT 1 FROM jsonb_each(checklist) AS item WHERE item.value <> 'true'::jsonb);

ALTER TABLE public.subscription_audit_events
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'allowed',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'server',
  ADD COLUMN IF NOT EXISTS reason text;

ALTER TABLE public.subscription_audit_events
  DROP CONSTRAINT IF EXISTS subscription_audit_events_outcome_allowed;
ALTER TABLE public.subscription_audit_events
  ADD CONSTRAINT subscription_audit_events_outcome_allowed
  CHECK (outcome IN ('allowed', 'denied', 'failed'));

ALTER TABLE public.subscription_audit_events
  DROP CONSTRAINT IF EXISTS subscription_audit_events_source_length;
ALTER TABLE public.subscription_audit_events
  ADD CONSTRAINT subscription_audit_events_source_length
  CHECK (char_length(source) BETWEEN 1 AND 32);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_audit_request_event_key
  ON public.subscription_audit_events(request_id, event_type)
  WHERE request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.prevent_authoritative_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'authoritative_audit_is_append_only' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_authoritative_audit_mutation()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS subscription_audit_events_append_only
  ON public.subscription_audit_events;
CREATE TRIGGER subscription_audit_events_append_only
  BEFORE UPDATE OR DELETE ON public.subscription_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_authoritative_audit_mutation();

-- Preserve the mature entry-context implementation and add the persisted
-- onboarding projection without exposing the private bootstrap table.
ALTER FUNCTION public.get_customer_entry_context()
  RENAME TO get_customer_entry_context_base;
REVOKE ALL ON FUNCTION public.get_customer_entry_context_base()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_customer_entry_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_bootstrap private.customer_bootstrap_states;
  v_checklist jsonb := '{}'::jsonb;
  v_completed integer := 0;
  v_total integer := 0;
  v_lifecycle text := 'creating';
  v_organization_status text;
  v_subscription_status text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  v_context := public.get_customer_entry_context_base();
  SELECT * INTO v_bootstrap
  FROM private.customer_bootstrap_states
  WHERE user_id = v_user;

  IF v_bootstrap.id IS NULL THEN
    RETURN v_context || jsonb_build_object(
      'onboarding', NULL,
      'lifecycle_state', CASE
        WHEN v_context->>'entry_state' = 'account_choice_required' THEN 'creating'
        WHEN v_context->>'entry_state' LIKE 'membership_%' THEN 'blocked'
        ELSE 'active'
      END
    );
  END IF;

  v_organization_status := v_context#>>'{organization,status}';
  v_subscription_status := v_context#>>'{subscription,status}';
  IF v_bootstrap.account_kind = 'organization' THEN
    SELECT coalesce(onboarding.checklist, v_bootstrap.checklist)
    INTO v_checklist
    FROM public.organization_onboarding AS onboarding
    WHERE onboarding.organization_id = v_bootstrap.organization_id;
    v_checklist := coalesce(v_checklist, v_bootstrap.checklist);
  ELSE
    v_checklist := v_bootstrap.checklist;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE value = 'true'::jsonb)
  INTO v_total, v_completed
  FROM jsonb_each(v_checklist);

  v_lifecycle := CASE
    WHEN v_bootstrap.status = 'blocked'
      OR v_organization_status IN ('suspended', 'archived')
      OR v_subscription_status IN ('canceled', 'expired') THEN 'blocked'
    WHEN v_subscription_status = 'active'
      AND (v_bootstrap.account_kind = 'individual' OR v_organization_status = 'active') THEN 'active'
    WHEN v_subscription_status = 'trial' THEN 'trial'
    WHEN v_organization_status IN ('onboarding', 'pilot') THEN 'under_review'
    WHEN v_subscription_status IS NULL THEN 'contracting_pending'
    ELSE 'creating'
  END;

  RETURN v_context || jsonb_build_object(
    'lifecycle_state', v_lifecycle,
    'onboarding', jsonb_build_object(
      'status', v_bootstrap.status,
      'current_step', v_bootstrap.current_step,
      'checklist', v_checklist,
      'completed_items', v_completed,
      'total_items', v_total,
      'progress_percent', CASE WHEN v_total = 0 THEN 0 ELSE floor(v_completed * 100.0 / v_total)::integer END,
      'updated_at', v_bootstrap.updated_at
    ),
    'activation', jsonb_build_object(
      'commercially_active', v_lifecycle = 'active',
      'self_service_state', v_lifecycle,
      'requires_support_contact', false
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_entry_context()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_entry_context()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.update_customer_onboarding_checklist(
  p_item text,
  p_completed boolean DEFAULT true,
  p_request_id uuid DEFAULT gen_random_uuid(),
  p_source text DEFAULT 'unknown'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_bootstrap private.customer_bootstrap_states;
  v_checklist jsonb;
  v_all_complete boolean;
  v_role text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_item NOT IN ('team', 'configuration') THEN
    RAISE EXCEPTION 'onboarding_item_is_server_managed' USING ERRCODE = '42501';
  END IF;
  IF p_source NOT IN ('web', 'android', 'ios', 'invite', 'unknown') THEN
    RAISE EXCEPTION 'invalid_onboarding_source' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_bootstrap
  FROM private.customer_bootstrap_states
  WHERE user_id = v_user
  FOR UPDATE;
  IF v_bootstrap.id IS NULL THEN
    RAISE EXCEPTION 'customer_bootstrap_required' USING ERRCODE = 'P0002';
  END IF;
  IF v_bootstrap.status = 'blocked' THEN
    RAISE EXCEPTION 'customer_onboarding_blocked' USING ERRCODE = '42501';
  END IF;

  IF v_bootstrap.account_kind = 'organization' THEN
    v_role := private.organization_role(v_bootstrap.organization_id, v_user);
    IF v_role NOT IN ('owner', 'coordinator') THEN
      RAISE EXCEPTION 'organization_administrator_required' USING ERRCODE = '42501';
    END IF;
    IF p_item = 'team' AND p_completed AND NOT EXISTS (
      SELECT 1
      FROM public.organization_members AS member
      WHERE member.organization_id = v_bootstrap.organization_id
        AND member.user_id <> v_user
        AND member.status = 'active'
    ) THEN
      RAISE EXCEPTION 'active_team_member_required' USING ERRCODE = '23514';
    END IF;
    UPDATE public.organization_onboarding
    SET checklist = jsonb_set(checklist, ARRAY[p_item], to_jsonb(p_completed), true),
        updated_at = now()
    WHERE organization_id = v_bootstrap.organization_id
    RETURNING checklist INTO v_checklist;
  ELSE
    v_checklist := jsonb_set(v_bootstrap.checklist, ARRAY[p_item], to_jsonb(p_completed), true);
  END IF;

  v_checklist := coalesce(v_checklist, v_bootstrap.checklist);
  SELECT bool_and(value = 'true'::jsonb)
  INTO v_all_complete
  FROM jsonb_each(v_checklist);

  UPDATE private.customer_bootstrap_states
  SET checklist = v_checklist,
      source = p_source,
      status = CASE WHEN coalesce(v_all_complete, false) THEN 'completed' ELSE 'in_progress' END,
      current_step = CASE
        WHEN coalesce(v_all_complete, false) THEN 'completed'
        WHEN NOT coalesce((v_checklist->>'team')::boolean, false) THEN 'team'
        WHEN NOT coalesce((v_checklist->>'configuration')::boolean, false) THEN 'configuration'
        ELSE 'first_operation'
      END,
      completed_at = CASE WHEN coalesce(v_all_complete, false) THEN coalesce(completed_at, now()) ELSE NULL END,
      updated_at = now()
  WHERE id = v_bootstrap.id;

  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, actor_role, event_type, entity_type,
    entity_id, request_id, outcome, source, metadata
  ) VALUES (
    v_bootstrap.organization_id, v_user, coalesce(v_role, 'individual'),
    'customer_onboarding_item_updated', 'customer_bootstrap', v_bootstrap.id::text,
    p_request_id, 'allowed', p_source,
    jsonb_build_object('item', p_item, 'completed', p_completed)
  ) ON CONFLICT (request_id, event_type) WHERE request_id IS NOT NULL DO NOTHING;

  RETURN public.get_customer_entry_context();
END;
$$;

REVOKE ALL ON FUNCTION public.update_customer_onboarding_checklist(text, boolean, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_customer_onboarding_checklist(text, boolean, uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.complete_first_customer_operation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid;
  v_actor uuid;
  v_bootstrap private.customer_bootstrap_states;
  v_checklist jsonb;
  v_all_complete boolean;
BEGIN
  IF NEW."agenteUid" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_user := NEW."agenteUid"::uuid;
  END IF;
  SELECT identity.id INTO v_actor
  FROM auth.users AS identity
  WHERE identity.id = coalesce(v_user, auth.uid());
  SELECT * INTO v_bootstrap
  FROM private.customer_bootstrap_states AS bootstrap
  WHERE (NEW.organization_id IS NOT NULL AND bootstrap.organization_id = NEW.organization_id)
     OR (NEW.organization_id IS NULL AND bootstrap.user_id = v_user)
  ORDER BY bootstrap.created_at
  LIMIT 1
  FOR UPDATE;
  IF v_bootstrap.id IS NULL OR v_bootstrap.status = 'blocked' THEN
    RETURN NEW;
  END IF;

  IF v_bootstrap.account_kind = 'organization' THEN
    UPDATE public.organization_onboarding
    SET checklist = jsonb_set(checklist, '{first_operation}', 'true'::jsonb, true),
        updated_at = now()
    WHERE organization_id = v_bootstrap.organization_id
    RETURNING checklist INTO v_checklist;
  ELSE
    v_checklist := jsonb_set(v_bootstrap.checklist, '{first_operation}', 'true'::jsonb, true);
  END IF;
  v_checklist := coalesce(v_checklist, v_bootstrap.checklist);
  SELECT bool_and(value = 'true'::jsonb) INTO v_all_complete FROM jsonb_each(v_checklist);

  UPDATE private.customer_bootstrap_states
  SET checklist = v_checklist,
      status = CASE WHEN coalesce(v_all_complete, false) THEN 'completed' ELSE 'in_progress' END,
      current_step = CASE WHEN coalesce(v_all_complete, false) THEN 'completed' ELSE current_step END,
      completed_at = CASE WHEN coalesce(v_all_complete, false) THEN coalesce(completed_at, now()) ELSE completed_at END,
      updated_at = now()
  WHERE id = v_bootstrap.id;

  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, actor_role, event_type, entity_type,
    entity_id, outcome, source, metadata
  ) VALUES (
    v_bootstrap.organization_id, v_actor, 'customer',
    'customer_first_operation_completed', 'vistoria', NEW.id::text,
    'allowed', 'server', jsonb_build_object('checklist_item', 'first_operation')
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.complete_first_customer_operation()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vistorias_complete_customer_onboarding
  ON public.vistorias;
CREATE TRIGGER vistorias_complete_customer_onboarding
  AFTER INSERT ON public.vistorias
  FOR EACH ROW
  EXECUTE FUNCTION private.complete_first_customer_operation();

CREATE OR REPLACE FUNCTION private.refresh_customer_onboarding_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bootstrap private.customer_bootstrap_states;
  v_checklist jsonb;
  v_team_ready boolean;
  v_all_complete boolean;
BEGIN
  SELECT * INTO v_bootstrap
  FROM private.customer_bootstrap_states
  WHERE organization_id = NEW.organization_id
  FOR UPDATE;
  IF v_bootstrap.id IS NULL OR v_bootstrap.status = 'blocked' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members AS member
    WHERE member.organization_id = NEW.organization_id
      AND member.user_id <> v_bootstrap.user_id
      AND member.status = 'active'
  ) INTO v_team_ready;

  UPDATE public.organization_onboarding
  SET checklist = jsonb_set(checklist, '{team}', to_jsonb(v_team_ready), true),
      updated_at = now()
  WHERE organization_id = NEW.organization_id
  RETURNING checklist INTO v_checklist;
  v_checklist := coalesce(v_checklist, v_bootstrap.checklist);
  SELECT bool_and(value = 'true'::jsonb) INTO v_all_complete FROM jsonb_each(v_checklist);

  UPDATE private.customer_bootstrap_states
  SET checklist = v_checklist,
      status = CASE WHEN coalesce(v_all_complete, false) THEN 'completed' ELSE 'in_progress' END,
      current_step = CASE
        WHEN coalesce(v_all_complete, false) THEN 'completed'
        WHEN NOT v_team_ready THEN 'team'
        WHEN NOT coalesce((v_checklist->>'configuration')::boolean, false) THEN 'configuration'
        ELSE 'first_operation'
      END,
      completed_at = CASE WHEN coalesce(v_all_complete, false) THEN coalesce(completed_at, now()) ELSE NULL END,
      updated_at = now()
  WHERE id = v_bootstrap.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.refresh_customer_onboarding_team()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS organization_members_refresh_customer_onboarding
  ON public.organization_members;
CREATE TRIGGER organization_members_refresh_customer_onboarding
  AFTER INSERT OR UPDATE OF status, organization_id ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION private.refresh_customer_onboarding_team();

CREATE OR REPLACE FUNCTION public.record_customer_onboarding_funnel(
  p_event text,
  p_request_id uuid DEFAULT gen_random_uuid(),
  p_source text DEFAULT 'unknown'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_bootstrap private.customer_bootstrap_states;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_event NOT IN (
    'onboarding_viewed', 'account_kind_selected', 'details_started',
    'terms_accepted', 'bootstrap_submitted', 'onboarding_resumed'
  ) OR p_source NOT IN ('web', 'android', 'ios', 'invite', 'unknown') THEN
    RAISE EXCEPTION 'invalid_onboarding_event' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_bootstrap
  FROM private.customer_bootstrap_states
  WHERE user_id = v_user;
  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, actor_role, event_type, entity_type,
    entity_id, request_id, outcome, source, metadata
  ) VALUES (
    v_bootstrap.organization_id, v_user, 'customer', p_event,
    'customer_onboarding', coalesce(v_bootstrap.id::text, v_user::text),
    p_request_id, 'allowed', p_source, '{}'::jsonb
  ) ON CONFLICT (request_id, event_type) WHERE request_id IS NOT NULL DO NOTHING;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_customer_onboarding_funnel(text, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_customer_onboarding_funnel(text, uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_customer_onboarding_timeline()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'event_type', event.event_type,
    'entity_type', event.entity_type,
    'entity_id', event.entity_id,
    'outcome', event.outcome,
    'source', event.source,
    'created_at', event.created_at
  ) ORDER BY event.created_at DESC), '[]'::jsonb)
  FROM public.subscription_audit_events AS event
  WHERE auth.uid() IS NOT NULL
    AND (
      event.actor_id = auth.uid()
      OR (
        event.organization_id = private.current_organization_id(auth.uid())
        AND private.organization_role(event.organization_id, auth.uid()) IN ('owner', 'coordinator')
      )
    )
    AND event.event_type IN (
      'customer_bootstrap_completed',
      'first_organization_administrator_created',
      'organization_invite_accepted',
      'portal_invite_accepted',
      'password_recovery_completed',
      'google_identity_reconciled',
      'customer_onboarding_item_updated',
      'customer_first_operation_completed'
    )
  LIMIT 100
$$;

REVOKE ALL ON FUNCTION public.get_customer_onboarding_timeline()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_onboarding_timeline()
  TO authenticated;

COMMENT ON FUNCTION public.update_customer_onboarding_checklist(text, boolean, uuid, text) IS
  'Updates only customer-manageable onboarding items; authority and audit stay server-side.';
COMMENT ON FUNCTION public.record_customer_onboarding_funnel(text, uuid, text) IS
  'Records an allowlisted onboarding event without accepting arbitrary or sensitive payloads.';
COMMENT ON TABLE public.subscription_audit_events IS
  'Append-only authoritative customer/commercial events. Clients cannot insert, update or delete rows directly.';
