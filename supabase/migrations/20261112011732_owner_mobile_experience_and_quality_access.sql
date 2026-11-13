-- Owner experience is UI preference, never an authorization claim.
CREATE TABLE public.owner_mobile_experiences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('follow', 'operate')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.owner_mobile_experiences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_mobile_experiences FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_owner_mobile_experience()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR private.current_internal_role(auth.uid()) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'owner_required' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT mode FROM public.owner_mobile_experiences WHERE user_id = auth.uid());
END $$;
CREATE OR REPLACE FUNCTION public.set_owner_mobile_experience(p_mode text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR private.current_internal_role(auth.uid()) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'owner_required' USING ERRCODE = '42501';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('follow','operate') THEN
    RAISE EXCEPTION 'invalid_owner_mode' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.owner_mobile_experiences(user_id,mode) VALUES(auth.uid(),p_mode)
  ON CONFLICT(user_id) DO UPDATE SET mode=excluded.mode, updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.get_owner_mobile_experience(),public.set_owner_mobile_experience(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_owner_mobile_experience(),public.set_owner_mobile_experience(text) TO authenticated;

-- Explicit active internal-owner read scopes; existing customer policies remain.
CREATE POLICY owner_mobile_qe_read ON public.revisoes_qe FOR SELECT TO authenticated
USING (private.current_internal_role(auth.uid()) = 'owner');
CREATE POLICY owner_mobile_inspection_read ON public.vistorias FOR SELECT TO authenticated
USING (private.current_internal_role(auth.uid()) = 'owner');
CREATE POLICY owner_mobile_users_read ON public.users FOR SELECT TO authenticated
USING (private.current_internal_role(auth.uid()) = 'owner');

CREATE OR REPLACE FUNCTION public.qe_fila()
RETURNS TABLE (
  revisao_id uuid, vistoria_id uuid, ciclo integer, status text,
  agente_nome text, endereco text, nivel_risco text, data_vistoria timestamptz,
  criado_em timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_role text; v_municipio text;
BEGIN
  SELECT u.role, u.municipio INTO v_role, v_municipio
  FROM public.users u WHERE u.uid = auth.uid() AND coalesce(u."isApproved", false);

  IF private.current_internal_role(auth.uid()) = 'owner' THEN v_role := 'owner'; END IF;
  IF coalesce(v_role,'') NOT IN ('owner','supervisor','admin','master_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  SELECT r.id, r.vistoria_id, r.ciclo, r.status,
         v."agenteNome", v.endereco, v."nivelRisco", v."dataVistoria", r.criado_em
  FROM public.revisoes_qe r
  JOIN public.vistorias v ON v.id = r.vistoria_id
  WHERE r.status = 'pendente'
    AND (
      v_role IN ('owner','master_admin')
      OR (r.organization_id IS NOT NULL AND r.organization_id IN (SELECT my_organization_ids()))
      OR (r.organization_id IS NULL AND r.municipio = v_municipio)
    )
  ORDER BY CASE v."nivelRisco" WHEN 'r4' THEN 0 WHEN 'r3' THEN 1 WHEN 'r2' THEN 2 ELSE 3 END, r.criado_em;
END $$;
REVOKE ALL ON FUNCTION public.qe_fila() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qe_fila() TO authenticated;


CREATE OR REPLACE FUNCTION public.qe_revisar(p_revisao_id uuid, p_nota integer, p_checklist jsonb, p_parecer text, p_aprovado boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_role text; v_nome text; v_municipio text;
  v_rev public.revisoes_qe;
  v_agente_uid text;
  v_agente_uuid uuid;
  v_event_id uuid;
  v_workspace text;
  v_endereco text;
BEGIN
  SELECT u.role, u.name, u.municipio INTO v_role, v_nome, v_municipio
  FROM public.users u WHERE u.uid = auth.uid() AND coalesce(u."isApproved", false);
  IF private.current_internal_role(auth.uid()) = 'owner' THEN
    v_role := 'owner';
    SELECT display_name INTO v_nome FROM public.internal_staff WHERE user_id = auth.uid() AND status='active';
  END IF;
  IF coalesce(v_role,'') NOT IN ('owner','supervisor','admin','master_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_rev FROM public.revisoes_qe WHERE id = p_revisao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'review_not_found' USING ERRCODE='P0002'; END IF;
  IF v_rev.status <> 'pendente' THEN RAISE EXCEPTION 'review_already_closed' USING ERRCODE='P0001'; END IF;

  IF v_role NOT IN ('owner','master_admin')
     AND NOT coalesce(v_rev.organization_id IS NOT NULL AND v_rev.organization_id IN (SELECT my_organization_ids()), false)
     AND NOT coalesce(v_rev.organization_id IS NULL AND v_municipio IS NOT NULL AND v_rev.municipio = v_municipio, false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  IF p_aprovado IS NULL THEN RAISE EXCEPTION 'approval_required' USING ERRCODE='22023'; END IF;
  IF NOT p_aprovado AND char_length(btrim(coalesce(p_parecer,''))) < 5 THEN RAISE EXCEPTION 'parecer_required' USING ERRCODE='22023'; END IF;
  IF p_nota IS NOT NULL AND (p_nota < 0 OR p_nota > 10) THEN
    RAISE EXCEPTION 'invalid_nota' USING ERRCODE='22023'; END IF;
  IF p_checklist IS NOT NULL AND jsonb_typeof(p_checklist) <> 'array' THEN
    RAISE EXCEPTION 'invalid_checklist' USING ERRCODE='22023'; END IF;

  UPDATE public.revisoes_qe
  SET status = CASE WHEN p_aprovado THEN 'aprovada' ELSE 'devolvida' END,
      nota = p_nota,
      checklist = coalesce(p_checklist, '[]'::jsonb),
      parecer = nullif(btrim(coalesce(p_parecer,'')), ''),
      revisor_uid = auth.uid(),
      revisor_nome = v_nome,
      respondida_em = now()
  WHERE id = p_revisao_id;

  SELECT "agenteUid", endereco INTO v_agente_uid, v_endereco
  FROM public.vistorias WHERE id = v_rev.vistoria_id;

  IF v_agente_uid IS NULL THEN RETURN; END IF;

  INSERT INTO public.notificacoes (tipo, titulo, corpo, destinatario_uid, municipio, payload, lida, criada_em)
  VALUES (
    CASE WHEN p_aprovado THEN 'qe_aprovada' ELSE 'qe_devolvida' END,
    CASE WHEN p_aprovado THEN 'Vistoria aprovada na revisão de qualidade' ELSE 'Vistoria devolvida para correção' END,
    CASE
      WHEN p_aprovado THEN
        CASE WHEN p_nota IS NOT NULL
          THEN 'Sua vistoria foi conferida e aprovada — nota ' || p_nota || '/10.'
          ELSE 'Sua vistoria foi conferida e aprovada na revisão de qualidade.' END
      ELSE coalesce(nullif(btrim(coalesce(p_parecer,'')), ''), 'Revise os pontos sinalizados e reenvie.')
    END,
    v_agente_uid, v_rev.municipio,
    jsonb_build_object('vistoria_id', v_rev.vistoria_id, 'ciclo', v_rev.ciclo, 'revisao_id', p_revisao_id, 'nota', p_nota),
    false, now()
  );

  v_workspace := CASE WHEN v_rev.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END;
  v_agente_uuid := CASE WHEN v_agente_uid ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                        THEN v_agente_uid::uuid ELSE NULL END;
  IF v_agente_uuid IS NULL THEN RETURN; END IF;

  INSERT INTO public.domain_events (
    event_type, module_key, actor_context, actor_user_id, organization_id,
    affected_user_id, entity_type, entity_id, severity, title, body,
    route_key, payload, dedupe_key, thread_key
  )
  VALUES (
    CASE WHEN p_aprovado THEN 'qe.review_approved' ELSE 'qe.review_returned' END,
    'qe', v_workspace, auth.uid(), v_rev.organization_id,
    v_agente_uuid, 'qe_review', p_revisao_id::text,
    CASE WHEN p_aprovado THEN 'success' ELSE 'warning' END,
    CASE WHEN p_aprovado THEN 'Vistoria aprovada na revisão de qualidade' ELSE 'Vistoria devolvida para correção' END,
    CASE
      WHEN p_aprovado THEN
        'Sua vistoria em ' || coalesce(nullif(btrim(v_endereco), ''), 'endereço não informado')
          || ' foi conferida e aprovada'
          || CASE WHEN p_nota IS NOT NULL THEN ' — nota ' || p_nota || '/10.' ELSE '.' END
      ELSE
        'Sua vistoria em ' || coalesce(nullif(btrim(v_endereco), ''), 'endereço não informado')
          || ' precisa de correção: '
          || coalesce(nullif(btrim(coalesce(p_parecer,'')), ''), 'revise os pontos sinalizados e reenvie.')
    END,
    'qe',
    jsonb_build_object('vistoria_id', v_rev.vistoria_id, 'ciclo', v_rev.ciclo, 'revisao_id', p_revisao_id, 'nota', p_nota),
    'qe_result:' || p_revisao_id::text,
    'qe:' || v_rev.vistoria_id::text
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NOT NULL THEN
    INSERT INTO public.inbox_recipients (event_id, recipient_user_id, workspace_kind, organization_id)
    VALUES (v_event_id, v_agente_uuid, v_workspace, v_rev.organization_id)
    ON CONFLICT DO NOTHING;
  END IF;
END
$function$;

REVOKE ALL ON FUNCTION public.qe_revisar(uuid,integer,jsonb,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qe_revisar(uuid,integer,jsonb,text,boolean) TO authenticated;

-- Logical removal is distinct from Drive/cold-storage archived_at.
ALTER TABLE public.vistorias ADD COLUMN IF NOT EXISTS owner_archived_at timestamptz;
CREATE POLICY owner_archive_visibility ON public.vistorias AS RESTRICTIVE FOR SELECT TO authenticated
USING (owner_archived_at IS NULL OR private.current_internal_role(auth.uid()) = 'owner');
CREATE OR REPLACE FUNCTION public.set_owner_inspection_archived(
  p_inspection_id uuid, p_archived boolean, p_reason text, p_operation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid(); previous_at timestamptz; new_at timestamptz;
  request_hash text; prior public.internal_operations; result jsonb;
BEGIN
  IF actor IS NULL OR private.current_internal_role(actor) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'owner_required' USING ERRCODE='42501';
  END IF;
  IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE='42501'; END IF;
  IF p_inspection_id IS NULL OR p_archived IS NULL OR p_operation_id IS NULL THEN
    RAISE EXCEPTION 'invalid_archive_request' USING ERRCODE='22023';
  END IF;
  IF char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE='22023';
  END IF;
  request_hash := md5(concat_ws('|',p_inspection_id,p_archived,btrim(p_reason)));
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text || p_operation_id::text,0));
  SELECT * INTO prior FROM public.internal_operations o WHERE o.actor_id=actor AND o.operation_id=p_operation_id;
  IF prior.id IS NOT NULL THEN
    IF prior.request_hash <> request_hash OR prior.action <> 'inspection.archive' THEN
      RAISE EXCEPTION 'operation_id_conflict' USING ERRCODE='22023';
    END IF;
    RETURN prior.result;
  END IF;
  SELECT v.owner_archived_at INTO previous_at FROM public.vistorias v WHERE v.id=p_inspection_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'inspection_not_found' USING ERRCODE='P0002'; END IF;
  new_at := CASE WHEN p_archived THEN coalesce(previous_at,now()) ELSE NULL END;
  IF new_at IS DISTINCT FROM previous_at THEN
    UPDATE public.vistorias SET owner_archived_at=new_at WHERE id=p_inspection_id;
  END IF;
  INSERT INTO public.internal_access_events(actor_id,actor_role,action,target_type,target_id,result,reason,metadata)
  VALUES(actor,'owner',CASE WHEN p_archived THEN 'inspection.archive' ELSE 'inspection.restore' END,
    'inspection',p_inspection_id::text,'allowed',btrim(p_reason),jsonb_build_object('previous_archived_at',previous_at,'archived_at',new_at));
  result := jsonb_build_object('ok',true,'inspection_id',p_inspection_id,'archived_at',new_at);
  INSERT INTO public.internal_operations(operation_id,actor_id,action,request_hash,status,result,completed_at)
  VALUES(p_operation_id,actor,'inspection.archive',request_hash,'succeeded',result,now());
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.set_owner_inspection_archived(uuid,boolean,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_owner_inspection_archived(uuid,boolean,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_owner_archived_inspection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.owner_archived_at IS NOT NULL AND NEW.owner_archived_at IS NOT DISTINCT FROM OLD.owner_archived_at THEN
    RAISE EXCEPTION 'inspection_archived_read_only' USING ERRCODE='42501';
  END IF;
  IF auth.uid() IS NOT NULL AND private.current_internal_role(auth.uid()) IS DISTINCT FROM 'owner' THEN
    IF OLD.owner_archived_at IS NOT NULL OR NEW.owner_archived_at IS DISTINCT FROM OLD.owner_archived_at THEN
      RAISE EXCEPTION 'inspection_archived_read_only' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_owner_archived_inspection() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_owner_archived_inspection BEFORE UPDATE ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION private.guard_owner_archived_inspection();

-- Operational user directories are server-scoped. The browser cannot select
-- arbitrary profiles, choose a municipality outside its authority, or obtain
-- staff email addresses unless it is an administrator.
CREATE OR REPLACE FUNCTION public.list_operational_users(
  p_role text DEFAULT NULL,
  p_municipio text DEFAULT NULL,
  p_include_unapproved boolean DEFAULT false,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  uid uuid,
  name text,
  email text,
  role text,
  municipio text,
  "isApproved" boolean,
  "createdAt" timestamptz,
  token_limit integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_municipio text;
  v_role text := nullif(lower(btrim(coalesce(p_role, ''))), '');
  v_scope_municipio text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_offset < 0 OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023'; END IF;
  IF v_role IS NOT NULL AND v_role NOT IN ('agent', 'supervisor', 'admin') THEN RAISE EXCEPTION 'invalid_role_filter' USING ERRCODE = '22023'; END IF;

  SELECT u.role, u.municipio INTO v_actor_role, v_actor_municipio
  FROM public.users AS u
  WHERE u.uid = auth.uid() AND u."isApproved";
  IF private.current_internal_role(auth.uid())='owner' THEN v_actor_role := 'owner'; END IF;
  IF coalesce(v_actor_role,'') NOT IN ('owner','master_admin', 'admin', 'supervisor') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_include_unapproved AND v_actor_role NOT IN ('owner','master_admin', 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  v_scope_municipio := CASE WHEN v_actor_role IN ('owner','master_admin') THEN nullif(btrim(coalesce(p_municipio, '')), '') ELSE v_actor_municipio END;
  RETURN QUERY
  SELECT u.uid, u.name,
    CASE WHEN v_actor_role IN ('owner','master_admin', 'admin') THEN u.email ELSE NULL END,
    u.role, u.municipio, u."isApproved", u."createdAt",
    CASE WHEN v_actor_role IN ('owner','master_admin') THEN u.token_limit ELSE NULL END
  FROM public.users AS u
  WHERE u.role <> 'master_admin'
    AND (v_role IS NULL OR u.role = v_role)
    AND (v_scope_municipio IS NULL OR u.municipio = v_scope_municipio)
    AND (p_include_unapproved OR u."isApproved")
  ORDER BY u.name NULLS LAST, u.uid
  OFFSET p_offset LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_operational_user(p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_municipio text;
  v_target public.users;
BEGIN
  IF auth.uid() IS NULL OR p_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT role, municipio INTO v_actor_role, v_actor_municipio
  FROM public.users WHERE uid = auth.uid() AND "isApproved";
  IF private.current_internal_role(auth.uid())='owner' THEN v_actor_role := 'owner'; END IF;
  IF coalesce(v_actor_role,'') NOT IN ('owner','master_admin', 'admin', 'supervisor') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_target FROM public.users WHERE uid = p_uid AND role <> 'master_admin';
  IF v_target.uid IS NULL OR (v_actor_role NOT IN ('owner','master_admin') AND v_target.municipio IS DISTINCT FROM v_actor_municipio) THEN
    RAISE EXCEPTION 'user_not_found_or_forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'uid', v_target.uid, 'name', v_target.name,
    'email', CASE WHEN v_actor_role IN ('owner','master_admin', 'admin') THEN v_target.email ELSE NULL END,
    'role', v_target.role, 'municipio', v_target.municipio,
    'isApproved', v_target."isApproved", 'createdAt', v_target."createdAt"
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.list_operational_users(text,text,boolean,integer,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_operational_user(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_operational_users(text,text,boolean,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operational_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_operational_appointment(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_municipio text;
  v_actor_name text;
  v_id uuid := (p_payload->>'id')::uuid;
  v_titulo text := btrim(coalesce(p_payload->>'titulo', ''));
  v_endereco text := nullif(btrim(coalesce(p_payload->>'endereco', '')), '');
  v_data timestamptz := (p_payload->>'data_agendada')::timestamptz;
  v_agente_uid uuid := nullif(p_payload->>'agente_uid', '')::uuid;
  v_agente_nome text;
  v_municipio text;
BEGIN
  IF auth.uid() IS NULL OR v_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT role, municipio, name INTO v_actor_role, v_actor_municipio, v_actor_name
  FROM public.users WHERE uid = auth.uid() AND coalesce("isApproved", false);
  IF private.current_internal_role(auth.uid())='owner' THEN v_actor_role := 'owner'; END IF;
  IF coalesce(v_actor_role,'') NOT IN ('owner','agent', 'supervisor', 'admin', 'master_admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_titulo) < 2 OR char_length(v_titulo) > 180 OR v_data IS NULL THEN
    RAISE EXCEPTION 'invalid_appointment' USING ERRCODE = '22023';
  END IF;
  v_municipio := CASE WHEN v_actor_role IN ('owner','master_admin') THEN nullif(btrim(p_payload->>'municipio'), '') ELSE v_actor_municipio END;
  IF v_municipio IS NULL THEN RAISE EXCEPTION 'municipio_required' USING ERRCODE = '22023'; END IF;
  IF v_agente_uid IS NOT NULL THEN
    SELECT name INTO v_agente_nome FROM public.users
    WHERE uid = v_agente_uid AND role = 'agent' AND municipio = v_municipio AND coalesce("isApproved", false);
    IF v_agente_nome IS NULL THEN RAISE EXCEPTION 'invalid_assigned_agent' USING ERRCODE = '22023'; END IF;
  END IF;

  INSERT INTO public.agendamentos (
    id, titulo, endereco, municipio, data_agendada, criado_por_uid, criado_por_nome,
    agente_uid, agente_nome, lat, lng, observacoes, status, origem, criado_em
  ) VALUES (
    v_id, v_titulo, v_endereco, v_municipio, v_data, auth.uid(), coalesce(v_actor_name, (SELECT display_name FROM public.internal_staff WHERE user_id=auth.uid() AND status='active'), ''),
    v_agente_uid, v_agente_nome,
    nullif(p_payload->>'lat', '')::double precision, nullif(p_payload->>'lng', '')::double precision,
    nullif(btrim(coalesce(p_payload->>'observacoes', '')), ''), 'pendente', 'app', now()
  ) ON CONFLICT (id) DO NOTHING;

  IF NOT FOUND AND NOT EXISTS (
    SELECT 1 FROM public.agendamentos WHERE id = v_id
      AND (criado_por_uid = auth.uid() OR v_actor_role IN ('owner','master_admin'))
  ) THEN
    RAISE EXCEPTION 'appointment_conflict' USING ERRCODE = '42501';
  END IF;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transition_operational_appointment(
  p_id uuid,
  p_status text,
  p_inspection_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_municipio text;
BEGIN
  IF auth.uid() IS NULL OR p_id IS NULL OR p_status NOT IN ('concluido', 'cancelado') THEN
    RAISE EXCEPTION 'invalid_appointment_transition' USING ERRCODE = '22023';
  END IF;
  SELECT role, municipio INTO v_actor_role, v_actor_municipio FROM public.users WHERE uid = auth.uid() AND coalesce("isApproved", false);
  IF private.current_internal_role(auth.uid())='owner' THEN v_actor_role := 'owner'; END IF;
  UPDATE public.agendamentos
  SET status = p_status, inspection_id = coalesce(p_inspection_id, inspection_id)
  WHERE id = p_id
    AND (v_actor_role IN ('owner','master_admin') OR criado_por_uid = auth.uid() OR agente_uid = auth.uid())
    AND (v_actor_role IN ('owner','master_admin') OR municipio = v_actor_municipio);
  IF NOT FOUND THEN RAISE EXCEPTION 'appointment_not_found_or_forbidden' USING ERRCODE = '42501'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_operational_appointment(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_municipio text;
BEGIN
  IF auth.uid() IS NULL OR p_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT role, municipio INTO v_actor_role, v_actor_municipio FROM public.users WHERE uid = auth.uid() AND coalesce("isApproved", false);
  IF private.current_internal_role(auth.uid())='owner' THEN v_actor_role := 'owner'; END IF;
  DELETE FROM public.agendamentos
  WHERE id = p_id
    AND (v_actor_role IN ('owner','master_admin') OR criado_por_uid = auth.uid())
    AND (v_actor_role IN ('owner','master_admin') OR municipio = v_actor_municipio);
  IF NOT FOUND THEN RAISE EXCEPTION 'appointment_not_found_or_forbidden' USING ERRCODE = '42501'; END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_operational_appointment(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_operational_appointment(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_operational_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_operational_appointment(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_operational_appointment(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_operational_appointment(uuid) TO authenticated;

DO $owner_policies$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agendamentos','atribuicoes'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('CREATE POLICY owner_mobile_global_read ON public.%I FOR SELECT TO authenticated USING (private.current_internal_role(auth.uid()) = %L)',t,'owner');
    END IF;
  END LOOP;
END $owner_policies$;

-- Internal owner upload authorization must not require a legacy public.users row.
CREATE OR REPLACE FUNCTION public.authorize_inspection_upload(p_inspection_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.users;
  v_inspection public.vistorias;
  v_actor uuid := auth.uid();
  v_inspection_municipio text;
BEGIN
  IF v_actor IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_inspection FROM public.vistorias WHERE id = p_inspection_id;
  IF v_inspection.id IS NULL OR v_inspection.owner_archived_at IS NOT NULL THEN RETURN false; END IF;
  IF private.current_internal_role(v_actor) = 'owner' THEN RETURN true; END IF;
  SELECT * INTO v_profile FROM public.users WHERE uid = v_actor;
  IF v_profile.uid IS NULL OR v_profile."isApproved" IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF private.is_active_internal_staff() THEN
    RETURN private.can_manage_own_mobile_field_inspections()
      AND v_inspection.organization_id IS NULL
      AND v_inspection."agenteUid"::text = v_actor::text;
  END IF;

  v_inspection_municipio := coalesce(v_inspection.municipio, v_inspection.municipio_agente, 'geral');
  RETURN v_inspection."agenteUid"::text = v_actor::text
    OR v_profile.role = 'master_admin'
    OR (v_profile.role = 'admin' AND v_profile.municipio = v_inspection_municipio);
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_inspection_upload(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_inspection_upload(uuid) TO authenticated;
