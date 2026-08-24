-- Fundação da central de mensagens, acesso independente ao WhatsApp e tours.
-- As tabelas expostas usam RLS e grants explícitos (Data API 2026).

CREATE TABLE public.organization_module_entitlements (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, module_key),
  CONSTRAINT organization_module_entitlements_key_len
    CHECK (char_length(module_key) BETWEEN 2 AND 80)
);

CREATE TABLE public.organization_module_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, module_key),
  CONSTRAINT organization_module_members_key_len
    CHECK (char_length(module_key) BETWEEN 2 AND 80)
);

CREATE INDEX organization_module_members_user_idx
  ON public.organization_module_members (user_id, module_key);

CREATE TABLE public.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  module_key text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_context text NOT NULL DEFAULT 'system',
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  affected_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text,
  entity_id text,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text NOT NULL,
  route_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid,
  dedupe_key text,
  thread_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_events_actor_context_valid
    CHECK (actor_context IN ('internal', 'organization', 'individual', 'system')),
  CONSTRAINT domain_events_severity_valid
    CHECK (severity IN ('info', 'success', 'warning', 'error', 'critical')),
  CONSTRAINT domain_events_title_len CHECK (char_length(title) BETWEEN 1 AND 160),
  CONSTRAINT domain_events_body_len CHECK (char_length(body) BETWEEN 1 AND 1200)
);

CREATE UNIQUE INDEX domain_events_dedupe_key_idx
  ON public.domain_events (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX domain_events_org_created_idx
  ON public.domain_events (organization_id, created_at DESC);
CREATE INDEX domain_events_module_created_idx
  ON public.domain_events (module_key, created_at DESC);

CREATE TABLE public.inbox_recipients (
  event_id uuid NOT NULL REFERENCES public.domain_events(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_kind text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, recipient_user_id, workspace_kind),
  CONSTRAINT inbox_recipients_workspace_valid
    CHECK (workspace_kind IN ('internal', 'organization', 'individual'))
);

CREATE INDEX inbox_recipients_unread_idx
  ON public.inbox_recipients (recipient_user_id, workspace_kind, created_at DESC)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

CREATE TABLE public.user_tutorial_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_kind text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tutorial_key text NOT NULL,
  tutorial_version integer NOT NULL DEFAULT 1,
  suppressed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_tutorial_workspace_valid
    CHECK (workspace_kind IN ('internal', 'organization', 'individual')),
  CONSTRAINT user_tutorial_version_valid CHECK (tutorial_version > 0)
);

CREATE UNIQUE INDEX user_tutorial_preference_scope_key
  ON public.user_tutorial_preferences (
    user_id,
    workspace_kind,
    COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    tutorial_key,
    tutorial_version
  );

CREATE TABLE public.whatsapp_group_bairros (
  sessao_id uuid NOT NULL,
  chat_id text NOT NULL,
  bairro_id uuid NOT NULL REFERENCES public.bairros(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  validated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (sessao_id, chat_id, bairro_id),
  FOREIGN KEY (sessao_id, chat_id)
    REFERENCES public.bot_chats(sessao_id, chat_id) ON DELETE CASCADE
);

CREATE INDEX whatsapp_group_bairros_org_bairro_idx
  ON public.whatsapp_group_bairros (organization_id, bairro_id, active);

CREATE TABLE private.bot_auth_state (
  session_id uuid NOT NULL REFERENCES public.bot_sessoes(id) ON DELETE CASCADE,
  key_category text NOT NULL,
  key_id text NOT NULL,
  encrypted_payload text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, key_category, key_id)
);

ALTER TABLE public.organization_module_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_module_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tutorial_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_group_bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.bot_auth_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.organization_module_entitlements,
  public.organization_module_members, public.domain_events,
  public.inbox_recipients, public.user_tutorial_preferences,
  public.whatsapp_group_bairros, private.bot_auth_state
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.inbox_recipients TO authenticated;
GRANT ALL ON TABLE public.organization_module_entitlements,
  public.organization_module_members, public.domain_events,
  public.inbox_recipients, public.user_tutorial_preferences,
  public.whatsapp_group_bairros, private.bot_auth_state TO service_role;

CREATE POLICY inbox_recipients_own_select
  ON public.inbox_recipients FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = recipient_user_id);

-- O piloto começa somente na organização de Cataguases.
INSERT INTO public.organization_module_entitlements (
  organization_id, module_key, enabled, configuration
)
SELECT id, 'whatsapp', true, jsonb_build_object('rollout', 'pilot')
FROM public.organizations
WHERE lower(coalesce(municipality_name, '')) = 'cataguases'
   OR lower(display_name) LIKE '%cataguases%'
ON CONFLICT (organization_id, module_key) DO UPDATE
SET enabled = EXCLUDED.enabled,
    configuration = public.organization_module_entitlements.configuration || EXCLUDED.configuration,
    updated_at = now();

CREATE OR REPLACE FUNCTION private.whatsapp_org_enabled(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_module_entitlements entitlement
    WHERE entitlement.organization_id = p_organization_id
      AND entitlement.module_key = 'whatsapp'
      AND entitlement.enabled
  );
$$;

CREATE OR REPLACE FUNCTION private.has_whatsapp_module_access(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.whatsapp_org_enabled(p_organization_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.internal_staff staff
        WHERE staff.user_id = p_user_id
          AND staff.status = 'active'
          AND staff.role IN ('owner', 'developer', 'support', 'auditor')
      )
      OR EXISTS (
        SELECT 1 FROM public.organization_members member
        WHERE member.organization_id = p_organization_id
          AND member.user_id = p_user_id
          AND member.status = 'active'
          AND (
            member.role = 'master'
            OR EXISTS (
              SELECT 1 FROM public.organization_module_members access
              WHERE access.organization_id = member.organization_id
                AND access.user_id = member.user_id
                AND access.module_key = 'whatsapp'
            )
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION private.whatsapp_org_enabled(uuid),
  private.has_whatsapp_module_access(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- Acrescenta permissões internas sem apagar overrides ou permissões futuras.
ALTER FUNCTION private.is_valid_internal_permission(text)
  RENAME TO is_valid_internal_permission_before_whatsapp;
CREATE FUNCTION private.is_valid_internal_permission(p_permission text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT private.is_valid_internal_permission_before_whatsapp(p_permission)
    OR p_permission = ANY (ARRAY[
      'whatsapp.read', 'whatsapp.recover', 'whatsapp.manage'
    ]::text[]);
$$;

ALTER FUNCTION private.internal_permissions(text)
  RENAME TO internal_permissions_before_whatsapp;
CREATE FUNCTION private.internal_permissions(p_role text)
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT private.internal_permissions_before_whatsapp(p_role)
    || CASE p_role
      WHEN 'owner' THEN ARRAY['whatsapp.read', 'whatsapp.recover', 'whatsapp.manage']::text[]
      WHEN 'developer' THEN ARRAY['whatsapp.read', 'whatsapp.recover', 'whatsapp.manage']::text[]
      WHEN 'support' THEN ARRAY['whatsapp.read', 'whatsapp.recover']::text[]
      WHEN 'auditor' THEN ARRAY['whatsapp.read']::text[]
      ELSE ARRAY[]::text[]
    END;
$$;

-- O contexto do portal passa a devolver whatsapp.read/write somente para
-- organizações habilitadas e membros escolhidos pela própria organização.
ALTER FUNCTION public.get_portal_access_context()
  RENAME TO get_portal_access_context_before_whatsapp;
REVOKE ALL ON FUNCTION public.get_portal_access_context_before_whatsapp()
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_portal_access_context()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_context jsonb;
  v_org uuid;
  v_permissions jsonb;
BEGIN
  v_context := public.get_portal_access_context_before_whatsapp();
  IF v_context IS NULL OR v_context->>'account_kind' <> 'organization' THEN
    RETURN v_context;
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;
  IF NOT private.has_whatsapp_module_access(auth.uid(), v_org) THEN
    RETURN v_context;
  END IF;
  v_permissions := COALESCE(v_context->'permissions', '[]'::jsonb)
    || jsonb_build_array('whatsapp.read', 'whatsapp.write');
  RETURN jsonb_set(v_context, '{permissions}', (
    SELECT jsonb_agg(DISTINCT permission)
    FROM jsonb_array_elements(v_permissions) permission
  ));
END;
$$;
REVOKE ALL ON FUNCTION public.get_portal_access_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_access_context() TO authenticated;

CREATE OR REPLACE FUNCTION private.emit_domain_event(
  p_event_type text,
  p_module_key text,
  p_actor_context text,
  p_organization_id uuid,
  p_affected_user_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_severity text,
  p_title text,
  p_body text,
  p_route_key text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_dedupe_key text DEFAULT NULL,
  p_thread_key text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.domain_events (
    event_type, module_key, actor_user_id, actor_context, organization_id,
    affected_user_id, entity_type, entity_id, severity, title, body,
    route_key, payload, dedupe_key, thread_key
  ) VALUES (
    left(p_event_type, 120), left(p_module_key, 80), p_actor_user_id,
    p_actor_context, p_organization_id, p_affected_user_id,
    left(p_entity_type, 80), left(p_entity_id, 160), p_severity,
    left(p_title, 160), left(p_body, 1200), left(p_route_key, 120),
    private.sanitize_internal_metadata(COALESCE(p_payload, '{}'::jsonb)),
    left(p_dedupe_key, 240), left(p_thread_key, 160)
  )
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
  DO UPDATE SET dedupe_key = EXCLUDED.dedupe_key
  RETURNING id INTO v_event_id;

  IF p_actor_user_id IS NOT NULL THEN
    INSERT INTO public.inbox_recipients (
      event_id, recipient_user_id, workspace_kind, organization_id
    )
    VALUES (
      v_event_id, p_actor_user_id,
      CASE p_actor_context
        WHEN 'internal' THEN 'internal'
        WHEN 'individual' THEN 'individual'
        ELSE 'organization'
      END,
      CASE WHEN p_actor_context = 'organization' THEN p_organization_id END
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF p_affected_user_id IS NOT NULL AND p_affected_user_id <> p_actor_user_id THEN
    INSERT INTO public.inbox_recipients (
      event_id, recipient_user_id, workspace_kind, organization_id
    ) VALUES (
      v_event_id, p_affected_user_id,
      CASE WHEN p_organization_id IS NULL THEN 'individual' ELSE 'organization' END,
      p_organization_id
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF p_organization_id IS NOT NULL THEN
    INSERT INTO public.inbox_recipients (
      event_id, recipient_user_id, workspace_kind, organization_id
    )
    SELECT v_event_id, member.user_id, 'organization', p_organization_id
    FROM public.organization_members member
    WHERE member.organization_id = p_organization_id
      AND member.status = 'active'
      AND (
        member.role = 'master'
        OR EXISTS (
          SELECT 1 FROM public.organization_module_members module_member
          WHERE module_member.organization_id = member.organization_id
            AND module_member.user_id = member.user_id
            AND module_member.module_key = p_module_key
        )
      )
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.inbox_recipients (
    event_id, recipient_user_id, workspace_kind
  )
  SELECT v_event_id, staff.user_id, 'internal'
  FROM public.internal_staff staff
  WHERE staff.status = 'active'
    AND (
      staff.role IN ('owner', 'developer')
      OR (staff.role = 'support' AND p_severity IN ('warning', 'error', 'critical'))
    )
  ON CONFLICT DO NOTHING;

  RETURN v_event_id;
END;
$$;
REVOKE ALL ON FUNCTION private.emit_domain_event(
  text, text, text, uuid, uuid, text, text, text, text, text, text,
  jsonb, text, text, uuid
) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_my_inbox(
  p_workspace_kind text,
  p_limit integer DEFAULT 50,
  p_unread_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_workspace_kind NOT IN ('internal', 'organization', 'individual')
     OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid_inbox_query' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'unread_count', (
      SELECT count(*) FROM public.inbox_recipients recipient
      WHERE recipient.recipient_user_id = auth.uid()
        AND recipient.workspace_kind = p_workspace_kind
        AND recipient.read_at IS NULL AND recipient.dismissed_at IS NULL
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', event.id,
        'event_type', event.event_type,
        'module_key', event.module_key,
        'severity', event.severity,
        'title', event.title,
        'body', event.body,
        'route_key', event.route_key,
        'organization_id', event.organization_id,
        'entity_type', event.entity_type,
        'entity_id', event.entity_id,
        'payload', event.payload,
        'thread_key', event.thread_key,
        'created_at', event.created_at,
        'read_at', recipient.read_at
      ) ORDER BY event.created_at DESC)
      FROM (
        SELECT event_id, read_at
        FROM public.inbox_recipients
        WHERE recipient_user_id = auth.uid()
          AND workspace_kind = p_workspace_kind
          AND dismissed_at IS NULL
          AND (NOT p_unread_only OR read_at IS NULL)
        ORDER BY created_at DESC
        LIMIT p_limit
      ) recipient
      JOIN public.domain_events event ON event.id = recipient.event_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.mark_inbox_message_read(
  p_event_id uuid,
  p_workspace_kind text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.inbox_recipients
  SET read_at = COALESCE(read_at, now())
  WHERE event_id = p_event_id
    AND recipient_user_id = auth.uid()
    AND workspace_kind = p_workspace_kind;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.mark_all_inbox_messages_read(p_workspace_kind text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.inbox_recipients SET read_at = now()
  WHERE recipient_user_id = auth.uid()
    AND workspace_kind = p_workspace_kind
    AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE FUNCTION public.get_tutorial_preference(
  p_workspace_kind text,
  p_organization_id uuid,
  p_tutorial_key text,
  p_tutorial_version integer
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT jsonb_build_object(
      'suppressed', preference.suppressed,
      'completed_at', preference.completed_at,
      'updated_at', preference.updated_at
    )
    FROM public.user_tutorial_preferences preference
    WHERE preference.user_id = auth.uid()
      AND preference.workspace_kind = p_workspace_kind
      AND preference.organization_id IS NOT DISTINCT FROM p_organization_id
      AND preference.tutorial_key = p_tutorial_key
      AND preference.tutorial_version = p_tutorial_version
  ), jsonb_build_object('suppressed', false, 'completed_at', NULL));
$$;

CREATE FUNCTION public.set_tutorial_preference(
  p_workspace_kind text,
  p_organization_id uuid,
  p_tutorial_key text,
  p_tutorial_version integer,
  p_suppressed boolean,
  p_completed boolean
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_workspace_kind NOT IN ('internal', 'organization', 'individual')
     OR p_tutorial_version < 1
     OR char_length(p_tutorial_key) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'invalid_tutorial_preference' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.user_tutorial_preferences (
    user_id, workspace_kind, organization_id, tutorial_key,
    tutorial_version, suppressed, completed_at, updated_at
  ) VALUES (
    auth.uid(), p_workspace_kind, p_organization_id, p_tutorial_key,
    p_tutorial_version, p_suppressed,
    CASE WHEN p_completed THEN now() END, now()
  )
  ON CONFLICT (
    user_id, workspace_kind,
    (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    tutorial_key, tutorial_version
  ) DO UPDATE SET
    suppressed = EXCLUDED.suppressed,
    completed_at = COALESCE(EXCLUDED.completed_at, public.user_tutorial_preferences.completed_at),
    updated_at = now();
  RETURN true;
END;
$$;

CREATE FUNCTION public.portal_list_whatsapp_responsibles()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_org uuid := private.current_organization_id();
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL
     OR NOT private.has_whatsapp_module_access(auth.uid(), v_org) THEN
    RAISE EXCEPTION 'whatsapp_access_not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', member.user_id,
      'name', COALESCE(NULLIF(btrim(profile.name), ''), profile.email, 'Usuário'),
      'role', member.role,
      'granted_at', access.granted_at,
      'is_mandatory', member.role = 'master'
    ) ORDER BY (member.role = 'master') DESC, profile.name)
    FROM public.organization_members member
    JOIN public.users profile ON profile.uid = member.user_id
    LEFT JOIN public.organization_module_members access
      ON access.organization_id = member.organization_id
     AND access.user_id = member.user_id
     AND access.module_key = 'whatsapp'
    WHERE member.organization_id = v_org
      AND member.status = 'active'
      AND (member.role = 'master' OR access.user_id IS NOT NULL)
  ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION public.portal_set_whatsapp_responsible(
  p_user_id uuid,
  p_enabled boolean,
  p_reason text,
  p_operation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := private.current_organization_id();
  v_role text;
  v_target_role text;
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL OR p_operation_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  v_role := private.organization_role(v_org);
  IF v_role NOT IN ('master', 'admin')
     OR NOT private.whatsapp_org_enabled(v_org) THEN
    RAISE EXCEPTION 'whatsapp_access_management_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  SELECT role INTO v_target_role
  FROM public.organization_members
  WHERE organization_id = v_org AND user_id = p_user_id AND status = 'active';
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'active_member_required' USING ERRCODE = '42501';
  END IF;
  IF v_target_role = 'master' AND NOT p_enabled THEN
    RAISE EXCEPTION 'master_access_is_mandatory' USING ERRCODE = '42501';
  END IF;

  IF p_enabled THEN
    INSERT INTO public.organization_module_members (
      organization_id, user_id, module_key, granted_by
    ) VALUES (v_org, p_user_id, 'whatsapp', auth.uid())
    ON CONFLICT (organization_id, user_id, module_key)
    DO UPDATE SET granted_by = EXCLUDED.granted_by, granted_at = now();
  ELSE
    DELETE FROM public.organization_module_members
    WHERE organization_id = v_org
      AND user_id = p_user_id
      AND module_key = 'whatsapp';
  END IF;

  PERFORM private.emit_domain_event(
    CASE WHEN p_enabled THEN 'whatsapp.access.granted' ELSE 'whatsapp.access.revoked' END,
    'whatsapp', 'organization', v_org, p_user_id,
    'organization_member', p_user_id::text, 'info',
    CASE WHEN p_enabled THEN 'Acesso ao WhatsApp concedido' ELSE 'Acesso ao WhatsApp removido' END,
    CASE WHEN p_enabled THEN 'Um responsável foi adicionado ao módulo.' ELSE 'Um responsável foi removido do módulo.' END,
    'whatsapp.responsibles', jsonb_build_object('operation_id', p_operation_id),
    p_operation_id::text, 'whatsapp-access:' || v_org::text
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_inbox(text, integer, boolean),
  public.mark_inbox_message_read(uuid, text),
  public.mark_all_inbox_messages_read(text),
  public.get_tutorial_preference(text, uuid, text, integer),
  public.set_tutorial_preference(text, uuid, text, integer, boolean, boolean),
  public.portal_list_whatsapp_responsibles(),
  public.portal_set_whatsapp_responsible(uuid, boolean, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_inbox(text, integer, boolean),
  public.mark_inbox_message_read(uuid, text),
  public.mark_all_inbox_messages_read(text),
  public.get_tutorial_preference(text, uuid, text, integer),
  public.set_tutorial_preference(text, uuid, text, integer, boolean, boolean),
  public.portal_list_whatsapp_responsibles(),
  public.portal_set_whatsapp_responsible(uuid, boolean, text, uuid)
  TO authenticated;

-- Migração sem perda das notificações legadas. A leitura compartilhada antiga
-- é projetada para cada destinatário atual; novas mensagens passam a ser por usuário.
INSERT INTO public.domain_events (
  id, event_type, module_key, actor_context, severity, title, body,
  route_key, payload, created_at
)
SELECT notification.id, 'legacy.' || notification.tipo, 'notifications',
  'system', 'info', notification.titulo, notification.corpo,
  'notifications.home', notification.payload, notification.criada_em
FROM public.notificacoes notification
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.inbox_recipients (
  event_id, recipient_user_id, workspace_kind, organization_id, read_at, created_at
)
SELECT DISTINCT notification.id, profile.uid,
  CASE
    WHEN staff.user_id IS NOT NULL THEN 'internal'
    WHEN member.organization_id IS NOT NULL THEN 'organization'
    ELSE 'individual'
  END,
  member.organization_id,
  CASE WHEN notification.lida THEN notification.criada_em END,
  notification.criada_em
FROM public.notificacoes notification
JOIN public.users profile ON (
  profile.uid = CASE
    WHEN notification.destinatario_uid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN notification.destinatario_uid::uuid
    ELSE NULL
  END
  OR (
    notification.destinatario_uid IS NULL
    AND notification.destinatario_role = profile.role
    AND (notification.municipio IS NULL OR notification.municipio = profile.municipio)
  )
)
LEFT JOIN public.internal_staff staff
  ON staff.user_id = profile.uid AND staff.status = 'active'
LEFT JOIN public.organization_members member
  ON member.user_id = profile.uid AND member.status = 'active'
ON CONFLICT DO NOTHING;

-- Eventos automáticos dos dois módulos inaugurais. Demais superfícies de
-- mutação passam a chamar private.emit_domain_event durante a migração gradual.
CREATE FUNCTION private.capture_comunicado_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_action text; v_title text; v_severity text;
BEGIN
  v_action := CASE
    WHEN TG_OP = 'INSERT' THEN 'created'
    WHEN NEW.status IS DISTINCT FROM OLD.status THEN NEW.status
    ELSE 'updated'
  END;
  v_title := CASE v_action
    WHEN 'created' THEN 'Comunicado criado'
    WHEN 'publicado' THEN 'Comunicado publicado'
    WHEN 'agendado' THEN 'Comunicado agendado'
    WHEN 'arquivado' THEN 'Comunicado arquivado'
    ELSE 'Comunicado atualizado'
  END;
  v_severity := CASE NEW.severidade
    WHEN 'emergencia' THEN 'critical'
    WHEN 'alerta' THEN 'warning'
    ELSE 'info'
  END;
  PERFORM private.emit_domain_event(
    'communication.' || v_action, 'whatsapp', 'organization',
    NEW.organization_id, NULL, 'comunicado', NEW.id::text, v_severity,
    v_title, NEW.titulo, 'communication.detail',
    jsonb_build_object('status', NEW.status, 'severidade', NEW.severidade),
    NULL, 'comunicado:' || NEW.id::text, COALESCE(auth.uid(), NEW.autor_uid)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER comunicados_emit_domain_event
AFTER INSERT OR UPDATE ON public.comunicados
FOR EACH ROW EXECUTE FUNCTION private.capture_comunicado_event();

CREATE FUNCTION private.capture_bot_session_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_severity text;
BEGIN
  v_severity := CASE NEW.status
    WHEN 'banido' THEN 'critical'
    WHEN 'desconectado' THEN 'warning'
    WHEN 'vinculado' THEN 'success'
    ELSE 'info'
  END;
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM private.emit_domain_event(
      'whatsapp.session.' || NEW.status, 'whatsapp', 'system',
      NEW.organization_id, NULL, 'bot_session', NEW.id::text, v_severity,
      'Status do número do WhatsApp alterado',
      CASE NEW.status
        WHEN 'vinculado' THEN 'O número foi conectado ao bot.'
        WHEN 'desconectado' THEN 'O número perdeu a conexão com o bot.'
        WHEN 'banido' THEN 'O número foi marcado como banido.'
        ELSE 'O número está aguardando a leitura do QR Code.'
      END,
      'whatsapp.sessions', jsonb_build_object('status', NEW.status),
      NULL, 'bot-session:' || NEW.id::text,
      COALESCE(auth.uid(), NEW.vinculado_por)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bot_sessoes_emit_domain_event
AFTER INSERT OR UPDATE ON public.bot_sessoes
FOR EACH ROW EXECUTE FUNCTION private.capture_bot_session_event();

REVOKE ALL ON FUNCTION private.capture_comunicado_event(),
  private.capture_bot_session_event() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.canal_envios
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS uncertain_at timestamptz;
ALTER TABLE public.canal_envios DROP CONSTRAINT IF EXISTS canal_envios_status_valid;
ALTER TABLE public.canal_envios ADD CONSTRAINT canal_envios_status_valid
  CHECK (status IN ('pendente', 'processando', 'enviado', 'falhou', 'incerto'));

-- O worker usa RPCs exclusivas do service_role. Assim, o esquema private não
-- entra na Data API e duas réplicas nunca assumem o mesmo envio.
CREATE FUNCTION public.bot_load_auth_state(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'key_category', state.key_category,
    'key_id', state.key_id,
    'encrypted_payload', state.encrypted_payload
  )), '[]'::jsonb)
  FROM private.bot_auth_state state
  WHERE state.session_id = p_session_id;
$$;

CREATE FUNCTION public.bot_set_auth_state(
  p_session_id uuid,
  p_key_category text,
  p_key_id text,
  p_encrypted_payload text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF char_length(p_key_category) NOT BETWEEN 1 AND 80
     OR char_length(p_key_id) NOT BETWEEN 1 AND 500
     OR char_length(p_encrypted_payload) < 20 THEN
    RAISE EXCEPTION 'invalid_bot_auth_state' USING ERRCODE = '22023';
  END IF;
  INSERT INTO private.bot_auth_state (
    session_id, key_category, key_id, encrypted_payload, updated_at
  ) VALUES (
    p_session_id, p_key_category, p_key_id, p_encrypted_payload, now()
  )
  ON CONFLICT (session_id, key_category, key_id) DO UPDATE
  SET encrypted_payload = EXCLUDED.encrypted_payload, updated_at = now();
  RETURN true;
END;
$$;

CREATE FUNCTION public.bot_delete_auth_state(
  p_session_id uuid,
  p_key_category text DEFAULT NULL,
  p_key_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM private.bot_auth_state state
  WHERE state.session_id = p_session_id
    AND (p_key_category IS NULL OR state.key_category = p_key_category)
    AND (p_key_id IS NULL OR state.key_id = p_key_id);
  RETURN true;
END;
$$;

CREATE FUNCTION public.bot_claim_pending_deliveries(
  p_worker_id text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (id uuid, canal_id uuid, comunicado_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF char_length(btrim(COALESCE(p_worker_id, ''))) NOT BETWEEN 3 AND 120
     OR p_limit NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'invalid_worker_claim' USING ERRCODE = '22023';
  END IF;

  -- Uma queda depois do envio pode deixar o resultado desconhecido. Nunca
  -- reenviamos automaticamente: a equipe confere e decide pelo painel.
  UPDATE public.canal_envios delivery
  SET status = 'incerto', uncertain_at = now(), bot_atualizado_em = now(),
      erro = COALESCE(delivery.erro, 'Worker interrompido antes da confirmação final.')
  WHERE delivery.status = 'processando'
    AND delivery.processing_started_at < now() - interval '2 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT delivery.id
    FROM public.canal_envios delivery
    WHERE delivery.status = 'pendente'
    ORDER BY delivery.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE public.canal_envios delivery
    SET status = 'processando', processing_started_at = now(),
        worker_id = p_worker_id, bot_atualizado_em = now(), erro = NULL
    FROM candidates
    WHERE delivery.id = candidates.id
    RETURNING delivery.id, delivery.canal_id, delivery.comunicado_id
  )
  SELECT claimed.id, claimed.canal_id, claimed.comunicado_id FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_load_auth_state(uuid),
  public.bot_set_auth_state(uuid, text, text, text),
  public.bot_delete_auth_state(uuid, text, text),
  public.bot_claim_pending_deliveries(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_load_auth_state(uuid),
  public.bot_set_auth_state(uuid, text, text, text),
  public.bot_delete_auth_state(uuid, text, text),
  public.bot_claim_pending_deliveries(text, integer)
  TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'inbox_recipients'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_recipients';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
