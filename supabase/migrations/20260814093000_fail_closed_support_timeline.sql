-- CORREÇÃO P0/P1 — Fail-closed para eventos de suporte no portal.
--
-- Bloqueios corrigidos:
-- 1. Somente eventos explicitamente shared (visibility='shared') podem aparecer
--    no portal. internal, ausência de visibility e valores desconhecidos NÃO
--    aparecem (fail-closed).
-- 2. Checagem de status 'closed' deve ser feita DEPOIS de carregar o ticket,
--    não antes (a linha 133 original verifica v_ticket.status antes de SELECT).

-- CORREÇÃO 1: Fail-closed para visibility: apenas 'shared' explícito aparece.
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

-- CORREÇÃO 2: Checagem de status 'closed' após carregar o ticket.
CREATE OR REPLACE FUNCTION public.portal_reply_support_ticket(
  p_ticket_id uuid,
  p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ticket public.support_tickets;
  v_org uuid;
  v_can_see boolean := false;
  v_event_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_ticket_id IS NULL THEN
    RAISE EXCEPTION 'ticket_id_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(COALESCE(p_message,''))) NOT BETWEEN 1 AND 8000 THEN
    RAISE EXCEPTION 'message_required' USING ERRCODE = '22023';
  END IF;

  -- CORREÇÃO 2: Carregar ticket ANTES de checar status.
  SELECT * INTO v_ticket FROM public.support_tickets
  WHERE id = p_ticket_id FOR UPDATE;
  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'ticket_not_found' USING ERRCODE = 'P0002';
  END IF;

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
    -- Não distingue "não existe" de "sem escopo": protege metadados.
    RAISE EXCEPTION 'ticket_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Agora sim, checar status após carregar.
  IF v_ticket.status = 'closed' THEN
    RAISE EXCEPTION 'ticket_closed' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.support_ticket_events(ticket_id, actor_id, event_type, message, metadata)
  VALUES (p_ticket_id, v_uid, 'client_message', trim(p_message),
          jsonb_build_object('visibility','shared','source','portal'))
  RETURNING id INTO v_event_id;

  -- Reabre o ticket se estava aguardando cliente; caso contrário mantém.
  UPDATE public.support_tickets SET
    status = CASE WHEN status = 'waiting_customer' THEN 'in_progress' ELSE status END,
    updated_at = now()
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object('ticket_id', p_ticket_id, 'event_id', v_event_id, 'visibility', 'shared');
END;
$function$;

COMMENT ON FUNCTION public.portal_reply_support_ticket(uuid, text) IS
  'Resposta do cliente via portal: insere evento visibility=shared. Escopo do cliente. Valida status após carregar o ticket. Não permite escrever direto na tabela.';
