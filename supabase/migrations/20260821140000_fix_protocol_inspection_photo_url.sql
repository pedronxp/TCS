-- Quoted legacy camelCase columns must retain their case when accessed through
-- a PL/pgSQL row variable. Without quotes, fotoUrl becomes fotourl and the
-- protocol investigation RPC fails before it can return the inspection.

CREATE OR REPLACE FUNCTION public.get_internal_protocol_inspection(p_inspection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.vistorias%ROWTYPE;
  v_customer_key text;
  v_can_sensitive boolean;
  v_protocol_event jsonb;
  v_timeline jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_internal_permission('protocol.read') THEN
    RAISE EXCEPTION 'protocol_registry_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.vistorias WHERE id = p_inspection_id;
  IF v.id IS NULL OR v.protocolo IS NULL THEN RAISE EXCEPTION 'protocol_inspection_not_found' USING ERRCODE = 'P0002'; END IF;
  v_customer_key := CASE WHEN v.organization_id IS NULL THEN 'user:' || v."agenteUid" ELSE 'organization:' || v.organization_id END;
  v_can_sensitive := private.can_access_sensitive_customer(v_customer_key);
  SELECT coalesce(to_jsonb(e), to_jsonb(i)) INTO v_protocol_event FROM public.protocol_allocation_events e FULL JOIN public.individual_protocol_allocation_events i ON false WHERE e.inspection_id = v.id OR i.inspection_id = v.id LIMIT 1;
  SELECT coalesce(jsonb_agg(item || jsonb_build_object('occurred_at', occurred_at) ORDER BY occurred_at NULLS LAST, sort_order), '[]'::jsonb)
  INTO v_timeline FROM (
    SELECT 10 AS sort_order, v."criadoEm" AS occurred_at, jsonb_build_object('kind', 'created', 'label', 'Registro iniciado') AS item
    UNION ALL SELECT 20, v."dataVistoria", jsonb_build_object('kind', 'inspected', 'label', 'Vistoria realizada')
    UNION ALL SELECT 30, coalesce((v_protocol_event->>'allocated_at')::timestamptz, v."dataVistoria"), jsonb_build_object('kind', 'protocol', 'label', 'Protocolo oficial alocado', 'detail', v.protocolo)
    UNION ALL SELECT 40, v.relatorio_gerado_em, jsonb_build_object('kind', 'report', 'label', 'Relatório gerado')
    UNION ALL SELECT 50, v.termo_gerado_em, jsonb_build_object('kind', 'term', 'label', 'Termo gerado')
    UNION ALL SELECT 60, v.laudo_gerado_em, jsonb_build_object('kind', 'laudo', 'label', 'Laudo disponibilizado')
  ) timeline(sort_order, occurred_at, item) WHERE occurred_at IS NOT NULL;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, metadata)
  VALUES (auth.uid(), private.current_internal_role(auth.uid()), 'protocol.inspection.review', 'inspection', v.id::text, 'allowed', jsonb_build_object('protocol', v.protocolo, 'sensitive', v_can_sensitive));
  RETURN jsonb_build_object(
    'id', v.id, 'protocol', v.protocolo, 'status', v.status, 'risk_level', v."nivelRisco", 'score', v."pontuacaoTotal", 'occurred_at', v."dataVistoria", 'created_at', v."criadoEm",
    'organization', (SELECT coalesce(o.display_name, o.municipality_name) FROM public.organizations o WHERE o.id = v.organization_id), 'municipality', v.municipio, 'agent_name', v."agenteNome", 'responsible_name', v."responsavelNome",
    'form_id', v."formularioId", 'form_version', v."formularioVersao", 'synchronized', v.sincronizado,
    'documents', jsonb_build_object('laudo', v.laudo_gerado_em IS NOT NULL, 'report', v.relatorio_gerado_em IS NOT NULL, 'term', v.termo_gerado_em IS NOT NULL),
    'photo_count', coalesce(array_length(v."fotosUrls", 1), 0) + CASE WHEN v."fotoUrl" IS NULL THEN 0 ELSE 1 END,
    'timeline', v_timeline, 'protocol_event', v_protocol_event, 'can_view_sensitive', v_can_sensitive,
    'address', CASE WHEN v_can_sensitive THEN coalesce(v.endereco, concat_ws(' ', v."enderecoRua", v."enderecoNumero", v."enderecoBairro")) END,
    'answers', CASE WHEN v_can_sensitive THEN v."respostasJson" END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_internal_protocol_inspection(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_protocol_inspection(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
