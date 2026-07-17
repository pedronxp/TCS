-- Manual plan contracting flow. Payment providers can later replace the manual
-- approval step while keeping this request/audit boundary intact.

CREATE TABLE public.plan_purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  requester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 2 AND 120),
  contact_email text NOT NULL CHECK (
    contact_email = lower(contact_email)
    AND char_length(contact_email) BETWEEN 5 AND 254
    AND contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  contact_phone text CHECK (contact_phone IS NULL OR char_length(contact_phone) BETWEEN 8 AND 30),
  organization_name text CHECK (organization_name IS NULL OR char_length(organization_name) BETWEEN 2 AND 160),
  municipality_name text CHECK (municipality_name IS NULL OR char_length(municipality_name) BETWEEN 2 AND 120),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual', 'custom')),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'contacted', 'awaiting_account', 'approved', 'rejected', 'canceled')
  ),
  customer_message text CHECK (customer_message IS NULL OR char_length(customer_message) <= 1000),
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 1000),
  source text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'web', 'admin', 'payment_webhook')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolved_subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plan_purchase_requests_requester_created_idx
  ON public.plan_purchase_requests(requester_id, created_at DESC)
  WHERE requester_id IS NOT NULL;
CREATE INDEX plan_purchase_requests_status_created_idx
  ON public.plan_purchase_requests(status, created_at DESC);
CREATE UNIQUE INDEX plan_purchase_requests_open_email_plan_key
  ON public.plan_purchase_requests(lower(contact_email), plan_id)
  WHERE status IN ('pending', 'contacted', 'awaiting_account');

-- The commercial catalog is now published for contracting. Payment enforcement
-- remains disabled until a provider is connected and explicitly enabled.
UPDATE public.plans
SET status = 'active', updated_at = now()
WHERE code IN (
  'individual_basic',
  'individual_professional',
  'municipal_basic',
  'municipal_professional',
  'municipal_complete'
);

UPDATE public.plan_versions AS version
SET published_at = COALESCE(version.published_at, now())
FROM public.plans AS plan
WHERE version.plan_id = plan.id
  AND version.version = plan.current_version
  AND plan.status = 'active';

REVOKE ALL ON public.plan_purchase_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.plan_purchase_requests TO authenticated;

ALTER TABLE public.plan_purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_purchase_requests_subject_select
ON public.plan_purchase_requests
FOR SELECT
TO authenticated
USING (
  requester_id = (SELECT auth.uid())
  OR (SELECT private.is_owner_admin())
);

CREATE OR REPLACE FUNCTION public.submit_plan_purchase_request(
  p_plan_code text,
  p_billing_cycle text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text DEFAULT NULL,
  p_organization_name text DEFAULT NULL,
  p_municipality_name text DEFAULT NULL,
  p_customer_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.plans;
  v_request_id uuid;
  v_requester uuid := auth.uid();
  v_email text := lower(trim(COALESCE(p_contact_email, '')));
  v_name text := trim(COALESCE(p_contact_name, ''));
  v_phone text := nullif(trim(COALESCE(p_contact_phone, '')), '');
  v_organization text := nullif(trim(COALESCE(p_organization_name, '')), '');
  v_municipality text := nullif(trim(COALESCE(p_municipality_name, '')), '');
  v_message text := nullif(trim(COALESCE(p_customer_message, '')), '');
BEGIN
  SELECT * INTO v_plan
  FROM public.plans
  WHERE code = lower(trim(COALESCE(p_plan_code, '')))
    AND status = 'active'
    AND audience IN ('individual', 'organization');

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'invalid_plan' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'invalid_contact_name' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_email) NOT BETWEEN 5 AND 254
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'invalid_contact_email' USING ERRCODE = '22023';
  END IF;
  IF v_phone IS NOT NULL AND char_length(v_phone) NOT BETWEEN 8 AND 30 THEN
    RAISE EXCEPTION 'invalid_contact_phone' USING ERRCODE = '22023';
  END IF;
  IF p_billing_cycle NOT IN ('monthly', 'annual', 'custom')
     OR (p_billing_cycle = 'custom' AND v_plan.code <> 'municipal_complete') THEN
    RAISE EXCEPTION 'invalid_billing_cycle' USING ERRCODE = '22023';
  END IF;
  IF v_plan.audience = 'organization' AND COALESCE(v_organization, v_municipality) IS NULL THEN
    RAISE EXCEPTION 'organization_name_required' USING ERRCODE = '22023';
  END IF;
  IF v_message IS NOT NULL AND char_length(v_message) > 1000 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.plan_purchase_requests(
    plan_id,
    requester_id,
    contact_name,
    contact_email,
    contact_phone,
    organization_name,
    municipality_name,
    billing_cycle,
    customer_message
  ) VALUES (
    v_plan.id,
    v_requester,
    v_name,
    v_email,
    v_phone,
    v_organization,
    v_municipality,
    p_billing_cycle,
    v_message
  )
  ON CONFLICT (lower(contact_email), plan_id)
    WHERE status IN ('pending', 'contacted', 'awaiting_account')
  DO UPDATE SET
    requester_id = COALESCE(public.plan_purchase_requests.requester_id, EXCLUDED.requester_id),
    contact_name = EXCLUDED.contact_name,
    contact_phone = COALESCE(EXCLUDED.contact_phone, public.plan_purchase_requests.contact_phone),
    organization_name = COALESCE(EXCLUDED.organization_name, public.plan_purchase_requests.organization_name),
    municipality_name = COALESCE(EXCLUDED.municipality_name, public.plan_purchase_requests.municipality_name),
    billing_cycle = EXCLUDED.billing_cycle,
    customer_message = COALESCE(EXCLUDED.customer_message, public.plan_purchase_requests.customer_message),
    updated_at = now()
  RETURNING id INTO v_request_id;

  INSERT INTO public.subscription_audit_events(
    actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    v_requester,
    'purchase_requested',
    'plan_purchase_request',
    v_request_id::text,
    jsonb_build_object('plan_code', v_plan.code, 'billing_cycle', p_billing_cycle)
  );

  RETURN jsonb_build_object(
    'accepted', true,
    'request_id', v_request_id,
    'status', 'pending'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_plan_purchase_request(
  p_request_id uuid,
  p_action text,
  p_review_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_request public.plan_purchase_requests;
  v_plan public.plans;
  v_target_user uuid;
  v_target_approved boolean;
  v_organization_id uuid;
  v_subscription_id uuid;
  v_period_end timestamptz;
  v_review_note text := nullif(trim(COALESCE(p_review_note, '')), '');
  v_display_name text;
BEGIN
  IF v_actor IS NULL OR NOT private.is_owner_admin(v_actor) THEN
    RAISE EXCEPTION 'owner_access_required' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('contacted', 'approve', 'reject') THEN
    RAISE EXCEPTION 'invalid_review_action' USING ERRCODE = '22023';
  END IF;
  IF v_review_note IS NOT NULL AND char_length(v_review_note) > 1000 THEN
    RAISE EXCEPTION 'review_note_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_request
  FROM public.plan_purchase_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'purchase_request_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_request.status IN ('approved', 'rejected', 'canceled') THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'request_already_resolved', 'status', v_request.status);
  END IF;

  IF p_action = 'contacted' THEN
    UPDATE public.plan_purchase_requests
    SET status = 'contacted', review_note = v_review_note, reviewed_by = v_actor,
        reviewed_at = now(), updated_at = now()
    WHERE id = v_request.id;
    RETURN jsonb_build_object('updated', true, 'status', 'contacted');
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.plan_purchase_requests
    SET status = 'rejected', review_note = v_review_note, reviewed_by = v_actor,
        reviewed_at = now(), updated_at = now()
    WHERE id = v_request.id;
    INSERT INTO public.subscription_audit_events(actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_actor, 'purchase_rejected', 'plan_purchase_request', v_request.id::text,
      jsonb_build_object('note', v_review_note));
    RETURN jsonb_build_object('updated', true, 'status', 'rejected');
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_request.plan_id;
  v_target_user := v_request.requester_id;

  IF v_target_user IS NULL THEN
    SELECT uid INTO v_target_user
    FROM public.users
    WHERE lower(email) = v_request.contact_email
      AND "isApproved" = true
    ORDER BY "createdAt" ASC
    LIMIT 1;
  END IF;

  IF v_target_user IS NOT NULL THEN
    SELECT "isApproved", organization_id
    INTO v_target_approved, v_organization_id
    FROM public.users
    WHERE uid = v_target_user;
  END IF;

  IF v_target_user IS NULL OR COALESCE(v_target_approved, false) = false THEN
    UPDATE public.plan_purchase_requests
    SET status = 'awaiting_account', review_note = v_review_note,
        reviewed_by = v_actor, reviewed_at = now(), updated_at = now()
    WHERE id = v_request.id;
    RETURN jsonb_build_object('updated', true, 'approved', false, 'status', 'awaiting_account', 'reason', 'account_required');
  END IF;

  IF v_plan.audience = 'individual' AND v_organization_id IS NOT NULL THEN
    RETURN jsonb_build_object('updated', false, 'approved', false, 'reason', 'organization_member_requires_municipal_plan');
  END IF;

  IF v_plan.audience = 'organization' THEN
    IF v_organization_id IS NULL THEN
      v_display_name := COALESCE(
        v_request.organization_name,
        v_request.municipality_name,
        v_request.contact_name || ' - Defesa Civil'
      );
      INSERT INTO public.organizations(
        slug, display_name, municipality_name, status, contact_name, contact_email
      ) VALUES (
        'org-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
        v_display_name,
        v_request.municipality_name,
        'pilot',
        v_request.contact_name,
        v_request.contact_email
      ) RETURNING id INTO v_organization_id;

      UPDATE public.users
      SET organization_id = v_organization_id,
          municipio = COALESCE(v_request.municipality_name, municipio)
      WHERE uid = v_target_user;
    END IF;

    INSERT INTO public.organization_members(
      organization_id, user_id, role, status, joined_at
    ) VALUES (
      v_organization_id, v_target_user, 'owner', 'active', now()
    )
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = 'owner', status = 'active', joined_at = COALESCE(public.organization_members.joined_at, now()), updated_at = now();

    UPDATE public.subscriptions
    SET status = 'canceled', canceled_at = now(), updated_at = now()
    WHERE organization_id = v_organization_id
      AND status IN ('trial', 'active', 'grace', 'past_due');
  ELSE
    UPDATE public.subscriptions
    SET status = 'canceled', canceled_at = now(), updated_at = now()
    WHERE user_id = v_target_user
      AND status IN ('trial', 'active', 'grace', 'past_due');
  END IF;

  v_period_end := CASE v_request.billing_cycle
    WHEN 'monthly' THEN now() + interval '1 month'
    ELSE now() + interval '1 year'
  END;

  INSERT INTO public.subscriptions(
    plan_id, user_id, organization_id, status, starts_at,
    current_period_start, current_period_end,
    overrides
  ) VALUES (
    v_plan.id,
    CASE WHEN v_plan.audience = 'individual' THEN v_target_user ELSE NULL END,
    CASE WHEN v_plan.audience = 'organization' THEN v_organization_id ELSE NULL END,
    'active',
    now(),
    now(),
    v_period_end,
    jsonb_build_object(
      'activation', 'manual',
      'billing_cycle', v_request.billing_cycle,
      'purchase_request_id', v_request.id
    )
  ) RETURNING id INTO v_subscription_id;

  UPDATE public.plan_purchase_requests
  SET status = 'approved', review_note = v_review_note,
      reviewed_by = v_actor, reviewed_at = now(),
      resolved_subscription_id = v_subscription_id, updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    v_organization_id,
    v_actor,
    'purchase_approved',
    'plan_purchase_request',
    v_request.id::text,
    jsonb_build_object('plan_code', v_plan.code, 'subscription_id', v_subscription_id)
  );

  RETURN jsonb_build_object(
    'updated', true,
    'approved', true,
    'status', 'approved',
    'subscription_id', v_subscription_id,
    'organization_id', v_organization_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_plan_purchase_request(text, text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_plan_purchase_request(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_plan_purchase_request(text, text, text, text, text, text, text, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_plan_purchase_request(uuid, text, text)
  TO authenticated;

COMMENT ON TABLE public.plan_purchase_requests IS
  'Manual contracting requests. Payment webhooks can resolve the same request boundary later.';
