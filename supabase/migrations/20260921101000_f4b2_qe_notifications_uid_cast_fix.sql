-- F4b2 — correção de tipo no trigger de notificação QE
-- users.uid é uuid e vistorias."agenteUid" é text: comparar com cast.

CREATE OR REPLACE FUNCTION public.enqueue_qe_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_ciclo int;
  v_rev_id uuid;
BEGIN
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    SELECT coalesce(max(ciclo), 0) + 1 INTO v_ciclo
    FROM public.revisoes_qe WHERE vistoria_id = NEW.id;

    INSERT INTO public.revisoes_qe (vistoria_id, organization_id, municipio, ciclo, status)
    VALUES (NEW.id, NEW.organization_id, NEW.municipio, v_ciclo, 'pendente')
    ON CONFLICT (vistoria_id, ciclo) DO NOTHING
    RETURNING id INTO v_rev_id;

    IF v_rev_id IS NOT NULL THEN
      INSERT INTO public.notificacoes (tipo, titulo, corpo, destinatario_uid, municipio, payload, lida, criada_em)
      SELECT
        'qe_fila_nova',
        'Nova vistoria na fila de qualidade',
        coalesce(nullif(btrim(NEW."agenteNome"), ''), 'Um agente')
          || ' concluiu a vistoria em '
          || coalesce(nullif(btrim(NEW.endereco), ''), 'endereço não informado')
          || ' — toque para revisar.',
        u.uid,
        NEW.municipio,
        jsonb_build_object('vistoria_id', NEW.id, 'revisao_id', v_rev_id, 'ciclo', v_ciclo),
        false,
        now()
      FROM public.users u
      WHERE u.role IN ('supervisor', 'admin')
        AND coalesce(u."isApproved", false)
        AND u.uid::text IS DISTINCT FROM NEW."agenteUid"
        AND (
          (NEW.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = NEW.organization_id
              AND om.user_id = u.uid
              AND om.status = 'active'
          ))
          OR
          (NEW.organization_id IS NULL AND u.municipio = NEW.municipio)
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
