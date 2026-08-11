-- Registra a consulta de detalhes de sessão no console sem armazenar dados
-- pessoais adicionais. A função aplica a permissão no banco, não no cliente.
CREATE OR REPLACE FUNCTION public.record_internal_session_review(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_internal_permission('session.read') THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.active_sessions WHERE id = p_session_id) THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.internal_access_events (
    actor_id, actor_role, action, target_type, target_id, result, metadata
  ) VALUES (
    auth.uid(), private.current_internal_role(auth.uid()), 'session.review',
    'active_session', p_session_id::text, 'allowed',
    jsonb_build_object('source', 'internal_console')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_internal_session_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_internal_session_review(uuid) TO authenticated;
