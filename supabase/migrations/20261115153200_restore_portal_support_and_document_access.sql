-- Restaura os contratos ausentes de suporte e autorização de documentos do portal.
BEGIN;
CREATE OR REPLACE FUNCTION public.portal_get_support_timeline(
  p_ticket_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ticket public.support_tickets;
  v_org uuid;
  v_can_see boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_ticket_id IS NULL THEN
    RAISE EXCEPTION 'ticket_id_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id;
  IF v_ticket.id IS NULL THEN
    RETURN jsonb_build_object('ticket', NULL::jsonb, 'events', '[]'::jsonb);
  END IF;

  -- Escopo: dono do ticket (requester/user) OU gestor da mesma organização OU
  -- owner admin interno. Console interno (support.read/console.read) também
  -- lê, mas esta RPC é do portal do cliente; o console usa leitura interna.
  v_org := private.current_organization_id();
  v_can_see := COALESCE(
              (v_ticket.requester_id = v_uid)
            OR (v_ticket.user_id = v_uid)
            OR (v_ticket.organization_id IS NOT NULL
                AND v_ticket.organization_id = v_org
                AND private.organization_role(v_ticket.organization_id)
                    IN ('master','admin','owner','coordinator'))
            OR private.is_owner_admin(v_uid),
            false);

  IF NOT v_can_see THEN
    -- Não revela existência do ticket a quem não tem escopo.
    RETURN jsonb_build_object('ticket', NULL::jsonb, 'events', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'public_code', v_ticket.public_code,
      'subject', v_ticket.subject,
      'status', v_ticket.status,
      'priority', v_ticket.priority,
      'category', v_ticket.category,
      'created_at', v_ticket.created_at,
      'response_due_at', v_ticket.response_due_at,
      'resolution_due_at', v_ticket.resolution_due_at
    ),
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'event_type', e.event_type,
        'actor_id', e.actor_id,
        'message', e.message,
        'visibility', e.metadata->>'visibility',
        'created_at', e.created_at
      ) ORDER BY e.created_at)
      FROM public.support_ticket_events e
      WHERE e.ticket_id = p_ticket_id
        -- CORREÇÃO 1: Fail-closed — apenas 'shared' explícito aparece.
        AND e.metadata->>'visibility' = 'shared'
    ), '[]'::jsonb)
  );
END;
$function$;

COMMENT ON FUNCTION public.portal_get_support_timeline(uuid) IS
  'Timeline do cliente: eventos do ticket explicitamente shared (visibility=shared), ordenados. Escopo requester/user/org-admin/owner. Notas internas, ausência de visibility e valores desconhecidos nunca aparecem (fail-closed).';


REVOKE ALL ON FUNCTION public.portal_get_support_timeline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_get_support_timeline(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.portal_authorize_inspection_document(p_inspection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_org uuid;
  v_inspection public.vistorias;
  v_storage_path text;
BEGIN
  v_context := public.get_portal_access_context();
  IF v_context IS NULL OR NOT (v_context->'permissions') ? 'document.read' THEN
    RAISE EXCEPTION 'document_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;
  SELECT * INTO v_inspection
  FROM public.vistorias AS inspection
  WHERE inspection.id = p_inspection_id
    AND (
      (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
      OR (
        v_org IS NOT NULL
        AND inspection.organization_id = v_org
        AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user)
      )
    );
  IF v_inspection.id IS NULL
     OR v_inspection.laudo_gerado_em IS NULL
     OR v_inspection.laudo_url IS NULL THEN
    RAISE EXCEPTION 'document_not_found' USING ERRCODE = 'P0002';
  END IF;
  v_storage_path := CASE
    WHEN v_inspection.laudo_url LIKE 'laudos:%'
      THEN substring(v_inspection.laudo_url FROM char_length('laudos:') + 1)
    ELSE substring(v_inspection.laudo_url FROM '/object/(?:sign|authenticated|public)/laudos/([^?]+)')
  END;
  v_storage_path := COALESCE(
    NULLIF(v_storage_path, ''),
    concat_ws(
      '/',
      COALESCE(NULLIF(v_inspection.municipio, ''), NULLIF(v_inspection.municipio_agente, ''), 'geral'),
      v_inspection.id || '.pdf'
    )
  );
  IF v_storage_path = ''
     OR v_storage_path LIKE '/%'
     OR string_to_array(v_storage_path, '/') @> ARRAY['..']
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects WHERE bucket_id = 'laudos' AND name = v_storage_path
     ) THEN
    RAISE EXCEPTION 'document_file_missing' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    v_org, v_user, 'portal_document_authorized', 'inspection_document',
    v_inspection.id::text, jsonb_build_object('expires_in_seconds', 60)
  );
  RETURN jsonb_build_object(
    'bucket', 'laudos',
    'path', v_storage_path,
    'expires_in', 60,
    'filename', COALESCE(v_inspection.protocolo, v_inspection.id::text) || '.pdf'
  );
END;
$$;


REVOKE ALL ON FUNCTION public.portal_authorize_inspection_document(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_authorize_inspection_document(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
