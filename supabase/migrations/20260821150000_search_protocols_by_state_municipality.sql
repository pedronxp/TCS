-- Dedicated registry search avoids overloading the legacy RPC while providing
-- authoritative filtering by UF and municipality for the internal console.

CREATE OR REPLACE FUNCTION public.search_internal_protocol_registry(
  p_search text DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_municipio text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_items jsonb;
  v_total bigint;
  v_term text := nullif(trim(p_search), '');
  v_status text := nullif(trim(p_status), '');
  v_uf text := nullif(upper(trim(p_uf)), '');
  v_municipio text := nullif(trim(p_municipio), '');
BEGIN
  IF NOT private.has_internal_permission('protocol.read') THEN
    RAISE EXCEPTION 'protocol_registry_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 100 OR p_offset < 0 THEN RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023'; END IF;
  WITH records AS (
    SELECT v.id, v.protocolo, v.protocol_series, v.protocol_year, v.protocol_seq, v.organization_id,
      coalesce(o.municipality_name, o.display_name, v.municipio, 'Agente individual') AS city,
      v."agenteNome" AS agent_name, v."dataVistoria" AS inspected_at, v.status, v."nivelRisco" AS risk_level,
      v.laudo_gerado_em IS NOT NULL AS has_laudo, v.relatorio_gerado_em IS NOT NULL AS has_report,
      CASE WHEN v.organization_id IS NULL THEN 'individual' ELSE 'municipal' END AS subject_kind
    FROM public.vistorias v
    LEFT JOIN public.organizations o ON o.id = v.organization_id
    LEFT JOIN public.municipios m ON lower(m.nome) = lower(coalesce(v.municipio, o.municipality_name))
    WHERE v.protocolo IS NOT NULL
      AND (p_organization_id IS NULL OR v.organization_id = p_organization_id)
      AND (v_status IS NULL OR lower(v.status) = lower(v_status))
      AND (v_uf IS NULL OR m.uf = v_uf)
      AND (v_municipio IS NULL OR lower(coalesce(v.municipio, o.municipality_name, '')) = lower(v_municipio))
      AND (v_term IS NULL OR v.protocolo ILIKE '%' || v_term || '%' OR coalesce(o.display_name, '') ILIKE '%' || v_term || '%' OR coalesce(o.municipality_name, '') ILIKE '%' || v_term || '%' OR coalesce(v."agenteNome", '') ILIKE '%' || v_term || '%' OR coalesce(v."nivelRisco", '') ILIKE '%' || v_term || '%')
  ), paged AS (
    SELECT * FROM records ORDER BY inspected_at DESC NULLS LAST, protocolo DESC LIMIT p_limit OFFSET p_offset
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'protocol', protocolo, 'series', protocol_series, 'year', protocol_year, 'sequence', protocol_seq, 'organization_id', organization_id, 'city', city, 'agent_name', agent_name, 'inspected_at', inspected_at, 'status', status, 'risk_level', risk_level, 'has_laudo', has_laudo, 'has_report', has_report, 'subject_kind', subject_kind)), '[]'::jsonb), (SELECT count(*) FROM records) INTO v_items, v_total FROM paged;
  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'limit', p_limit, 'offset', p_offset);
END;
$$;

REVOKE ALL ON FUNCTION public.search_internal_protocol_registry(text, uuid, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_internal_protocol_registry(text, uuid, text, text, text, integer, integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
