-- ENTRADA B4 — Contrato de suporte com timeline segura.
--
-- Princípios atendidos:
--  * Dados de suporte são isolados por organização/requester: o cliente só vê
--    a timeline de tickets que lhe pertencem (requester/user) ou da sua
--    organização (papel owner/coordinator/master/admin). O console interno
--    (support.write) vê tudo.
--  * Notas internas (visibility='internal') NUNCA aparecem na timeline do
--    cliente. Respostas internas (visibility='shared') aparecem na timeline
--    do cliente como mensagens do atendente.
--  * Toda ação de suporte é auditada em internal_access_events com ator, alvo
--    (ticket), justificativa/mensagem e resultado; notas internas registram
--    resultado, sem expor o conteúdo na auditoria de leitura do cliente.
--  * Resposta do cliente via RPC (portal_reply_support_ticket) — o navegador
--    não insere diretamente em support_ticket_events.
--
-- Armazenamento de visibility: coluna ausente na tabela original; usamos
-- metadata->>'visibility' ∈ {'shared','internal'} (default 'shared').

-- 1) Timeline do cliente (portal) --------------------------------------
-- Devolve apenas eventos visíveis ao cliente (visibility != 'internal') do
-- ticket, ordenados cronologicamente, além de metadados do ticket (datas,
-- prioridade, status). Escopo: requester_id/user_id = auth.uid() OU
-- organization_id = current_organization_id() com papel de gestor OU
-- is_owner_admin. Caso contrário, retorna vazio (não revela existência).
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
        'visibility', COALESCE(e.metadata->>'visibility','shared'),
        'created_at', e.created_at
      ) ORDER BY e.created_at)
      FROM public.support_ticket_events e
      WHERE e.ticket_id = p_ticket_id
        AND COALESCE(e.metadata->>'visibility','shared') <> 'internal'
    ), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_get_support_timeline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_get_support_timeline(uuid) TO authenticated;

-- 2) Resposta do cliente (portal) --------------------------------------
-- O cliente responde ao ticket. Insere um evento visibility='shared'
-- (visível ao atendente e na própria timeline do cliente) e atualiza o
-- status do ticket. Escopo igual ao portal_get_support_timeline.
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
  IF v_ticket.status = 'closed' THEN
    RAISE EXCEPTION 'ticket_closed' USING ERRCODE = '22023';
  END IF;

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

REVOKE ALL ON FUNCTION public.portal_reply_support_ticket(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_reply_support_ticket(uuid, text) TO authenticated;

-- 3) Nota INTERNA (nunca visível ao cliente) ---------------------------
-- Atendente registra uma nota interna (visibility='internal'). Não aparece
-- na timeline do cliente (portal_get_support_timeline filtra). Exige
-- support.write + AAL2 + justificativa. Auditada em internal_access_events.
CREATE OR REPLACE FUNCTION public.internal_add_support_note(
  p_ticket_id uuid,
  p_note text,
  p_reason text,
  p_operation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_event_id uuid;
  v_hash text;
  v_prior jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_ticket_id IS NULL THEN
    RAISE EXCEPTION 'ticket_id_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(COALESCE(p_note,''))) NOT BETWEEN 1 AND 8000 THEN
    RAISE EXCEPTION 'note_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(COALESCE(p_reason,''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  IF NOT private.has_internal_permission('support.write', v_actor) THEN
    RAISE EXCEPTION 'support_write_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN
    RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.support_tickets WHERE id = p_ticket_id) THEN
    RAISE EXCEPTION 'ticket_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_hash := md5(concat_ws('|', p_ticket_id, 'internal_note', trim(p_note), trim(p_reason)));
  IF p_operation_id IS NOT NULL THEN
    SELECT io.result INTO v_prior FROM public.internal_operations io
    WHERE io.actor_id = v_actor AND io.operation_id = p_operation_id AND io.request_hash = v_hash;
    IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;
    INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
    VALUES (p_operation_id, v_actor, 'support.internal_note', v_hash);
  END IF;

  INSERT INTO public.support_ticket_events(ticket_id, actor_id, event_type, message, metadata)
  VALUES (p_ticket_id, v_actor, 'internal_note', trim(p_note),
          jsonb_build_object('visibility','internal','source','console'))
  RETURNING id INTO v_event_id;

  -- Auditoria: registra o ato e a justificativa, sem expor o conteúdo da nota.
  INSERT INTO public.internal_access_events(
    actor_id, actor_role, action, target_type, target_id, result, reason, metadata
  ) VALUES (
    v_actor, private.current_internal_role(v_actor), 'support.internal_note',
    'support_ticket', p_ticket_id::text, 'allowed', left(trim(p_reason),500),
    jsonb_build_object('event_id', v_event_id, 'visibility','internal')
  );

  IF p_operation_id IS NOT NULL THEN
    UPDATE public.internal_operations
    SET status = 'succeeded',
        result = jsonb_build_object('ticket_id', p_ticket_id, 'event_id', v_event_id, 'visibility','internal'),
        completed_at = now()
    WHERE actor_id = v_actor AND operation_id = p_operation_id;
  END IF;

  RETURN jsonb_build_object('ticket_id', p_ticket_id, 'event_id', v_event_id, 'visibility', 'internal');
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_add_support_note(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_add_support_note(uuid, text, text, uuid) TO authenticated;

-- 4) Resposta INTERNA compartilhada (visível ao cliente) ---------------
-- Atendente responde ao cliente (visibility='shared'): aparece na timeline
-- do cliente. Exige support.write + AAL2 + justificativa. Auditada.
CREATE OR REPLACE FUNCTION public.internal_reply_support_ticket(
  p_ticket_id uuid,
  p_message text,
  p_reason text,
  p_operation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_event_id uuid;
  v_hash text;
  v_prior jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_ticket_id IS NULL THEN
    RAISE EXCEPTION 'ticket_id_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(COALESCE(p_message,''))) NOT BETWEEN 1 AND 8000 THEN
    RAISE EXCEPTION 'message_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(COALESCE(p_reason,''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  IF NOT private.has_internal_permission('support.write', v_actor) THEN
    RAISE EXCEPTION 'support_write_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN
    RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.support_tickets WHERE id = p_ticket_id) THEN
    RAISE EXCEPTION 'ticket_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_hash := md5(concat_ws('|', p_ticket_id, 'internal_reply', trim(p_message), trim(p_reason)));
  IF p_operation_id IS NOT NULL THEN
    SELECT io.result INTO v_prior FROM public.internal_operations io
    WHERE io.actor_id = v_actor AND io.operation_id = p_operation_id AND io.request_hash = v_hash;
    IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;
    INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
    VALUES (p_operation_id, v_actor, 'support.internal_reply', v_hash);
  END IF;

  INSERT INTO public.support_ticket_events(ticket_id, actor_id, event_type, message, metadata)
  VALUES (p_ticket_id, v_actor, 'staff_reply', trim(p_message),
          jsonb_build_object('visibility','shared','source','console'))
  RETURNING id INTO v_event_id;

  -- Marca como aguardando cliente após resposta interna.
  UPDATE public.support_tickets SET
    status = 'waiting_customer',
    updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO public.internal_access_events(
    actor_id, actor_role, action, target_type, target_id, result, reason, metadata
  ) VALUES (
    v_actor, private.current_internal_role(v_actor), 'support.internal_reply',
    'support_ticket', p_ticket_id::text, 'allowed', left(trim(p_reason),500),
    jsonb_build_object('event_id', v_event_id, 'visibility','shared')
  );

  IF p_operation_id IS NOT NULL THEN
    UPDATE public.internal_operations
    SET status = 'succeeded',
        result = jsonb_build_object('ticket_id', p_ticket_id, 'event_id', v_event_id, 'visibility','shared'),
        completed_at = now()
    WHERE actor_id = v_actor AND operation_id = p_operation_id;
  END IF;

  RETURN jsonb_build_object('ticket_id', p_ticket_id, 'event_id', v_event_id, 'visibility', 'shared');
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_reply_support_ticket(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_reply_support_ticket(uuid, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.portal_get_support_timeline(uuid) IS
  'Timeline do cliente: eventos do ticket visíveis (visibility!=internal), ordenados. Escopo requester/user/org-admin/owner. Notas internas nunca aparecem.';
COMMENT ON FUNCTION public.portal_reply_support_ticket(uuid, text) IS
  'Resposta do cliente via portal: insere evento visibility=shared. Escopo do cliente. Não permite escrever direto na tabela.';
COMMENT ON FUNCTION public.internal_add_support_note(uuid, text, text, uuid) IS
  'Nota interna do atendente (visibility=internal): nunca visível ao cliente. Exige support.write + AAL2 + justificativa. Idempotente e auditado (sem expor conteúdo).';
COMMENT ON FUNCTION public.internal_reply_support_ticket(uuid, text, text, uuid) IS
  'Resposta do atendente ao cliente (visibility=shared): aparece na timeline do cliente. Exige support.write + AAL2 + justificativa. Idempotente e auditado.';
