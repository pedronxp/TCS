-- Secure, auditable restoration queue for archived inspections.
-- Direct table access remains closed; the console uses the RPC boundary below.

ALTER TABLE public.vistorias
  ADD COLUMN IF NOT EXISTS archive_manifest jsonb,
  ADD COLUMN IF NOT EXISTS archive_checksum text,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz;

CREATE TABLE public.archive_restore_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  inspection_id uuid NOT NULL REFERENCES public.vistorias(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 8 AND 500),
  requires_second_approval boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN (
    'pending', 'approved', 'restoring', 'restored', 'rejected', 'failed'
  )),
  approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  decision_reason text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 20),
  started_at timestamptz,
  completed_at timestamptz,
  restored_manifest jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requested_by, operation_id, inspection_id),
  CHECK (
    NOT requires_second_approval
    OR approved_by IS NULL
    OR approved_by <> requested_by
  )
);

CREATE UNIQUE INDEX archive_restore_requests_one_active_per_inspection
  ON public.archive_restore_requests(inspection_id)
  WHERE status IN ('pending', 'approved', 'restoring');
CREATE INDEX archive_restore_requests_queue_idx
  ON public.archive_restore_requests(status, requested_at DESC);
CREATE INDEX archive_restore_requests_batch_idx
  ON public.archive_restore_requests(batch_id, requested_at);

ALTER TABLE public.archive_restore_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.archive_restore_requests FROM PUBLIC, anon, authenticated;

CREATE TRIGGER archive_restore_requests_set_updated_at
BEFORE UPDATE ON public.archive_restore_requests
FOR EACH ROW EXECUTE FUNCTION private.set_internal_updated_at();

CREATE OR REPLACE FUNCTION private.record_archive_restore_event(
  p_actor uuid,
  p_action text,
  p_request_id uuid,
  p_result text,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.internal_access_events(
    actor_id, actor_role, action, target_type, target_id, result, reason, metadata
  ) VALUES (
    p_actor,
    private.current_internal_role(p_actor),
    left(p_action, 120),
    'archive_restore_request',
    p_request_id::text,
    p_result,
    left(p_reason, 500),
    private.sanitize_internal_metadata(p_metadata)
  );
$$;

REVOKE ALL ON FUNCTION private.record_archive_restore_event(
  uuid, text, uuid, text, text, jsonb
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_internal_archive_lifecycle(
  p_limit integer DEFAULT 250
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cfg jsonb;
  days_threshold integer;
BEGIN
  IF NOT private.has_internal_permission('configuration.publish') THEN
    RAISE EXCEPTION 'archive_read_not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT c.valor INTO cfg
  FROM public.configuracoes c
  WHERE c.id = 'arquivamento';
  cfg := COALESCE(cfg, '{"mode":"manual","enabled":false,"days_threshold":7}'::jsonb);
  days_threshold := GREATEST(1, LEAST(365, COALESCE((cfg->>'days_threshold')::integer, 7)));

  RETURN jsonb_build_object(
    'config', cfg,
    'pending', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id,
        'protocol', v.protocolo,
        'municipality', v.municipio,
        'risk', v."nivelRisco",
        'inspection_at', v."dataVistoria",
        'storage_location', v.storage_location
      ) ORDER BY v."dataVistoria")
      FROM (
        SELECT *
        FROM public.vistorias
        WHERE storage_location = 'supabase'
          AND "dataVistoria" < now() - make_interval(days => days_threshold)
        ORDER BY "dataVistoria"
        LIMIT LEAST(GREATEST(p_limit, 1), 500)
      ) v
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id,
        'protocol', v.protocolo,
        'municipality', v.municipio,
        'risk', v."nivelRisco",
        'inspection_at', v."dataVistoria",
        'storage_location', v.storage_location,
        'drive_folder_url', v.drive_folder_url,
        'archived_at', v.archived_at,
        'restored_at', v.restored_at,
        'manifest_verified', v.archive_checksum IS NOT NULL
      ) ORDER BY COALESCE(v.archived_at, v."dataVistoria") DESC)
      FROM (
        SELECT *
        FROM public.vistorias
        WHERE storage_location <> 'supabase'
           OR archived_at IS NOT NULL
        ORDER BY COALESCE(archived_at, "dataVistoria") DESC
        LIMIT LEAST(GREATEST(p_limit, 1), 500)
      ) v
    ), '[]'::jsonb),
    'restore_requests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'batch_id', r.batch_id,
        'inspection_id', r.inspection_id,
        'protocol', v.protocolo,
        'municipality', v.municipio,
        'status', r.status,
        'reason', r.reason,
        'requires_second_approval', r.requires_second_approval,
        'requested_by', r.requested_by,
        'requested_by_name', COALESCE(requester.display_name, 'Equipe interna'),
        'requested_at', r.requested_at,
        'approved_by', r.approved_by,
        'approved_by_name', approver.display_name,
        'approved_at', r.approved_at,
        'attempt_count', r.attempt_count,
        'last_error', r.last_error,
        'completed_at', r.completed_at
      ) ORDER BY r.requested_at DESC)
      FROM (
        SELECT *
        FROM public.archive_restore_requests
        ORDER BY requested_at DESC
        LIMIT LEAST(GREATEST(p_limit, 1), 500)
      ) r
      JOIN public.vistorias v ON v.id = r.inspection_id
      LEFT JOIN public.internal_staff requester ON requester.user_id = r.requested_by
      LEFT JOIN public.internal_staff approver ON approver.user_id = r.approved_by
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_internal_archive_restore(
  p_inspection_ids text[],
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  batch uuid := gen_random_uuid();
  current_inspection_id text;
  request_id uuid;
  request_status text;
  is_bulk boolean;
  request_ids jsonb := '[]'::jsonb;
BEGIN
  IF actor IS NULL OR NOT private.has_internal_permission('configuration.publish', actor) THEN
    RAISE EXCEPTION 'archive_restore_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN
    RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'operation_id_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(COALESCE(p_reason, ''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'restore_reason_invalid' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(array_length(p_inspection_ids, 1), 0) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'restore_selection_invalid' USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT value) > 1 INTO is_bulk
  FROM unnest(p_inspection_ids) AS value;
  request_status := CASE WHEN is_bulk THEN 'pending' ELSE 'approved' END;

  FOREACH current_inspection_id IN ARRAY p_inspection_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = current_inspection_id AND v.storage_location = 'drive'
    ) THEN
      RAISE EXCEPTION 'inspection_not_archived:%', current_inspection_id USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.archive_restore_requests(
      batch_id, operation_id, inspection_id, requested_by, reason,
      requires_second_approval, status, approved_by, approved_at
    ) VALUES (
      batch, p_operation_id, current_inspection_id, actor, trim(p_reason),
      is_bulk, request_status,
      CASE WHEN is_bulk THEN NULL ELSE actor END,
      CASE WHEN is_bulk THEN NULL ELSE now() END
    )
    ON CONFLICT (requested_by, operation_id, inspection_id)
    DO UPDATE SET updated_at = public.archive_restore_requests.updated_at
    RETURNING id INTO request_id;

    request_ids := request_ids || to_jsonb(request_id);
    PERFORM private.record_archive_restore_event(
      actor, 'archive.restore.requested', request_id, 'allowed', p_reason,
      jsonb_build_object('batch_id', batch, 'bulk', is_bulk, 'inspection_id', current_inspection_id)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'batch_id', batch,
    'request_ids', request_ids,
    'status', request_status,
    'requires_second_approval', is_bulk
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_internal_archive_restore(
  p_request_id uuid,
  p_approve boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  target public.archive_restore_requests;
  next_status text;
  decided_request public.archive_restore_requests;
  decided_ids jsonb := '[]'::jsonb;
BEGIN
  IF actor IS NULL OR NOT private.has_internal_permission('configuration.publish', actor) THEN
    RAISE EXCEPTION 'archive_restore_approval_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN
    RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501';
  END IF;
  IF char_length(trim(COALESCE(p_reason, ''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'decision_reason_invalid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO target
  FROM public.archive_restore_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF target.id IS NULL OR target.status <> 'pending' THEN
    RAISE EXCEPTION 'restore_request_not_pending' USING ERRCODE = 'P0002';
  END IF;
  IF target.requires_second_approval AND target.requested_by = actor THEN
    RAISE EXCEPTION 'second_owner_required' USING ERRCODE = '42501';
  END IF;

  next_status := CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
  UPDATE public.archive_restore_requests
  SET status = next_status,
      approved_by = actor,
      approved_at = now(),
      decision_reason = trim(p_reason),
      completed_at = CASE WHEN p_approve THEN NULL ELSE now() END
  WHERE batch_id = target.batch_id
    AND status = 'pending';

  FOR decided_request IN
    SELECT *
    FROM public.archive_restore_requests
    WHERE batch_id = target.batch_id
      AND approved_by = actor
      AND status = next_status
  LOOP
    decided_ids := decided_ids || to_jsonb(decided_request.id);
    PERFORM private.record_archive_restore_event(
      actor,
      CASE WHEN p_approve THEN 'archive.restore.approved' ELSE 'archive.restore.rejected' END,
      decided_request.id,
      'allowed',
      p_reason,
      jsonb_build_object(
        'batch_id', target.batch_id,
        'inspection_id', decided_request.inspection_id
      )
    );
  END LOOP;
  RETURN jsonb_build_object(
    'id', p_request_id,
    'batch_id', target.batch_id,
    'request_ids', decided_ids,
    'status', next_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_internal_archive_restore(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  target public.archive_restore_requests;
  inspection public.vistorias;
BEGIN
  IF actor IS NULL OR NOT private.has_internal_permission('configuration.publish', actor) THEN
    RAISE EXCEPTION 'archive_restore_execution_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN
    RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO target
  FROM public.archive_restore_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF target.id IS NULL OR target.status NOT IN ('approved', 'failed') THEN
    RAISE EXCEPTION 'restore_request_not_executable' USING ERRCODE = 'P0002';
  END IF;
  IF target.attempt_count >= 20 THEN
    RAISE EXCEPTION 'restore_retry_limit_reached' USING ERRCODE = '54000';
  END IF;

  SELECT * INTO inspection FROM public.vistorias WHERE id = target.inspection_id;
  IF inspection.id IS NULL OR inspection.storage_location <> 'drive' THEN
    RAISE EXCEPTION 'inspection_not_archived' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.archive_restore_requests
  SET status = 'restoring',
      attempt_count = attempt_count + 1,
      started_at = now(),
      last_error = NULL
  WHERE id = p_request_id;

  PERFORM private.record_archive_restore_event(
    actor, 'archive.restore.started', p_request_id, 'allowed', target.reason,
    jsonb_build_object('inspection_id', target.inspection_id, 'attempt', target.attempt_count + 1)
  );

  RETURN jsonb_build_object(
    'request_id', target.id,
    'inspection_id', inspection.id,
    'municipality', inspection.municipio,
    'drive_folder_url', inspection.drive_folder_url,
    'drive_file_ids', COALESCE(inspection.drive_file_ids, '{}'::jsonb),
    'archive_manifest', COALESCE(inspection.archive_manifest, '[]'::jsonb),
    'archive_checksum', inspection.archive_checksum,
    'photo_references', COALESCE(to_jsonb(inspection."fotosUrls"), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_archive_restore_internal(
  p_request_id uuid,
  p_actor_id uuid,
  p_restored_manifest jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.archive_restore_requests;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target
  FROM public.archive_restore_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF target.id IS NULL OR target.status <> 'restoring' THEN
    RAISE EXCEPTION 'restore_request_not_running' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.vistorias
  SET storage_location = 'supabase', restored_at = now()
  WHERE id = target.inspection_id AND storage_location = 'drive';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inspection_restore_state_conflict' USING ERRCODE = '40001';
  END IF;

  UPDATE public.archive_restore_requests
  SET status = 'restored',
      restored_manifest = p_restored_manifest,
      last_error = NULL,
      completed_at = now()
  WHERE id = p_request_id;
  PERFORM private.record_archive_restore_event(
    p_actor_id, 'archive.restore.completed', p_request_id, 'allowed', target.reason,
    jsonb_build_object(
      'inspection_id', target.inspection_id,
      'files', jsonb_array_length(COALESCE(p_restored_manifest, '[]'::jsonb)),
      'checksums_verified', true
    )
  );
  RETURN jsonb_build_object('id', p_request_id, 'status', 'restored');
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_archive_restore_internal(
  p_request_id uuid,
  p_actor_id uuid,
  p_error text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.archive_restore_requests;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target
  FROM public.archive_restore_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF target.id IS NULL THEN RETURN; END IF;
  UPDATE public.archive_restore_requests
  SET status = 'failed',
      last_error = left(COALESCE(p_error, 'restore_failed'), 500),
      completed_at = now()
  WHERE id = p_request_id;
  PERFORM private.record_archive_restore_event(
    p_actor_id, 'archive.restore.failed', p_request_id, 'failed', p_error,
    jsonb_build_object('inspection_id', target.inspection_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_internal_archive_lifecycle(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_internal_archive_restore(text[], text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_internal_archive_restore(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_internal_archive_restore(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_archive_lifecycle(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_internal_archive_restore(text[], text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_internal_archive_restore(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_internal_archive_restore(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finalize_archive_restore_internal(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_archive_restore_internal(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_archive_restore_internal(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_archive_restore_internal(uuid, uuid, text) TO service_role;
