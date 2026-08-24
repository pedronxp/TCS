-- Heartbeats do worker e das sessões. Os dados operacionais ficam no schema
-- private; o painel recebe somente o resumo autorizado por organização.

CREATE TABLE private.bot_worker_runtime (
  worker_id text PRIMARY KEY,
  state text NOT NULL DEFAULT 'online',
  version text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_worker_runtime_state_valid CHECK (state IN ('online', 'stopping')),
  CONSTRAINT bot_worker_runtime_worker_id_len CHECK (char_length(worker_id) BETWEEN 1 AND 160)
);

CREATE TABLE private.bot_session_runtime (
  session_id uuid PRIMARY KEY REFERENCES public.bot_sessoes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id text NOT NULL,
  state text NOT NULL,
  last_error text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_transition_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_session_runtime_state_valid CHECK (
    state IN ('starting', 'awaiting_qr', 'online', 'reconnecting', 'paused', 'offline', 'banned')
  ),
  CONSTRAINT bot_session_runtime_worker_id_len CHECK (char_length(worker_id) BETWEEN 1 AND 160),
  CONSTRAINT bot_session_runtime_error_len CHECK (last_error IS NULL OR char_length(last_error) <= 500)
);

CREATE INDEX bot_session_runtime_org_seen_idx
  ON private.bot_session_runtime (organization_id, last_seen_at DESC);

CREATE TABLE private.bot_organization_runtime (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  state text NOT NULL,
  last_seen_at timestamptz,
  last_transition_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_organization_runtime_state_valid CHECK (
    state IN ('online', 'degraded', 'reconnecting', 'awaiting_qr', 'paused',
              'offline', 'service_offline', 'unconfigured', 'banned')
  )
);

ALTER TABLE private.bot_worker_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.bot_session_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.bot_organization_runtime ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.bot_worker_runtime,
  private.bot_session_runtime, private.bot_organization_runtime
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.bot_worker_runtime,
  private.bot_session_runtime, private.bot_organization_runtime
  TO service_role;

CREATE OR REPLACE FUNCTION private.bot_organization_runtime_snapshot(p_organization_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH worker AS (
    SELECT
      EXISTS (
        SELECT 1
        FROM private.bot_worker_runtime runtime
        WHERE runtime.state = 'online'
          AND runtime.last_seen_at >= now() - interval '90 seconds'
      ) AS online,
      max(runtime.last_seen_at) AS last_seen_at
    FROM private.bot_worker_runtime runtime
  ), sessions AS (
    SELECT
      count(*)::integer AS total,
      count(*) FILTER (
        WHERE session_runtime.state = 'online'
          AND session_runtime.last_seen_at >= now() - interval '90 seconds'
      )::integer AS online,
      count(*) FILTER (
        WHERE session_runtime.state IN ('starting', 'reconnecting')
          AND session_runtime.last_seen_at >= now() - interval '90 seconds'
      )::integer AS reconnecting,
      count(*) FILTER (
        WHERE session.status = 'aguardando_qr'
          OR (
            session_runtime.state = 'awaiting_qr'
            AND session_runtime.last_seen_at >= now() - interval '90 seconds'
          )
      )::integer AS awaiting_qr,
      count(*) FILTER (
        WHERE session.status = 'banido' OR session_runtime.state = 'banned'
      )::integer AS banned,
      count(*) FILTER (
        WHERE session.status = 'desconectado' OR session_runtime.state = 'paused'
      )::integer AS paused,
      count(*) FILTER (
        WHERE session.status = 'vinculado'
          AND (
            session_runtime.session_id IS NULL
            OR session_runtime.state = 'offline'
            OR session_runtime.last_seen_at < now() - interval '90 seconds'
          )
      )::integer AS offline,
      max(session_runtime.last_seen_at) AS last_seen_at
    FROM public.bot_sessoes session
    LEFT JOIN private.bot_session_runtime session_runtime ON session_runtime.session_id = session.id
    WHERE session.organization_id = p_organization_id
  ), calculated AS (
    SELECT
      CASE
        WHEN NOT worker.online THEN 'service_offline'
        WHEN sessions.total = 0 THEN 'unconfigured'
        WHEN sessions.online > 0 AND sessions.online < sessions.total THEN 'degraded'
        WHEN sessions.online > 0 THEN 'online'
        WHEN sessions.reconnecting > 0 THEN 'reconnecting'
        WHEN sessions.awaiting_qr > 0 THEN 'awaiting_qr'
        WHEN sessions.offline > 0 THEN 'offline'
        WHEN sessions.banned = sessions.total THEN 'banned'
        WHEN sessions.paused > 0 THEN 'paused'
        ELSE 'offline'
      END AS state,
      worker.online AS service_online,
      worker.last_seen_at AS service_last_seen_at,
      sessions.*
    FROM worker CROSS JOIN sessions
  )
  SELECT jsonb_build_object(
    'organization_id', p_organization_id,
    'state', calculated.state,
    'service_online', calculated.service_online,
    'service_last_seen_at', calculated.service_last_seen_at,
    'last_seen_at', calculated.last_seen_at,
    'sessions_total', calculated.total,
    'sessions_online', calculated.online,
    'sessions_reconnecting', calculated.reconnecting,
    'sessions_awaiting_qr', calculated.awaiting_qr,
    'sessions_paused', calculated.paused,
    'sessions_offline', calculated.offline,
    'sessions_banned', calculated.banned
  )
  FROM calculated;
$$;

CREATE OR REPLACE FUNCTION private.refresh_bot_organization_runtime(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_snapshot jsonb := private.bot_organization_runtime_snapshot(p_organization_id);
  v_previous_state text;
  v_state text := v_snapshot->>'state';
  v_last_seen_at timestamptz := NULLIF(v_snapshot->>'last_seen_at', '')::timestamptz;
  v_title text;
  v_body text;
  v_severity text;
BEGIN
  SELECT runtime.state INTO v_previous_state
  FROM private.bot_organization_runtime runtime
  WHERE runtime.organization_id = p_organization_id
  FOR UPDATE;

  INSERT INTO private.bot_organization_runtime (
    organization_id, state, last_seen_at, last_transition_at, updated_at
  ) VALUES (
    p_organization_id, v_state, v_last_seen_at, now(), now()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    state = EXCLUDED.state,
    last_seen_at = EXCLUDED.last_seen_at,
    last_transition_at = CASE
      WHEN private.bot_organization_runtime.state IS DISTINCT FROM EXCLUDED.state THEN now()
      ELSE private.bot_organization_runtime.last_transition_at
    END,
    updated_at = now();

  IF v_previous_state IS NOT NULL AND v_previous_state IS DISTINCT FROM v_state THEN
    v_title := CASE v_state
      WHEN 'online' THEN 'WhatsApp da organização voltou a operar'
      WHEN 'degraded' THEN 'WhatsApp operando parcialmente'
      WHEN 'reconnecting' THEN 'WhatsApp tentando reconectar'
      WHEN 'awaiting_qr' THEN 'WhatsApp aguardando QR Code'
      WHEN 'paused' THEN 'WhatsApp da organização pausado'
      WHEN 'service_offline' THEN 'Serviço do WhatsApp fora do ar'
      WHEN 'unconfigured' THEN 'WhatsApp ainda não configurado'
      WHEN 'banned' THEN 'Número do WhatsApp requer substituição'
      ELSE 'WhatsApp da organização fora do ar'
    END;
    v_body := CASE v_state
      WHEN 'online' THEN 'Todos os números ativos da organização estão prontos para enviar mensagens.'
      WHEN 'degraded' THEN 'Existe pelo menos um número online, mas outra sessão precisa de atenção.'
      WHEN 'reconnecting' THEN 'O serviço está online e tenta restabelecer a conexão do número.'
      WHEN 'awaiting_qr' THEN 'A leitura do QR Code precisa ser concluída para ativar o número.'
      WHEN 'paused' THEN 'Os números desta organização estão pausados no painel.'
      WHEN 'service_offline' THEN 'O Docker do bot deixou de enviar heartbeat; mensagens permanecerão na fila.'
      WHEN 'unconfigured' THEN 'A organização ainda não possui número configurado no bot.'
      WHEN 'banned' THEN 'Todos os números configurados estão marcados como banidos.'
      ELSE 'Nenhum número desta organização está conectado ao WhatsApp agora.'
    END;
    v_severity := CASE v_state
      WHEN 'online' THEN 'success'
      WHEN 'degraded' THEN 'warning'
      WHEN 'reconnecting' THEN 'warning'
      WHEN 'awaiting_qr' THEN 'info'
      WHEN 'paused' THEN 'info'
      WHEN 'unconfigured' THEN 'warning'
      WHEN 'banned' THEN 'critical'
      ELSE 'error'
    END;

    PERFORM private.emit_domain_event(
      'whatsapp.organization.' || v_state,
      'whatsapp',
      'system',
      p_organization_id,
      NULL,
      'organization_bot_runtime',
      p_organization_id::text,
      v_severity,
      v_title,
      v_body,
      'whatsapp.sessions',
      jsonb_build_object('state', v_state, 'previous_state', v_previous_state),
      NULL,
      'whatsapp-runtime:' || p_organization_id::text,
      NULL
    );
  END IF;

  RETURN v_snapshot || jsonb_build_object(
    'last_transition_at', (
      SELECT runtime.last_transition_at
      FROM private.bot_organization_runtime runtime
      WHERE runtime.organization_id = p_organization_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_report_worker_heartbeat(
  p_worker_id text,
  p_state text DEFAULT 'online',
  p_version text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_worker_id IS NULL OR char_length(p_worker_id) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'invalid_worker_id' USING ERRCODE = '22023';
  END IF;
  IF p_state NOT IN ('online', 'stopping') THEN
    RAISE EXCEPTION 'invalid_worker_state' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.bot_worker_runtime (
    worker_id, state, version, started_at, last_seen_at, updated_at
  ) VALUES (
    p_worker_id, p_state, left(p_version, 80), now(), now(), now()
  )
  ON CONFLICT (worker_id) DO UPDATE SET
    state = EXCLUDED.state,
    version = COALESCE(EXCLUDED.version, private.bot_worker_runtime.version),
    last_seen_at = now(),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_report_session_runtime(
  p_session_id uuid,
  p_worker_id text,
  p_state text,
  p_last_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid;
BEGIN
  IF p_worker_id IS NULL OR char_length(p_worker_id) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'invalid_worker_id' USING ERRCODE = '22023';
  END IF;
  IF p_state NOT IN ('starting', 'awaiting_qr', 'online', 'reconnecting', 'paused', 'offline', 'banned') THEN
    RAISE EXCEPTION 'invalid_session_state' USING ERRCODE = '22023';
  END IF;

  SELECT session.organization_id INTO v_organization_id
  FROM public.bot_sessoes session
  WHERE session.id = p_session_id;
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO private.bot_session_runtime (
    session_id, organization_id, worker_id, state, last_error,
    last_seen_at, last_transition_at, updated_at
  ) VALUES (
    p_session_id, v_organization_id, p_worker_id, p_state, left(p_last_error, 500),
    now(), now(), now()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    worker_id = EXCLUDED.worker_id,
    state = EXCLUDED.state,
    last_error = EXCLUDED.last_error,
    last_seen_at = now(),
    last_transition_at = CASE
      WHEN private.bot_session_runtime.state IS DISTINCT FROM EXCLUDED.state THEN now()
      ELSE private.bot_session_runtime.last_transition_at
    END,
    updated_at = now();

  PERFORM private.refresh_bot_organization_runtime(v_organization_id);
END;
$$;

CREATE OR REPLACE FUNCTION private.bot_runtime_with_sessions(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_runtime jsonb;
BEGIN
  v_runtime := private.refresh_bot_organization_runtime(p_organization_id);
  RETURN v_runtime || jsonb_build_object(
    'sessions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', session.id,
        'telefone', public.mascarar_telefone(session.telefone),
        'database_status', session.status,
        'runtime_state', CASE
          WHEN session_runtime.last_seen_at < now() - interval '90 seconds' THEN 'offline'
          ELSE session_runtime.state
        END,
        'last_seen_at', session_runtime.last_seen_at,
        'last_transition_at', session_runtime.last_transition_at,
        'last_error', session_runtime.last_error
      ) ORDER BY session.criado_em DESC)
      FROM public.bot_sessoes session
      LEFT JOIN private.bot_session_runtime session_runtime ON session_runtime.session_id = session.id
      WHERE session.organization_id = p_organization_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_bot_runtime_status()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid := private.current_organization_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF v_organization_id IS NULL
     OR NOT private.has_whatsapp_module_access(auth.uid(), v_organization_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN private.bot_runtime_with_sessions(v_organization_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_list_bot_runtime_status()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(private.bot_runtime_with_sessions(organization.id) ORDER BY organization.display_name)
    FROM public.organizations organization
    WHERE private.whatsapp_org_enabled(organization.id)
       OR EXISTS (
         SELECT 1 FROM public.bot_sessoes session
         WHERE session.organization_id = organization.id
       )
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_bot_runtime_status(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN private.bot_runtime_with_sessions(p_organization_id);
END;
$$;

REVOKE ALL ON FUNCTION private.bot_organization_runtime_snapshot(uuid),
  private.refresh_bot_organization_runtime(uuid),
  private.bot_runtime_with_sessions(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.bot_report_worker_heartbeat(text, text, text),
  public.bot_report_session_runtime(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_report_worker_heartbeat(text, text, text),
  public.bot_report_session_runtime(uuid, text, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.portal_bot_runtime_status(),
  public.internal_list_bot_runtime_status(),
  public.internal_bot_runtime_status(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_bot_runtime_status(),
  public.internal_list_bot_runtime_status(),
  public.internal_bot_runtime_status(uuid)
  TO authenticated;
