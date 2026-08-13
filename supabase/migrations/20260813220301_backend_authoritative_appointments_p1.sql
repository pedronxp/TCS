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
  IF v_actor_role NOT IN ('agent', 'supervisor', 'admin', 'master_admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_titulo) < 2 OR char_length(v_titulo) > 180 OR v_data IS NULL THEN
    RAISE EXCEPTION 'invalid_appointment' USING ERRCODE = '22023';
  END IF;
  v_municipio := CASE WHEN v_actor_role = 'master_admin' THEN nullif(btrim(p_payload->>'municipio'), '') ELSE v_actor_municipio END;
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
    v_id, v_titulo, v_endereco, v_municipio, v_data, auth.uid(), coalesce(v_actor_name, ''),
    v_agente_uid, v_agente_nome,
    nullif(p_payload->>'lat', '')::double precision, nullif(p_payload->>'lng', '')::double precision,
    nullif(btrim(coalesce(p_payload->>'observacoes', '')), ''), 'pendente', 'app', now()
  ) ON CONFLICT (id) DO NOTHING;

  IF NOT FOUND AND NOT EXISTS (
    SELECT 1 FROM public.agendamentos WHERE id = v_id
      AND (criado_por_uid = auth.uid() OR v_actor_role = 'master_admin')
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
  UPDATE public.agendamentos
  SET status = p_status, inspection_id = coalesce(p_inspection_id, inspection_id)
  WHERE id = p_id
    AND (v_actor_role = 'master_admin' OR criado_por_uid = auth.uid() OR agente_uid = auth.uid())
    AND (v_actor_role = 'master_admin' OR municipio = v_actor_municipio);
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
  DELETE FROM public.agendamentos
  WHERE id = p_id
    AND (v_actor_role = 'master_admin' OR criado_por_uid = auth.uid())
    AND (v_actor_role = 'master_admin' OR municipio = v_actor_municipio);
  IF NOT FOUND THEN RAISE EXCEPTION 'appointment_not_found_or_forbidden' USING ERRCODE = '42501'; END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_operational_appointment(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_operational_appointment(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_operational_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_operational_appointment(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_operational_appointment(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_operational_appointment(uuid) TO authenticated;
