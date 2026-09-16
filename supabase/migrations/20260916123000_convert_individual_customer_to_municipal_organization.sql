-- Converts a paid individual customer into a municipal organization without
-- duplicating the subscription. This is intentionally one audited transaction.

CREATE OR REPLACE FUNCTION public.convert_individual_customer_to_municipal_organization(
  p_customer_id text,
  p_display_name text,
  p_municipality_name text,
  p_state_code text,
  p_plan_id uuid,
  p_member_role text,
  p_import_individual_inspections boolean,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_user_id uuid;
  v_user public.users;
  v_subscription public.subscriptions;
  v_plan public.plans;
  v_organization public.organizations;
  v_organization_id uuid := gen_random_uuid();
  v_slug text;
  v_role text := lower(btrim(coalesce(p_member_role, 'agent')));
  v_municipality text := nullif(btrim(p_municipality_name), '');
  v_state_code text := upper(nullif(btrim(p_state_code), ''));
  v_imported integer := 0;
  v_hash text;
  v_previous jsonb;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR p_operation_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('customer.write', v_actor)
    OR NOT private.has_internal_permission('commercial.write', v_actor) THEN
    RAISE EXCEPTION 'municipal_conversion_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023'; END IF;
  IF char_length(btrim(coalesce(p_display_name, ''))) < 3 THEN RAISE EXCEPTION 'display_name_required' USING ERRCODE = '22023'; END IF;
  IF char_length(v_municipality) NOT BETWEEN 2 AND 150 OR v_state_code !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'invalid_municipal_details' USING ERRCODE = '22023'; END IF;
  IF v_role NOT IN ('owner', 'coordinator', 'supervisor', 'agent') THEN RAISE EXCEPTION 'invalid_municipal_role' USING ERRCODE = '22023'; END IF;
  IF split_part(p_customer_id, ':', 1) <> 'user' THEN RAISE EXCEPTION 'invalid_customer_id' USING ERRCODE = '22023'; END IF;
  BEGIN v_user_id := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_customer_id' USING ERRCODE = '22023'; END;

  v_hash := md5(concat_ws('|', p_customer_id, btrim(p_display_name), v_municipality, v_state_code, p_plan_id::text, v_role, p_import_individual_inspections, btrim(p_reason)));
  SELECT result INTO v_previous FROM public.internal_operations
  WHERE actor_id = v_actor AND operation_id = p_operation_id AND request_hash = v_hash;
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, v_actor, 'customer.convert_to_municipal_organization', v_hash);

  SELECT * INTO v_user FROM public.users WHERE uid = v_user_id AND organization_id IS NULL FOR UPDATE;
  IF v_user.uid IS NULL THEN RAISE EXCEPTION 'individual_customer_not_found' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = v_user_id AND status IN ('active', 'invited', 'suspended')) THEN
    RAISE EXCEPTION 'membership_conflict' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organizations
    WHERE lower(btrim(municipality_name)) = lower(v_municipality)
      AND upper(state_code) = v_state_code
      AND status <> 'archived'
  ) THEN RAISE EXCEPTION 'municipal_organization_already_exists' USING ERRCODE = '23505'; END IF;

  SELECT * INTO v_subscription FROM public.subscriptions
  WHERE user_id = v_user_id AND status IN ('trial', 'active', 'grace', 'past_due')
  ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  IF v_subscription.id IS NULL THEN RAISE EXCEPTION 'individual_subscription_not_found' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND audience = 'organization' AND status = 'active';
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'municipal_plan_not_available' USING ERRCODE = '22023'; END IF;

  v_slug := 'municipio-' || lower(v_state_code) || '-' || left(replace(v_organization_id::text, '-', ''), 12);
  INSERT INTO public.organizations(
    id, slug, display_name, legal_name, municipality_name, state_code, status,
    contact_name, contact_email, session_policy, session_timeout_minutes, offline_tolerance_minutes
  ) VALUES (
    v_organization_id, v_slug, left(btrim(p_display_name), 150), left(btrim(p_display_name), 150), v_municipality, v_state_code, 'active',
    v_user.name, v_user.email, 'block', 480, 1440
  ) RETURNING * INTO v_organization;

  INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at)
  VALUES (v_organization_id, v_user_id, v_role, 'active', now());
  UPDATE public.users SET organization_id = v_organization_id WHERE uid = v_user_id;
  INSERT INTO private.customer_affiliation_states(user_id, state, updated_at)
  VALUES (v_user_id, 'municipal', now())
  ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at;

  UPDATE public.subscriptions
  SET user_id = NULL, organization_id = v_organization_id, plan_id = v_plan.id, updated_at = now()
  WHERE id = v_subscription.id;

  UPDATE public.active_sessions
  SET status = 'revoked', ended_at = now(), ended_by = v_actor, end_reason = 'customer_converted_to_municipal_organization'
  WHERE user_id = v_user_id AND status = 'active';

  IF p_import_individual_inspections THEN
    v_imported := private.import_individual_inspections(v_user_id, v_organization_id, v_actor, 'customer_conversion');
  END IF;

  v_result := jsonb_build_object(
    'ok', true, 'customer_id', 'organization:' || v_organization_id::text,
    'organization_id', v_organization_id, 'subscription_id', v_subscription.id,
    'imported_inspections', v_imported
  );
  UPDATE public.internal_operations SET status = 'succeeded', result = v_result, completed_at = now()
  WHERE actor_id = v_actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (v_actor, private.current_internal_role(v_actor), 'customer.convert_to_municipal_organization', 'organization', v_organization_id::text,
    'allowed', left(btrim(p_reason), 500), jsonb_build_object('user_id', v_user_id, 'municipality', v_municipality, 'state_code', v_state_code, 'member_role', v_role, 'subscription_id', v_subscription.id, 'from_plan_id', v_subscription.plan_id, 'to_plan_id', v_plan.id, 'imported_inspections', v_imported));
  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (v_organization_id, v_actor, 'individual_subscription_migrated_to_organization', 'subscription', v_subscription.id::text,
    jsonb_build_object('reason', left(btrim(p_reason), 500), 'former_user_id', v_user_id, 'from_plan_id', v_subscription.plan_id, 'to_plan_id', v_plan.id, 'imported_inspections', v_imported));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_individual_customer_to_municipal_organization(text, text, text, text, uuid, text, boolean, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_individual_customer_to_municipal_organization(text, text, text, text, uuid, text, boolean, text, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
