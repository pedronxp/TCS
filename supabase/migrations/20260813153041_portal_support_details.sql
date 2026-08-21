-- Expõe os detalhes de chamados apenas para o próprio usuário ou organização ativa.
CREATE OR REPLACE FUNCTION public.portal_get_workspace(p_section text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_items jsonb;
  v_summary jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  v_org := private.current_organization_id(v_user);
  v_summary := '{}'::jsonb;
  v_items := '[]'::jsonb;

  IF p_section = 'suporte' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', t.id,
      'title', t.subject,
      'subtitle', t.public_code,
      'status', t.status,
      'priority', t.priority,
      'category', t.category,
      'description', t.description,
      'created_at', t.created_at
    ) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM public.support_tickets t
    WHERE (v_org IS NOT NULL AND t.organization_id = v_org)
       OR (v_org IS NULL AND t.user_id = v_user);

    SELECT jsonb_build_object(
      'total', count(*),
      'open', count(*) FILTER (WHERE status NOT IN ('resolved', 'closed', 'canceled')),
      'overdue', count(*) FILTER (WHERE resolution_due_at IS NOT NULL AND resolution_due_at < now() AND status NOT IN ('resolved', 'closed'))
    )
    INTO v_summary
    FROM public.support_tickets t
    WHERE (v_org IS NOT NULL AND t.organization_id = v_org)
       OR (v_org IS NULL AND t.user_id = v_user);
  END IF;

  RETURN jsonb_build_object('section', p_section, 'items', v_items, 'summary', v_summary);
END;
$function$;

COMMENT ON FUNCTION public.portal_get_workspace(text) IS 'Retorna itens do workspace do portal por seção, incluindo detalhes de chamados apenas no escopo autorizado.';
