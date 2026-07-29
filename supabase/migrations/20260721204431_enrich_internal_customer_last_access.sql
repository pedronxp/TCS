-- Enrich the customer detail with a real last-access timestamp. The value is
-- derived from Supabase Auth and session heartbeats across reviewed legacy
-- identities, rather than the nullable compatibility column in public.users.

CREATE OR REPLACE FUNCTION public.get_internal_customer_detail(p_customer_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb := private.get_internal_customer_detail_base(p_customer_id);
  customer_kind text := split_part(p_customer_id, ':', 1);
  enriched_inspections jsonb;
  enriched_users jsonb;
  latest_access timestamptz;
BEGIN
  SELECT coalesce(jsonb_agg(
    inspection.item || jsonb_build_object(
      'agent_name', coalesce(
        nullif(trim(v."agenteNome"), ''),
        nullif(trim(source_user.name), ''),
        CASE
          WHEN customer_kind = 'user'
          THEN nullif(trim(result #>> '{customer,display_name}'), '')
        END
      )
    )
    ORDER BY inspection.position
  ), '[]'::jsonb)
  INTO enriched_inspections
  FROM jsonb_array_elements(coalesce(result->'inspections', '[]'::jsonb))
    WITH ORDINALITY AS inspection(item, position)
  LEFT JOIN public.vistorias v
    ON v.id = (inspection.item->>'id')::uuid
  LEFT JOIN public.users source_user
    ON source_user.uid::text = v."agenteUid"::text;

  SELECT coalesce(jsonb_agg(
    user_entry.item || jsonb_build_object('last_login', access.last_access)
    ORDER BY user_entry.position
  ), '[]'::jsonb)
  INTO enriched_users
  FROM jsonb_array_elements(coalesce(result->'users', '[]'::jsonb))
    WITH ORDINALITY AS user_entry(item, position)
  LEFT JOIN LATERAL (
    SELECT max(activity.occurred_at) AS last_access
    FROM (
      SELECT auth_user.last_sign_in_at AS occurred_at
      FROM auth.users auth_user
      WHERE auth_user.id = ANY(private.resolve_internal_agent_ids(
        p_customer_id,
        (user_entry.item->>'user_id')::uuid
      ))
      UNION ALL
      SELECT public_user."lastLogin"
      FROM public.users public_user
      WHERE public_user.uid = ANY(private.resolve_internal_agent_ids(
        p_customer_id,
        (user_entry.item->>'user_id')::uuid
      ))
      UNION ALL
      SELECT session.last_heartbeat_at
      FROM public.active_sessions session
      WHERE session.user_id = ANY(private.resolve_internal_agent_ids(
        p_customer_id,
        (user_entry.item->>'user_id')::uuid
      ))
    ) activity
  ) access ON true;

  SELECT max((user_item->>'last_login')::timestamptz)
  INTO latest_access
  FROM jsonb_array_elements(enriched_users) user_item
  WHERE nullif(user_item->>'last_login', '') IS NOT NULL;

  result := jsonb_set(result, '{inspections}', enriched_inspections, true);
  result := jsonb_set(result, '{users}', enriched_users, true);
  result := jsonb_set(
    result,
    '{customer,last_access_at}',
    coalesce(to_jsonb(latest_access), 'null'::jsonb),
    true
  );
  result := jsonb_set(
    result,
    '{customer,updated_at}',
    coalesce(to_jsonb(latest_access), result #> '{customer,updated_at}', 'null'::jsonb),
    true
  );
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_internal_customer_detail(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_customer_detail(text)
  TO authenticated;

COMMENT ON FUNCTION public.get_internal_customer_detail(text) IS
  'Customer detail with complete legacy-aware history, agent names and last access derived from Auth and session activity.';

NOTIFY pgrst, 'reload schema';
