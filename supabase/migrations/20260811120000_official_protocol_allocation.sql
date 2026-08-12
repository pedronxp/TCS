-- Official inspection protocols are allocated only by this server-side transaction.
-- Municipality remains inspection metadata and is deliberately absent from the
-- counter scope and number format.

ALTER TABLE public.vistorias
  ADD COLUMN IF NOT EXISTS protocol_series text,
  ADD COLUMN IF NOT EXISTS protocol_year integer,
  ADD COLUMN IF NOT EXISTS protocol_seq bigint,
  ADD COLUMN IF NOT EXISTS protocolo_seq bigint;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.vistorias
    WHERE protocolo IS NOT NULL
    GROUP BY protocolo
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'legacy_duplicate_protocols_require_reconciliation: public.vistorias contains duplicated protocolo values'
      USING ERRCODE = '23505',
            HINT = 'Reconcile duplicated historical protocols before enabling official allocation; no protocol was renumbered.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vistorias'::regclass
      AND conname = 'vistorias_protocolo_unique'
  ) THEN
    ALTER TABLE public.vistorias
      ADD CONSTRAINT vistorias_protocolo_unique UNIQUE (protocolo);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vistorias'::regclass
      AND conname = 'vistorias_organization_protocol_sequence_unique'
  ) THEN
    ALTER TABLE public.vistorias
      ADD CONSTRAINT vistorias_organization_protocol_sequence_unique
      UNIQUE (organization_id, protocol_series, protocol_year, protocol_seq);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vistorias'::regclass
      AND conname = 'vistorias_official_protocol_parts_check'
  ) THEN
    ALTER TABLE public.vistorias
      ADD CONSTRAINT vistorias_official_protocol_parts_check CHECK (
        (protocol_series IS NULL AND protocol_year IS NULL AND protocol_seq IS NULL)
        OR (
          protocol_series IS NOT NULL
          AND protocol_year BETWEEN 2000 AND 9999
          AND protocol_seq > 0
        )
      );
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.protocol_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE CHECK (code = upper(code) AND code ~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS protocol_series_one_active_per_organization
  ON public.protocol_series(organization_id)
  WHERE active;

CREATE TABLE IF NOT EXISTS public.protocol_counters (
  organization_id uuid NOT NULL,
  protocol_series_id uuid NOT NULL,
  protocol_year integer NOT NULL CHECK (protocol_year BETWEEN 2000 AND 9999),
  last_seq bigint NOT NULL CHECK (last_seq >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, protocol_series_id, protocol_year),
  FOREIGN KEY (protocol_series_id, organization_id)
    REFERENCES public.protocol_series(id, organization_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.protocol_allocation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  protocol_series_id uuid NOT NULL,
  protocol_series text NOT NULL,
  protocol_year integer NOT NULL CHECK (protocol_year BETWEEN 2000 AND 9999),
  protocol_seq bigint NOT NULL CHECK (protocol_seq > 0),
  protocol text NOT NULL UNIQUE,
  idempotency_key uuid NOT NULL UNIQUE,
  allocated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (protocol_series_id, organization_id)
    REFERENCES public.protocol_series(id, organization_id) ON DELETE RESTRICT,
  UNIQUE (organization_id, protocol_series, protocol_year, protocol_seq)
);

CREATE OR REPLACE FUNCTION private.create_default_protocol_series()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.protocol_series(organization_id, code)
  VALUES (
    NEW.id,
    'ORG-' || upper(right(replace(NEW.id::text, '-', ''), 12))
  )
  ON CONFLICT (organization_id) WHERE active DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_create_default_protocol_series ON public.organizations;
CREATE TRIGGER organizations_create_default_protocol_series
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION private.create_default_protocol_series();

INSERT INTO public.protocol_series(organization_id, code)
SELECT
  organization.id,
  'ORG-' || upper(right(replace(organization.id::text, '-', ''), 12))
FROM public.organizations AS organization
WHERE NOT EXISTS (
  SELECT 1
  FROM public.protocol_series AS series
  WHERE series.organization_id = organization.id AND series.active
);

CREATE OR REPLACE FUNCTION private.guard_official_protocol_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.official_protocol_allocation', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.protocolo IS NOT NULL
      OR NEW.protocol_series IS NOT NULL
      OR NEW.protocol_year IS NOT NULL
      OR NEW.protocol_seq IS NOT NULL
      OR NEW.protocolo_seq IS NOT NULL
    THEN
      RAISE EXCEPTION 'official_protocol_server_only' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.protocolo IS DISTINCT FROM OLD.protocolo
    OR NEW.protocol_series IS DISTINCT FROM OLD.protocol_series
    OR NEW.protocol_year IS DISTINCT FROM OLD.protocol_year
    OR NEW.protocol_seq IS DISTINCT FROM OLD.protocol_seq
    OR NEW.protocolo_seq IS DISTINCT FROM OLD.protocolo_seq
  THEN
    RAISE EXCEPTION 'official_protocol_server_only' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vistorias_guard_official_protocol_fields ON public.vistorias;
CREATE TRIGGER vistorias_guard_official_protocol_fields
BEFORE INSERT OR UPDATE OF protocolo, protocol_series, protocol_year, protocol_seq, protocolo_seq
ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION private.guard_official_protocol_fields();

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
  v_event public.protocol_allocation_events%ROWTYPE;
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
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_required_for_official_protocol' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM public.vistorias
  WHERE id = v_inspection_id
  FOR UPDATE;

  SELECT * INTO v_event
  FROM public.protocol_allocation_events
  WHERE inspection_id = v_inspection_id;

  IF v_existing.id IS NULL AND v_event.id IS NOT NULL THEN
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
  IF v_existing.id IS NOT NULL AND v_event.id IS NOT NULL THEN
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
    )
    RETURNING * INTO v_saved;
  ELSE
    UPDATE public.vistorias
    SET
      "agenteUid" = v_input."agenteUid",
      "agenteNome" = v_input."agenteNome",
      municipio = v_input.municipio,
      "enderecoRua" = v_input."enderecoRua",
      "enderecoNumero" = v_input."enderecoNumero",
      "enderecoBairro" = v_input."enderecoBairro",
      "enderecoCep" = v_input."enderecoCep",
      "responsavelNome" = v_input."responsavelNome",
      latitude = v_input.latitude,
      longitude = v_input.longitude,
      "dataVistoria" = v_input."dataVistoria",
      "formularioId" = v_input."formularioId",
      "formularioVersao" = v_input."formularioVersao",
      "respostasJson" = v_input."respostasJson",
      "calculoRisco" = v_input."calculoRisco",
      "nivelRisco" = v_input."nivelRisco",
      "pontuacaoTotal" = v_input."pontuacaoTotal",
      "fotoUrl" = v_input."fotoUrl",
      "fotosUrls" = v_input."fotosUrls",
      laudo_url = v_input.laudo_url,
      laudo_gerado_em = v_input.laudo_gerado_em,
      endereco = v_input.endereco,
      status = v_input.status
    WHERE id = v_inspection_id
    RETURNING * INTO v_saved;
  END IF;

  SELECT * INTO v_series
  FROM public.protocol_series
  WHERE organization_id = v_organization_id AND active
  FOR UPDATE;
  IF v_series.id IS NULL THEN
    RAISE EXCEPTION 'active_protocol_series_required' USING ERRCODE = 'P0002';
  END IF;

  v_year := extract(year FROM coalesce(v_input."dataVistoria", now()))::integer;
  INSERT INTO public.protocol_counters(
    organization_id, protocol_series_id, protocol_year, last_seq
  ) VALUES (
    v_organization_id, v_series.id, v_year, 1
  )
  ON CONFLICT (organization_id, protocol_series_id, protocol_year)
  DO UPDATE SET last_seq = public.protocol_counters.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO v_seq;

  v_protocol := format('TCS-%s-%s-%s', v_series.code, v_year, lpad(v_seq::text, 6, '0'));
  PERFORM set_config('app.official_protocol_allocation', 'on', true);
  UPDATE public.vistorias
  SET protocolo = v_protocol,
      protocol_series = v_series.code,
      protocol_year = v_year,
      protocol_seq = v_seq,
      protocolo_seq = v_seq
  WHERE id = v_saved.id;

  INSERT INTO public.protocol_allocation_events(
    inspection_id, organization_id, protocol_series_id, protocol_series,
    protocol_year, protocol_seq, protocol, idempotency_key, allocated_by
  ) VALUES (
    v_saved.id, v_organization_id, v_series.id, v_series.code,
    v_year, v_seq, v_protocol, v_saved.id, v_actor_id
  );

  RETURN jsonb_build_object(
    'inspection_id', v_saved.id,
    'organization_id', v_organization_id,
    'protocol', v_protocol,
    'official', true,
    'legacy', false
  );
END;
$$;

ALTER TABLE public.protocol_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_allocation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.protocol_series, public.protocol_counters, public.protocol_allocation_events
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.create_default_protocol_series(), private.guard_official_protocol_fields()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_finalized_inspection(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_finalized_inspection(jsonb) TO authenticated;

COMMENT ON FUNCTION public.sync_finalized_inspection(jsonb) IS
  'Finalization RPC: resolves organization from membership, ignores municipality for sequence scope, allocates one immutable official protocol, and uses inspection UUID as its idempotency key.';
COMMENT ON TABLE public.protocol_allocation_events IS
  'Append-only allocation ledger. Retained after inspection deletion so official sequence values are never reused.';
