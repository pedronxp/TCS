-- ============================================================
-- F7 — Suporte in-app: cliente acompanha e responde tickets
-- (Aplicada via MCP; arquivo espelha o remoto)
-- ============================================================

CREATE OR REPLACE FUNCTION public.reply_support_ticket(p_ticket_id uuid, p_message text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_ticket public.support_tickets;
  v_msg text := btrim(coalesce(p_message,''));
BEGIN
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found' USING ERRCODE='P0002'; END IF;
  IF NOT (v_ticket.requester_id = auth.uid() OR v_ticket.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF char_length(v_msg) NOT BETWEEN 2 AND 5000 THEN
    RAISE EXCEPTION 'invalid_message' USING ERRCODE='22023'; END IF;

  INSERT INTO public.support_ticket_events (ticket_id, actor_id, event_type, message, metadata)
  VALUES (p_ticket_id, auth.uid(), 'customer_reply', v_msg, jsonb_build_object('visibility','shared'));

  UPDATE public.support_tickets
  SET status = CASE WHEN status IN ('resolved','closed','waiting_customer') THEN 'open' ELSE status END,
      updated_at = now()
  WHERE id = p_ticket_id;
END $$;
REVOKE ALL ON FUNCTION public.reply_support_ticket(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_support_ticket(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_ticket_events(p_ticket_id uuid)
RETURNS SETOF public.support_ticket_events
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = p_ticket_id
      AND (t.requester_id = auth.uid() OR t.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  SELECT e.* FROM public.support_ticket_events e
  WHERE e.ticket_id = p_ticket_id
    AND coalesce(e.metadata->>'visibility','shared') <> 'internal'
  ORDER BY e.created_at;
END $$;
REVOKE ALL ON FUNCTION public.my_ticket_events(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_ticket_events(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_requester uuid;
  v_subject text;
  v_code text;
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
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_ticket_reply ON public.support_ticket_events;
CREATE TRIGGER trg_notify_ticket_reply
AFTER INSERT ON public.support_ticket_events
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_reply();

ALTER TABLE public.notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_tipo_check
CHECK (tipo = ANY (ARRAY['alto_risco','formulario_novo','novo_usuario','limite_firebase','token_usado','atribuicao_nova','cobranca','qe_devolvida','suporte_resposta']));
