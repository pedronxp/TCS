-- Individual agents can finalize an inspection without a municipal membership.
-- Their sequence is annual and user-scoped; municipal counters and every historic
-- official protocol remain untouched.
-- Some legacy installations were missing these optional inspection fields even
-- though the mobile payload already sends them. Keep the finalization RPC
-- compatible before it reads or persists those values.
ALTER TABLE public.vistorias
  ADD COLUMN IF NOT EXISTS "enderecoRua" text,
  ADD COLUMN IF NOT EXISTS "enderecoNumero" text,
  ADD COLUMN IF NOT EXISTS "enderecoBairro" text,
  ADD COLUMN IF NOT EXISTS "formularioId" text;

CREATE TABLE IF NOT EXISTS public.individual_protocol_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  protocol_year integer NOT NULL CHECK (protocol_year BETWEEN 2000 AND 9999),
  last_seq bigint NOT NULL CHECK (last_seq >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, protocol_year)
);

CREATE TABLE IF NOT EXISTS public.individual_protocol_allocation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  protocol_year integer NOT NULL CHECK (protocol_year BETWEEN 2000 AND 9999),
  protocol_seq bigint NOT NULL CHECK (protocol_seq > 0),
  protocol text NOT NULL UNIQUE,
  idempotency_key uuid NOT NULL UNIQUE,
  allocated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, protocol_year, protocol_seq)
);

ALTER TABLE public.individual_protocol_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_protocol_allocation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.individual_protocol_counters, public.individual_protocol_allocation_events
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_finalized_inspection(p_inspection jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_organization_id uuid;
  v_inspection_id uuid;
  v_existing public.vistorias%ROWTYPE;
  v_input public.vistorias%ROWTYPE;
  v_saved public.vistorias%ROWTYPE;
  v_series public.protocol_series%ROWTYPE;
  v_organization_event public.protocol_allocation_events%ROWTYPE;
  v_individual_event public.individual_protocol_allocation_events%ROWTYPE;
  v_year integer;
  v_seq bigint;
  v_protocol text;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF jsonb_typeof(p_inspection) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_inspection_payload' USING ERRCODE = '22023';
  END IF;
  IF p_inspection ?| ARRAY[
    'protocolo', 'protocolo_seq', 'protocol_series', 'protocol_year', 'protocol_seq',
    'organization_id', 'organizationId'
  ] THEN
    RAISE EXCEPTION 'protocol_client_value_forbidden' USING ERRCODE = '42501';
  END IF;
  BEGIN
    v_inspection_id := (p_inspection ->> 'id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_inspection_id' USING ERRCODE = '22023';
  END;
  IF v_inspection_id IS NULL THEN
    RAISE EXCEPTION 'invalid_inspection_id' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(p_inspection ->> 'agenteUid', '')::uuid IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'inspection_actor_mismatch' USING ERRCODE = '42501';
  END IF;
  IF lower(coalesce(p_inspection ->> 'status', '')) NOT IN ('concluida', 'concluída') THEN
    RAISE EXCEPTION 'inspection_not_finalized' USING ERRCODE = '22023';
  END IF;

  v_organization_id := private.current_organization_id(v_actor_id);
  SELECT * INTO v_existing FROM public.vistorias WHERE id = v_inspection_id FOR UPDATE;
  IF v_organization_id IS NULL THEN
    SELECT * INTO v_individual_event
    FROM public.individual_protocol_allocation_events WHERE inspection_id = v_inspection_id;
  ELSE
    SELECT * INTO v_organization_event
    FROM public.protocol_allocation_events WHERE inspection_id = v_inspection_id;
  END IF;

  IF v_existing.id IS NULL AND (v_organization_event.id IS NOT NULL OR v_individual_event.id IS NOT NULL) THEN
    RAISE EXCEPTION 'inspection_protocol_voided' USING ERRCODE = 'P0002';
  END IF;
  IF v_existing.id IS NOT NULL AND v_existing.organization_id IS DISTINCT FROM v_organization_id THEN
    RAISE EXCEPTION 'inspection_organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_existing.id IS NOT NULL AND NULLIF(btrim(v_existing.protocolo), '') IS NOT NULL THEN
    RETURN jsonb_build_object(
      'inspection_id', v_existing.id,
      'organization_id', v_existing.organization_id,
      'protocol', v_existing.protocolo,
      'official', true,
      'legacy', v_existing.protocol_series IS NULL
    );
  END IF;
  IF v_existing.id IS NOT NULL AND (v_organization_event.id IS NOT NULL OR v_individual_event.id IS NOT NULL) THEN
    RAISE EXCEPTION 'inspection_protocol_audit_mismatch' USING ERRCODE = 'P0001';
  END IF;

  v_input := jsonb_populate_record(NULL::public.vistorias, p_inspection);
  v_input.id := v_inspection_id;
  v_input."agenteUid" := v_actor_id;
  v_input.organization_id := v_organization_id;
  v_input.status := 'concluida';

  IF v_existing.id IS NULL THEN
    INSERT INTO public.vistorias (
      id, "agenteUid", "agenteNome", municipio,
      "enderecoRua", "enderecoNumero", "enderecoBairro", "enderecoCep", "responsavelNome",
      latitude, longitude, "dataVistoria", "formularioId", "formularioVersao", "respostasJson",
      "calculoRisco", "nivelRisco", "pontuacaoTotal", "fotoUrl", "fotosUrls",
      laudo_url, laudo_gerado_em, endereco, status, organization_id
    ) VALUES (
      v_input.id, v_input."agenteUid", v_input."agenteNome", v_input.municipio,
      v_input."enderecoRua", v_input."enderecoNumero", v_input."enderecoBairro", v_input."enderecoCep", v_input."responsavelNome",
      v_input.latitude, v_input.longitude, v_input."dataVistoria", v_input."formularioId", v_input."formularioVersao", v_input."respostasJson",
      v_input."calculoRisco", v_input."nivelRisco", v_input."pontuacaoTotal", v_input."fotoUrl", v_input."fotosUrls",
      v_input.laudo_url, v_input.laudo_gerado_em, v_input.endereco, v_input.status, v_input.organization_id
    ) RETURNING * INTO v_saved;
  ELSE
    UPDATE public.vistorias SET
      "agenteUid" = v_input."agenteUid", "agenteNome" = v_input."agenteNome", municipio = v_input.municipio,
      "enderecoRua" = v_input."enderecoRua", "enderecoNumero" = v_input."enderecoNumero", "enderecoBairro" = v_input."enderecoBairro",
      "enderecoCep" = v_input."enderecoCep", "responsavelNome" = v_input."responsavelNome", latitude = v_input.latitude,
      longitude = v_input.longitude, "dataVistoria" = v_input."dataVistoria", "formularioId" = v_input."formularioId",
      "formularioVersao" = v_input."formularioVersao", "respostasJson" = v_input."respostasJson", "calculoRisco" = v_input."calculoRisco",
      "nivelRisco" = v_input."nivelRisco", "pontuacaoTotal" = v_input."pontuacaoTotal", "fotoUrl" = v_input."fotoUrl",
      "fotosUrls" = v_input."fotosUrls", laudo_url = v_input.laudo_url, laudo_gerado_em = v_input.laudo_gerado_em,
      endereco = v_input.endereco, status = v_input.status
    WHERE id = v_inspection_id RETURNING * INTO v_saved;
  END IF;

  v_year := extract(year FROM coalesce(v_input."dataVistoria", now()))::integer;
  IF v_organization_id IS NULL THEN
    INSERT INTO public.individual_protocol_counters(user_id, protocol_year, last_seq)
    VALUES (v_actor_id, v_year, 1)
    ON CONFLICT (user_id, protocol_year)
    DO UPDATE SET last_seq = public.individual_protocol_counters.last_seq + 1, updated_at = now()
    RETURNING last_seq INTO v_seq;
    v_protocol := format('TCS-IND-%s-%s', v_year, lpad(v_seq::text, 6, '0'));
    PERFORM set_config('app.official_protocol_allocation', 'on', true);
    UPDATE public.vistorias
    SET protocolo = v_protocol, protocol_series = 'IND', protocol_year = v_year, protocol_seq = v_seq, protocolo_seq = v_seq
    WHERE id = v_saved.id;
    INSERT INTO public.individual_protocol_allocation_events(
      inspection_id, user_id, protocol_year, protocol_seq, protocol, idempotency_key, allocated_by
    ) VALUES (v_saved.id, v_actor_id, v_year, v_seq, v_protocol, v_saved.id, v_actor_id);
  ELSE
    SELECT * INTO v_series FROM public.protocol_series
    WHERE organization_id = v_organization_id AND active FOR UPDATE;
    IF v_series.id IS NULL THEN
      RAISE EXCEPTION 'active_protocol_series_required' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.protocol_counters(organization_id, protocol_series_id, protocol_year, last_seq)
    VALUES (v_organization_id, v_series.id, v_year, 1)
    ON CONFLICT (organization_id, protocol_series_id, protocol_year)
    DO UPDATE SET last_seq = public.protocol_counters.last_seq + 1, updated_at = now()
    RETURNING last_seq INTO v_seq;
    v_protocol := format('TCS-%s-%s-%s', v_series.code, v_year, lpad(v_seq::text, 6, '0'));
    PERFORM set_config('app.official_protocol_allocation', 'on', true);
    UPDATE public.vistorias
    SET protocolo = v_protocol, protocol_series = v_series.code, protocol_year = v_year, protocol_seq = v_seq, protocolo_seq = v_seq
    WHERE id = v_saved.id;
    INSERT INTO public.protocol_allocation_events(
      inspection_id, organization_id, protocol_series_id, protocol_series, protocol_year, protocol_seq, protocol, idempotency_key, allocated_by
    ) VALUES (v_saved.id, v_organization_id, v_series.id, v_series.code, v_year, v_seq, v_protocol, v_saved.id, v_actor_id);
  END IF;

  RETURN jsonb_build_object('inspection_id', v_saved.id, 'organization_id', v_organization_id, 'protocol', v_protocol, 'official', true, 'legacy', false);
END;
$$;

-- Internal roles use least privilege: developer administers the catalog and
-- protocol series; support can see records but has no commercial mutation.
CREATE OR REPLACE FUNCTION private.internal_permissions(p_role text)
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_role
    WHEN 'owner' THEN ARRAY[
      'console.read', 'dashboard.executive.read', 'customer.read', 'customer.sensitive.read',
      'customer.write', 'commercial.read', 'commercial.write', 'support.read', 'support.write',
      'session.read', 'session.terminate', 'staff.read', 'staff.manage', 'audit.read',
      'technical.read', 'technical.write', 'build.request', 'build.approve', 'configuration.publish',
      'protocol.read', 'protocol.rotate'
    ]::text[]
    WHEN 'developer' THEN ARRAY[
      'console.read', 'dashboard.technical.read', 'customer.read', 'customer.sensitive.request',
      'commercial.read', 'commercial.write', 'support.read', 'support.write', 'session.read', 'session.terminate',
      'audit.read', 'technical.read', 'technical.write', 'build.request', 'configuration.prepare',
      'protocol.read', 'protocol.rotate'
    ]::text[]
    WHEN 'support' THEN ARRAY[
      'console.read', 'customer.read', 'commercial.read', 'support.read', 'support.write', 'protocol.read'
    ]::text[]
    WHEN 'auditor' THEN ARRAY['console.read', 'customer.read', 'commercial.read', 'audit.read', 'protocol.read']::text[]
    ELSE ARRAY[]::text[] END;
$$;

CREATE OR REPLACE FUNCTION private.is_owner_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.owner_admins oa WHERE oa.user_id = p_user_id AND oa.active)
    OR EXISTS (SELECT 1 FROM public.internal_staff s WHERE s.user_id = p_user_id AND s.role IN ('owner', 'developer') AND s.status = 'active')
  );
$$;

CREATE OR REPLACE FUNCTION public.list_internal_protocol_registry(
  p_search text DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_items jsonb; v_total bigint; v_term text := nullif(trim(p_search), '');
BEGIN
  IF NOT private.has_internal_permission('protocol.read') THEN
    RAISE EXCEPTION 'protocol_registry_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 100 OR p_offset < 0 THEN RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023'; END IF;
  WITH records AS (
    SELECT v.id, v.protocolo, v.protocol_series, v.protocol_year, v.protocol_seq, v.organization_id,
      coalesce(o.municipality_name, o.display_name, v.municipio, 'Agente individual') AS city,
      v."agenteNome" AS agent_name, v."dataVistoria" AS inspected_at, v.status,
      CASE WHEN v.organization_id IS NULL THEN 'individual' ELSE 'municipal' END AS subject_kind
    FROM public.vistorias v
    LEFT JOIN public.organizations o ON o.id = v.organization_id
    WHERE v.protocolo IS NOT NULL
      AND (p_organization_id IS NULL OR v.organization_id = p_organization_id)
      AND (v_term IS NULL OR v.protocolo ILIKE '%' || v_term || '%' OR coalesce(o.display_name, '') ILIKE '%' || v_term || '%' OR coalesce(o.municipality_name, '') ILIKE '%' || v_term || '%')
  ), paged AS (
    SELECT * FROM records ORDER BY inspected_at DESC NULLS LAST, protocolo DESC LIMIT p_limit OFFSET p_offset
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'protocol', protocolo, 'series', protocol_series, 'year', protocol_year, 'sequence', protocol_seq,
    'organization_id', organization_id, 'city', city, 'agent_name', agent_name, 'inspected_at', inspected_at,
    'status', status, 'subject_kind', subject_kind
  )), '[]'::jsonb), (SELECT count(*) FROM records) INTO v_items, v_total FROM paged;
  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'limit', p_limit, 'offset', p_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_internal_protocol_series()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_internal_permission('protocol.read') THEN RAISE EXCEPTION 'protocol_registry_read_not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'organization_id', s.organization_id, 'organization', o.display_name,
      'municipality', o.municipality_name, 'code', s.code, 'active', s.active, 'created_at', s.created_at,
      'current_year', extract(year FROM now())::integer,
      'current_sequence', coalesce(c.last_seq, 0)
    ) ORDER BY o.display_name, s.active DESC, s.created_at DESC)
    FROM public.protocol_series s
    JOIN public.organizations o ON o.id = s.organization_id
    LEFT JOIN public.protocol_counters c ON c.organization_id = s.organization_id AND c.protocol_series_id = s.id AND c.protocol_year = extract(year FROM now())::integer
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_internal_protocol_series(
  p_organization_id uuid,
  p_code text,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor uuid := auth.uid(); v_code text := upper(trim(p_code)); v_active public.protocol_series%ROWTYPE; v_created public.protocol_series%ROWTYPE; v_hash text; v_prior jsonb;
BEGIN
  IF NOT private.has_internal_permission('protocol.rotate', actor) THEN RAISE EXCEPTION 'protocol_series_rotation_not_allowed' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  IF v_code !~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$' OR char_length(v_code) > 80 THEN RAISE EXCEPTION 'invalid_protocol_series_code' USING ERRCODE = '22023'; END IF;
  IF char_length(trim(p_reason)) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN RAISE EXCEPTION 'organization_not_found' USING ERRCODE = 'P0002'; END IF;
  v_hash := md5(concat_ws('|', p_organization_id, v_code, trim(p_reason)));
  SELECT result INTO v_prior FROM public.internal_operations WHERE actor_id = actor AND operation_id = p_operation_id AND request_hash = v_hash;
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash) VALUES (p_operation_id, actor, 'protocol_series.rotate', v_hash);
  SELECT * INTO v_active FROM public.protocol_series WHERE organization_id = p_organization_id AND active FOR UPDATE;
  IF v_active.id IS NOT NULL THEN UPDATE public.protocol_series SET active = false, updated_at = now() WHERE id = v_active.id; END IF;
  INSERT INTO public.protocol_series(organization_id, code, active) VALUES (p_organization_id, v_code, true) RETURNING * INTO v_created;
  v_prior := jsonb_build_object('ok', true, 'previous_series', v_active.code, 'series', to_jsonb(v_created));
  UPDATE public.internal_operations SET status = 'succeeded', result = v_prior, completed_at = now() WHERE actor_id = actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (actor, private.current_internal_role(actor), 'protocol_series.rotate', 'organization', p_organization_id::text, 'allowed', left(trim(p_reason), 500), jsonb_build_object('previous_code', v_active.code, 'new_code', v_code));
  RETURN v_prior;
END;
$$;

REVOKE ALL ON FUNCTION public.list_internal_protocol_registry(text, uuid, integer, integer), public.list_internal_protocol_series(), public.rotate_internal_protocol_series(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_protocol_registry(text, uuid, integer, integer), public.list_internal_protocol_series(), public.rotate_internal_protocol_series(uuid, text, text, uuid) TO authenticated;

-- Publish only the individual entitlements that are operationally meaningful.
DO $$
DECLARE v_plan public.plans%ROWTYPE; v_version integer; v_configuration jsonb;
BEGIN
  SELECT * INTO v_plan FROM public.plans WHERE code = 'individual_professional' FOR UPDATE;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'individual_professional_plan_missing'; END IF;
  SELECT configuration INTO v_configuration FROM public.plan_versions WHERE plan_id = v_plan.id AND version = v_plan.current_version;
  UPDATE public.plans SET current_version = current_version + 1, updated_at = now() WHERE id = v_plan.id RETURNING current_version INTO v_version;
  INSERT INTO public.plan_versions(plan_id, version, configuration, published_at, created_by)
  VALUES (v_plan.id, v_version, coalesce(v_configuration, '{}'::jsonb), now(), NULL);
  DELETE FROM public.plan_limits WHERE plan_id = v_plan.id;
  INSERT INTO public.plan_limits(plan_id, resource_code, hard_limit, warning_percent, configuration) VALUES
    (v_plan.id, 'users', 1, 80, '{}'::jsonb),
    (v_plan.id, 'sessions', 1, 100, '{}'::jsonb),
    (v_plan.id, 'inspections', 150, 80, '{}'::jsonb);
  DELETE FROM public.plan_features WHERE plan_id = v_plan.id;
  INSERT INTO public.plan_features(plan_id, feature_code, enabled, configuration) VALUES
    (v_plan.id, 'inspection_standard', true, '{}'::jsonb),
    (v_plan.id, 'inspection_arv', true, '{}'::jsonb),
    (v_plan.id, 'training_mode', true, '{}'::jsonb),
    (v_plan.id, 'reports_basic', true, '{}'::jsonb),
    (v_plan.id, 'reports_advanced', true, '{}'::jsonb);
END $$;

-- Cataguases begins its municipal series with the agreed city code. When the
-- default series has issued documents, a new series is created instead so the
-- previous identifier remains a historical fact.
DO $$
DECLARE v_series public.protocol_series%ROWTYPE; v_org uuid;
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE lower(display_name) = lower('Prefeitura de Cataguases') LIMIT 1;
  IF v_org IS NULL THEN RETURN; END IF;
  SELECT * INTO v_series FROM public.protocol_series WHERE organization_id = v_org AND active FOR UPDATE;
  IF v_series.id IS NULL OR v_series.code = 'CATAGUASES' THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.protocol_allocation_events WHERE protocol_series_id = v_series.id) THEN
    UPDATE public.protocol_series SET active = false, updated_at = now() WHERE id = v_series.id;
    INSERT INTO public.protocol_series(organization_id, code, active) VALUES (v_org, 'CATAGUASES', true);
  ELSE
    UPDATE public.protocol_series SET code = 'CATAGUASES', updated_at = now() WHERE id = v_series.id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.sync_finalized_inspection(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_finalized_inspection(jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
