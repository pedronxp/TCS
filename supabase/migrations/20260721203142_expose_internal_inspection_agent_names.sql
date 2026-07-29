-- Preserve the complete customer payload and enrich every inspection with the
-- recorded agent name (or the source account name for older records).

ALTER FUNCTION public.get_internal_customer_detail(text) SET SCHEMA private;
ALTER FUNCTION private.get_internal_customer_detail(text)
  RENAME TO get_internal_customer_detail_base;

REVOKE ALL ON FUNCTION private.get_internal_customer_detail_base(text)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_internal_customer_detail(p_customer_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb := private.get_internal_customer_detail_base(p_customer_id);
  customer_kind text := split_part(p_customer_id, ':', 1);
  enriched_inspections jsonb;
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

  RETURN jsonb_set(result, '{inspections}', enriched_inspections, true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_internal_customer_detail(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_customer_detail(text)
  TO authenticated;

COMMENT ON FUNCTION public.get_internal_customer_detail(text) IS
  'Customer detail with complete legacy-aware history and agent names enriched from the source inspection identity.';

NOTIFY pgrst, 'reload schema';
