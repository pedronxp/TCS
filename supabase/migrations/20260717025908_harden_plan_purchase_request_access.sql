-- Keep anonymous lead capture within ordinary RLS privileges. Only the manual
-- activation RPC remains SECURITY DEFINER because it performs an atomic,
-- master-authorized subscription mutation across multiple protected tables.

CREATE INDEX plan_purchase_requests_plan_id_idx
  ON public.plan_purchase_requests(plan_id);
CREATE INDEX plan_purchase_requests_reviewed_by_idx
  ON public.plan_purchase_requests(reviewed_by)
  WHERE reviewed_by IS NOT NULL;
CREATE INDEX plan_purchase_requests_resolved_subscription_idx
  ON public.plan_purchase_requests(resolved_subscription_id)
  WHERE resolved_subscription_id IS NOT NULL;

GRANT SELECT ON public.plans TO anon;
GRANT INSERT ON public.plan_purchase_requests TO anon, authenticated;

CREATE POLICY plans_public_commercial_select
ON public.plans
FOR SELECT
TO anon
USING (status = 'active' AND audience IN ('individual', 'organization'));

CREATE POLICY plan_purchase_requests_submit
ON public.plan_purchase_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  requester_id IS NOT DISTINCT FROM (SELECT auth.uid())
  AND status = 'pending'
  AND source = 'app'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND resolved_subscription_id IS NULL
  AND review_note IS NULL
  AND metadata = '{}'::jsonb
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
SECURITY INVOKER
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
  DO NOTHING
  RETURNING id INTO v_request_id;

  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'request_id', NULL,
      'status', 'pending'
    );
  END IF;

  RETURN jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'request_id', v_request_id,
    'status', 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_plan_purchase_request(text, text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_plan_purchase_request(text, text, text, text, text, text, text, text)
  TO anon, authenticated;
