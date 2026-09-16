-- Server-side portfolio filters. Dates refer to the customer's latest activity
-- displayed in the console, and are inclusive of both selected calendar days.

DROP FUNCTION IF EXISTS public.list_internal_customers(text, text, integer, integer);

CREATE FUNCTION public.list_internal_customers(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_municipio text DEFAULT NULL,
  p_state_code text DEFAULT NULL,
  p_activity_from date DEFAULT NULL,
  p_activity_to date DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT private.has_internal_permission('customer.read') THEN
    RAISE EXCEPTION 'customer_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_activity_from IS NOT NULL AND p_activity_to IS NOT NULL AND p_activity_from > p_activity_to THEN
    RAISE EXCEPTION 'invalid_activity_range' USING ERRCODE = '22023';
  END IF;

  WITH customers AS (
    SELECT 'organization:' || o.id::text AS customer_id, 'organization'::text AS kind, o.id AS subject_id,
      o.display_name, o.legal_name, o.municipality_name, o.state_code, o.status,
      CASE WHEN private.current_internal_role() = 'owner' THEN o.contact_name END AS contact_name,
      CASE WHEN private.current_internal_role() = 'owner' THEN o.contact_email END AS contact_email,
      s.status AS subscription_status, p.name AS plan_name,
      (SELECT count(*)::integer FROM public.organization_members m WHERE m.organization_id = o.id AND m.status = 'active') AS active_users,
      o.updated_at AS last_activity_at
    FROM public.organizations o
    LEFT JOIN LATERAL (SELECT sub.* FROM public.subscriptions sub WHERE sub.organization_id = o.id ORDER BY sub.created_at DESC LIMIT 1) s ON true
    LEFT JOIN public.plans p ON p.id = s.plan_id
    UNION ALL
    SELECT 'user:' || u.uid::text, 'individual'::text, u.uid,
      COALESCE(NULLIF(trim(u.name), ''), 'Conta individual'), NULL::text, u.municipio, NULL::text,
      CASE WHEN u."isApproved" THEN 'active' ELSE 'onboarding' END, NULL::text,
      CASE WHEN private.current_internal_role() = 'owner' THEN u.email END,
      s.status, p.name, 1, u."createdAt"
    FROM public.users u
    LEFT JOIN LATERAL (SELECT sub.* FROM public.subscriptions sub WHERE sub.user_id = u.uid ORDER BY sub.created_at DESC LIMIT 1) s ON true
    LEFT JOIN public.plans p ON p.id = s.plan_id
    WHERE u.organization_id IS NULL AND u.role <> 'master_admin'
  ), filtered AS (
    SELECT * FROM customers c
    WHERE (p_status IS NULL OR p_status = '' OR c.status = p_status)
      AND (p_municipio IS NULL OR btrim(p_municipio) = '' OR lower(coalesce(c.municipality_name, '')) = lower(btrim(p_municipio)))
      AND (p_state_code IS NULL OR btrim(p_state_code) = '' OR upper(coalesce(c.state_code, '')) = upper(btrim(p_state_code)))
      AND (p_activity_from IS NULL OR c.last_activity_at >= p_activity_from::timestamptz)
      AND (p_activity_to IS NULL OR c.last_activity_at < (p_activity_to + 1)::timestamptz)
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR c.display_name ILIKE '%' || trim(p_search) || '%'
        OR COALESCE(c.legal_name, '') ILIKE '%' || trim(p_search) || '%'
        OR COALESCE(c.municipality_name, '') ILIKE '%' || trim(p_search) || '%'
        OR COALESCE(c.contact_name, '') ILIKE '%' || trim(p_search) || '%'
        OR COALESCE(c.contact_email, '') ILIKE '%' || trim(p_search) || '%'
        OR c.customer_id ILIKE '%' || trim(p_search) || '%'
      )
  ), page AS (
    SELECT * FROM filtered ORDER BY display_name, customer_id
    LIMIT greatest(1, least(p_limit, 100)) OFFSET greatest(p_offset, 0)
  )
  SELECT jsonb_build_object('items', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered), 'limit', greatest(1, least(p_limit, 100)), 'offset', greatest(p_offset, 0)) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_internal_customers(text, text, text, text, date, date, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_customers(text, text, text, text, date, date, integer, integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
