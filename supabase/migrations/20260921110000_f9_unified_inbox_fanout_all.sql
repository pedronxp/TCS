-- F9 — Fan-out universal para a caixa de entrada unificada (parte 1/3)
--
-- Contexto: a tabela notificacoes foi aposentada em 18/set/2026
-- (f2a_campaign_mirror_to_unified_inbox: REVOKE para anon/authenticated) e o
-- app lê o sino via get_my_inbox (domain_events + inbox_recipients). Os
-- avisos de F3 (cobrança), F7 (suporte), F8 (retenção) e os 5 gatilhos
-- legados fn_notificar_* nunca apareceram no app porque escreviam apenas na
-- tabela aposentada. Esta série (f9/f9b/f9c) mantém a escrita legada
-- (arquivo) e passa a emitir também o evento real da caixa de entrada.
-- Parte 1: helper compartilhado + gatilho de suporte (F7).

CREATE OR REPLACE FUNCTION private.emit_inbox_event(
  p_event_type text,
  p_module text,
  p_actor_context text,
  p_workspace text,
  p_actor uuid,
  p_org uuid,
  p_affected uuid,
  p_entity_type text,
  p_entity_id text,
  p_severity text,
  p_title text,
  p_body text,
  p_route text,
  p_payload jsonb,
  p_dedupe text,
  p_thread text,
  p_recipients uuid[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $body$
DECLARE
  v_event_id uuid;
BEGIN
  IF p_dedupe IS NOT NULL THEN
    SELECT id INTO v_event_id FROM public.domain_events WHERE dedupe_key = p_dedupe;
  END IF;

  IF v_event_id IS NULL THEN
    INSERT INTO public.domain_events (
      event_type, module_key, actor_context, actor_user_id, organization_id,
      affected_user_id, entity_type, entity_id, severity, title, body,
      route_key, payload, dedupe_key, thread_key
    ) VALUES (
      p_event_type, p_module, p_actor_context, p_actor, p_org,
      p_affected, p_entity_type, p_entity_id, p_severity, p_title, p_body,
      p_route, coalesce(p_payload, '{}'::jsonb), p_dedupe, p_thread
    )
    RETURNING id INTO v_event_id;
  END IF;

  IF v_event_id IS NOT NULL AND p_recipients IS NOT NULL THEN
    INSERT INTO public.inbox_recipients (event_id, recipient_user_id, workspace_kind, organization_id)
    SELECT v_event_id, recip, p_workspace, p_org
    FROM unnest(p_recipients) AS recip
    WHERE recip IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_event_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'emit_inbox_event falhou (% / %): %', p_event_type, p_dedupe, SQLERRM;
  RETURN NULL;
END;
$body$;

REVOKE ALL ON FUNCTION private.emit_inbox_event(text,text,text,text,uuid,uuid,uuid,text,text,text,text,text,text,jsonb,text,text,uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_ticket_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_requester uuid; v_subject text; v_code text;
  v_org uuid; v_ws text;
BEGIN
  IF NEW.event_type <> 'message' THEN RETURN NEW; END IF;

  SELECT t.requester_id, t.subject, t.public_code INTO v_requester, v_subject, v_code
  FROM public.support_tickets t WHERE t.id = NEW.ticket_id;

  IF v_requester IS NULL OR v_requester = NEW.actor_id THEN RETURN NEW; END IF;

  INSERT INTO public.notificacoes (tipo, titulo, corpo, destinatario_uid, payload, lida, criada_em)
  VALUES (
    'suporte_resposta',
    'Resposta no seu chamado',
    coalesce(v_code,'Chamado') || ' — ' || coalesce(v_subject,'suporte'),
    v_requester::text,
    jsonb_build_object('ticket_id', NEW.ticket_id, 'event_id', NEW.id),
    false, now()
  );

  SELECT om.organization_id INTO v_org
  FROM public.organization_members om
  WHERE om.user_id = v_requester AND om.status = 'active'
  ORDER BY om.joined_at DESC LIMIT 1;
  v_ws := CASE WHEN v_org IS NOT NULL THEN 'organization' ELSE 'individual' END;

  PERFORM private.emit_inbox_event(
    'support.ticket_reply', 'support', v_ws, v_ws, NEW.actor_id, v_org, v_requester,
    'support_ticket', NEW.ticket_id::text, 'info',
    'Resposta no seu chamado',
    coalesce(v_code,'Chamado') || ' — ' || coalesce(v_subject,'suporte') || ': toque para acompanhar.',
    'suporte',
    jsonb_build_object('ticket_id', NEW.ticket_id, 'event_id', NEW.id),
    'support_reply:' || NEW.id::text,
    'support_ticket:' || NEW.ticket_id::text,
    ARRAY[v_requester]
  );

  RETURN NEW;
END $function$;
