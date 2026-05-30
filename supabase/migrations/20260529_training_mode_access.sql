-- ============================================================
-- Training mode: collective class tokens and temporary participants
-- ============================================================

CREATE TABLE IF NOT EXISTS public.training_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  token text NOT NULL UNIQUE,
  limite_participantes integer NOT NULL CHECK (limite_participantes > 0),
  inicio_em timestamptz NOT NULL,
  fim_em timestamptz NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  encerrado_em timestamptz,
  formularios_permitidos text[] NOT NULL DEFAULT ARRAY['vistoria_deslizamento_v3','risco_estrutural_novo_v2'],
  criado_por uuid REFERENCES auth.users(id),
  criado_por_nome text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_classes_valid_window CHECK (fim_em > inicio_em)
);

CREATE TABLE IF NOT EXISTS public.training_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_class_id uuid NOT NULL REFERENCES public.training_classes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  device_id text NOT NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'expirado', 'encerrado')),
  entrou_em timestamptz NOT NULL DEFAULT now(),
  ultimo_acesso_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_class_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_training_classes_token ON public.training_classes (token);
CREATE INDEX IF NOT EXISTS idx_training_classes_status ON public.training_classes (ativo, inicio_em, fim_em);
CREATE INDEX IF NOT EXISTS idx_training_participants_class ON public.training_participants (training_class_id, status);

ALTER TABLE public.training_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master_admin_manage_training_classes" ON public.training_classes;
CREATE POLICY "master_admin_manage_training_classes"
ON public.training_classes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.uid = auth.uid()
      AND u.role = 'master_admin'
      AND u."isApproved" = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.uid = auth.uid()
      AND u.role = 'master_admin'
      AND u."isApproved" = true
  )
);

DROP POLICY IF EXISTS "master_admin_read_training_participants" ON public.training_participants;
CREATE POLICY "master_admin_read_training_participants"
ON public.training_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.uid = auth.uid()
      AND u.role = 'master_admin'
      AND u."isApproved" = true
  )
);

CREATE OR REPLACE FUNCTION public.touch_training_class_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_classes_updated_at ON public.training_classes;
CREATE TRIGGER trg_training_classes_updated_at
BEFORE UPDATE ON public.training_classes
FOR EACH ROW
EXECUTE FUNCTION public.touch_training_class_updated_at();

CREATE OR REPLACE FUNCTION public.training_expire_elapsed_classes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  DELETE FROM public.training_participants p
  USING public.training_classes c
  WHERE p.training_class_id = c.id
    AND (
      c.ativo = false
      OR c.encerrado_em IS NOT NULL
      OR now() > c.fim_em
      OR p.ultimo_acesso_em < now() - interval '5 minutes'
    );

  DELETE FROM public.training_classes
  WHERE ativo = false
    OR encerrado_em IS NOT NULL
    OR now() > fim_em;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.training_class_leave(
  p_class_id uuid,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id text := trim(p_device_id);
BEGIN
  IF p_class_id IS NULL OR v_device_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'invalid_input');
  END IF;

  DELETE FROM public.training_participants
  WHERE training_class_id = p_class_id
    AND device_id = v_device_id;

  RETURN jsonb_build_object('ok', true, 'status', 'left');
END;
$$;

CREATE OR REPLACE FUNCTION public.training_class_cleanup()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.training_participants p
  USING public.training_classes c
  WHERE p.training_class_id = c.id
    AND (
      c.ativo = false
      OR c.encerrado_em IS NOT NULL
      OR now() > c.fim_em
      OR p.ultimo_acesso_em < now() - interval '5 minutes'
    );

  DELETE FROM public.training_classes
  WHERE ativo = false
    OR encerrado_em IS NOT NULL
    OR now() > fim_em;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.training_class_entry(
  p_token text,
  p_nome text,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class public.training_classes%ROWTYPE;
  v_count integer;
  v_participant public.training_participants%ROWTYPE;
  v_now timestamptz := now();
  v_token text := upper(trim(p_token));
  v_nome text := trim(p_nome);
  v_device_id text := trim(p_device_id);
BEGIN
  IF v_token = '' OR v_nome = '' OR v_device_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'invalid_input', 'message', 'Informe nome e token para acessar o treinamento.');
  END IF;

  SELECT *
  INTO v_class
  FROM public.training_classes
  WHERE token = v_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 'invalid_token', 'message', 'Token de treinamento invalido, expirado ou encerrado.');
  END IF;

  DELETE FROM public.training_participants
  WHERE training_class_id = v_class.id
    AND ultimo_acesso_em < v_now - interval '5 minutes';

  IF v_class.ativo = false OR v_class.encerrado_em IS NOT NULL THEN
    DELETE FROM public.training_classes WHERE id = v_class.id;
    RETURN jsonb_build_object('ok', false, 'status', 'ended', 'message', 'Treinamento encerrado.', 'className', v_class.nome, 'endsAt', v_class.fim_em);
  END IF;

  IF v_now < v_class.inicio_em THEN
    RETURN jsonb_build_object('ok', false, 'status', 'not_started', 'message', 'Este treinamento ainda nao iniciou.', 'className', v_class.nome, 'startsAt', v_class.inicio_em);
  END IF;

  IF v_now > v_class.fim_em THEN
    DELETE FROM public.training_classes WHERE id = v_class.id;
    RETURN jsonb_build_object('ok', false, 'status', 'expired', 'message', 'Treinamento encerrado.', 'className', v_class.nome, 'endsAt', v_class.fim_em);
  END IF;

  SELECT *
  INTO v_participant
  FROM public.training_participants
  WHERE training_class_id = v_class.id
    AND device_id = v_device_id;

  IF FOUND THEN
    UPDATE public.training_participants
    SET nome = v_nome,
        status = 'ativo',
        ultimo_acesso_em = v_now
    WHERE id = v_participant.id
    RETURNING * INTO v_participant;
  ELSE
    SELECT COUNT(*)
    INTO v_count
    FROM public.training_participants
    WHERE training_class_id = v_class.id
      AND status = 'ativo'
      AND ultimo_acesso_em >= v_now - interval '5 minutes';

    IF v_count >= v_class.limite_participantes THEN
      RETURN jsonb_build_object(
        'ok', false,
        'status', 'full',
        'message', 'Limite de participantes atingido.',
        'className', v_class.nome,
        'participantCount', v_count,
        'participantLimit', v_class.limite_participantes
      );
    END IF;

    INSERT INTO public.training_participants (training_class_id, nome, device_id)
    VALUES (v_class.id, v_nome, v_device_id)
    RETURNING * INTO v_participant;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.training_participants
  WHERE training_class_id = v_class.id
    AND status = 'ativo'
    AND ultimo_acesso_em >= v_now - interval '5 minutes';

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'accepted',
    'classId', v_class.id,
    'className', v_class.nome,
    'token', v_class.token,
    'participantId', v_participant.id,
    'participantName', v_participant.nome,
    'participantCount', v_count,
    'participantLimit', v_class.limite_participantes,
    'startsAt', v_class.inicio_em,
    'endsAt', v_class.fim_em,
    'allowedForms', v_class.formularios_permitidos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.training_class_entry(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.training_expire_elapsed_classes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.training_class_leave(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.training_class_cleanup() TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    BEGIN
      PERFORM cron.unschedule('training_class_cleanup_every_minute');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'training_class_cleanup_every_minute',
      '* * * * *',
      $job$SELECT public.training_class_cleanup();$job$
    );
  END IF;
END;
$$;
