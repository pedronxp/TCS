-- A fila de sincronização pertence ao armazenamento local do aplicativo.
-- Uma vistoria que já existe neste banco não pode ser marcada como pendente
-- somente por um campo legado ainda estar falso no registro remoto.

CREATE OR REPLACE FUNCTION public.get_internal_operational_statistics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inspections jsonb;
  v_sessions jsonb;
  v_events jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    private.has_internal_permission('dashboard.executive.read')
    OR private.has_internal_permission('dashboard.technical.read')
    OR private.has_internal_permission('technical.read')
  ) THEN
    RAISE EXCEPTION 'operational_statistics_not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total', count(*),
    'completed', count(*) FILTER (WHERE lower(coalesce(status, '')) IN ('concluida', 'concluída', 'completed')),
    'created_last_7_days', count(*) FILTER (WHERE "criadoEm" >= now() - interval '7 days'),
    -- O servidor não tem acesso à fila SQLite do dispositivo. Tudo que está
    -- nesta tabela já foi recebido pelo servidor, portanto não é pendência.
    'pending_sync', 0
  ) INTO v_inspections FROM public.vistorias;

  SELECT jsonb_build_object(
    'active', count(*) FILTER (WHERE status = 'active'),
    'stale', count(*) FILTER (WHERE status = 'active' AND (last_heartbeat_at IS NULL OR last_heartbeat_at < now() - interval '30 minutes'))
  ) INTO v_sessions FROM public.active_sessions;

  SELECT jsonb_build_object(
    'errors_last_24_hours', count(*) FILTER (WHERE severity IN ('error', 'critical') AND occurred_at >= now() - interval '24 hours'),
    'critical_last_24_hours', count(*) FILTER (WHERE severity = 'critical' AND occurred_at >= now() - interval '24 hours'),
    'last_event_at', max(occurred_at)
  ) INTO v_events FROM public.technical_events;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'inspections', v_inspections,
    'sessions', v_sessions,
    'events', v_events,
    'health', jsonb_build_array(
      jsonb_build_object('name', 'Console e API', 'status', 'operational', 'detail', 'A consulta autenticada respondeu normalmente.'),
      jsonb_build_object('name', 'Banco de dados', 'status', 'operational', 'detail', 'Métricas agregadas foram consultadas sem expor registros.'),
      jsonb_build_object('name', 'Sincronização', 'status', 'operational', 'detail', 'As vistorias exibidas já estão no servidor. Filas locais são acompanhadas diretamente no aplicativo.')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_internal_operational_statistics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_operational_statistics() TO authenticated;
NOTIFY pgrst, 'reload schema';
