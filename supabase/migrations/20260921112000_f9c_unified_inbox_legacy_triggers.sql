-- F9c — gatilhos legados fn_notificar_* agora também emitem na caixa de
-- entrada unificada. Escrita legada em notificacoes mantida como arquivo.

CREATE OR REPLACE FUNCTION public.fn_notificar_alto_risco() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_endereco TEXT;
BEGIN
  IF NEW."nivelRisco" = 'alto' THEN
    v_endereco := COALESCE(NEW."enderecoRua", NEW.endereco, 'Endereço não informado');

    INSERT INTO public.notificacoes (tipo, titulo, corpo, payload, destinatario_role, municipio)
    VALUES ('alto_risco','🔴 Vistoria de Alto Risco', v_endereco || ' — Agente ' || COALESCE(NEW."agenteNome", ''),
      jsonb_build_object('vistoria_id', NEW.id, 'type', 'alto_risco'), 'supervisor', NEW.municipio);

    INSERT INTO public.notificacoes (tipo, titulo, corpo, payload, destinatario_role, municipio)
    VALUES ('alto_risco','🔴 Vistoria de Alto Risco', v_endereco || ' — Agente ' || COALESCE(NEW."agenteNome", ''),
      jsonb_build_object('vistoria_id', NEW.id, 'type', 'alto_risco'), 'admin', NEW.municipio);

    INSERT INTO public.notificacoes (tipo, titulo, corpo, payload, destinatario_role, municipio)
    VALUES ('alto_risco','🔴 Vistoria de Alto Risco',
      v_endereco || ' — ' || COALESCE(NEW.municipio, '') || ' — Agente ' || COALESCE(NEW."agenteNome", ''),
      jsonb_build_object('vistoria_id', NEW.id, 'type', 'alto_risco'), 'master_admin', NULL);

    PERFORM private.emit_inbox_event(
      'inspection.high_risk', 'vistorias',
      CASE WHEN NEW.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END,
      CASE WHEN NEW.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END,
      NULL, NEW.organization_id, NULL,
      'vistoria', NEW.id::text, 'critical',
      'Vistoria de alto risco',
      v_endereco || ' — Agente ' || COALESCE(NEW."agenteNome", ''),
      'vistorias',
      jsonb_build_object('vistoria_id', NEW.id, 'tipo', 'alto_risco'),
      'alto_risco:' || NEW.id::text,
      'vistoria:' || NEW.id::text,
      (
        SELECT coalesce(array_agg(u.uid), '{}'::uuid[])
        FROM public.users u
        WHERE coalesce(u."isApproved", false)
          AND (
            u.role = 'master_admin'
            OR (u.role IN ('supervisor','admin') AND (
              (NEW.organization_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.organization_members om
                WHERE om.organization_id = NEW.organization_id AND om.user_id = u.uid AND om.status='active'
              ))
              OR (NEW.organization_id IS NULL AND u.municipio = NEW.municipio)
            ))
          )
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_notificar_atribuicao_nova() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'pendente' THEN
    INSERT INTO public.notificacoes (tipo, titulo, corpo, payload, destinatario_uid, municipio)
    VALUES (
      'atribuicao_nova','📍 Nova Vistoria Atribuída',
      NEW.endereco_completo || ' — Prioridade: ' || NEW.prioridade,
      jsonb_build_object(
        'type', 'atribuicao_nova', 'atribuicao_id', NEW.id, 'endereco', NEW.endereco_completo,
        'prioridade', NEW.prioridade, 'municipio', NEW.municipio,
        'lat', NEW.lat, 'lng', NEW.lng, 'agendada_para', NEW.agendada_para
      ),
      NEW.agente_uid, NEW.municipio
    );

    IF NEW.agente_uid ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      PERFORM private.emit_inbox_event(
        'assignment.created', 'vistorias',
        CASE WHEN NEW.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END,
        CASE WHEN NEW.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END,
        NULL, NEW.organization_id, NEW.agente_uid::uuid,
        'atribuicao', NEW.id::text, 'info',
        'Nova vistoria atribuída a você',
        NEW.endereco_completo || ' — prioridade ' || coalesce(NEW.prioridade, 'normal'),
        'inspecoes',
        jsonb_build_object('atribuicao_id', NEW.id, 'endereco', NEW.endereco_completo, 'prioridade', NEW.prioridade),
        'atribuicao:' || NEW.id::text,
        NULL,
        ARRAY[NEW.agente_uid::uuid]
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_notificar_formulario_publicado() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW."publicadoEm" IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD."publicadoEm" IS NULL) THEN

    INSERT INTO public.notificacoes (tipo, titulo, corpo, payload, destinatario_role, municipio)
    VALUES ('formulario_novo','📋 Novo formulário disponível',
      COALESCE(NEW.titulo, 'Formulário') || ' — Atualize antes da próxima vistoria.',
      jsonb_build_object('formulario_id', NEW.id, 'type', 'formulario_novo'), 'agent', NULL);

    INSERT INTO public.notificacoes (tipo, titulo, corpo, payload, destinatario_role, municipio)
    VALUES ('formulario_novo','📋 Novo formulário disponível',
      COALESCE(NEW.titulo, 'Formulário') || ' — Atualize antes da próxima vistoria.',
      jsonb_build_object('formulario_id', NEW.id, 'type', 'formulario_novo'), 'supervisor', NULL);

    PERFORM private.emit_inbox_event(
      'form.published', 'formularios',
      CASE WHEN NEW.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END,
      CASE WHEN NEW.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END,
      NULL, NEW.organization_id, NULL,
      'formulario', NEW.id::text, 'info',
      'Novo formulário publicado',
      COALESCE(NEW.titulo, 'Formulário') || ' — atualize antes da próxima vistoria.',
      'formularios',
      jsonb_build_object('formulario_id', NEW.id),
      'form_publicado:' || NEW.id::text,
      NULL,
      (
        SELECT coalesce(array_agg(u.uid), '{}'::uuid[])
        FROM public.users u
        WHERE coalesce(u."isApproved", false)
          AND u.role IN ('agent','supervisor')
          AND (
            (NEW.organization_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.organization_members om
              WHERE om.organization_id = NEW.organization_id AND om.user_id = u.uid AND om.status='active'
            ))
            OR (NEW.organization_id IS NULL AND (NEW.municipio IS NULL OR u.municipio = NEW.municipio))
          )
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_notificar_novo_usuario() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notificacoes (tipo, titulo, corpo, payload, destinatario_role, municipio)
  VALUES ('novo_usuario','👤 Novo usuário cadastrado',
    COALESCE(NEW.name, NEW.email, 'Usuário') || ' — ' || COALESCE(NEW.municipio, '') || ' — ' || COALESCE(NEW.role, 'agent'),
    jsonb_build_object('usuario_uid', NEW.uid, 'type', 'novo_usuario'), 'admin', NEW.municipio);

  INSERT INTO public.notificacoes (tipo, titulo, corpo, payload, destinatario_role, municipio)
  VALUES ('novo_usuario','👤 Novo usuário cadastrado',
    COALESCE(NEW.name, NEW.email, 'Usuário') || ' — ' || COALESCE(NEW.municipio, '') || ' — ' || COALESCE(NEW.role, 'agent'),
    jsonb_build_object('usuario_uid', NEW.uid, 'type', 'novo_usuario'), 'master_admin', NULL);

  PERFORM private.emit_inbox_event(
    'user.registered', 'usuarios',
    CASE WHEN NEW.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END,
    CASE WHEN NEW.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END,
    NULL, NEW.organization_id, NULL,
    'usuario', NEW.uid::text, 'info',
    'Novo usuário cadastrado',
    COALESCE(NEW.name, NEW.email, 'Usuário') || ' — ' || COALESCE(NEW.municipio, '') || ' — ' || COALESCE(NEW.role, 'agent'),
    'usuarios',
    jsonb_build_object('usuario_uid', NEW.uid),
    'usuario_novo:' || NEW.uid::text,
    NULL,
    (
      SELECT coalesce(array_agg(u.uid), '{}'::uuid[])
      FROM public.users u
      WHERE coalesce(u."isApproved", false)
        AND u.uid IS DISTINCT FROM NEW.uid
        AND (
          u.role = 'master_admin'
          OR (u.role = 'admin' AND (
            (NEW.organization_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.organization_members om
              WHERE om.organization_id = NEW.organization_id AND om.user_id = u.uid AND om.status='active'
            ))
            OR (NEW.organization_id IS NULL AND u.municipio = NEW.municipio)
          ))
        )
    )
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_notificar_token_usado() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.usado = TRUE AND (OLD.usado = FALSE OR OLD.usado IS NULL) THEN

    INSERT INTO public.notificacoes (tipo, titulo, corpo, payload, destinatario_role, municipio)
    VALUES ('token_usado','🎟️ Token Utilizado','Novo ' || NEW.role || ' cadastrou-se em ' || NEW.municipio,
      jsonb_build_object('type','token_usado','municipio',NEW.municipio,'role',NEW.role,'codigo',NEW.codigo),
      'supervisor', NEW.municipio);

    INSERT INTO public.notificacoes (tipo, titulo, corpo, payload, destinatario_role, municipio)
    VALUES ('token_usado','🎟️ Token Utilizado','Novo ' || NEW.role || ' cadastrou-se em ' || NEW.municipio,
      jsonb_build_object('type','token_usado','municipio',NEW.municipio,'role',NEW.role,'codigo',NEW.codigo),
      'admin', NEW.municipio);

    INSERT INTO public.notificacoes (tipo, titulo, corpo, payload, destinatario_role, municipio)
    VALUES ('token_usado','🎟️ Token em ' || NEW.municipio,'Novo ' || NEW.role || ' cadastrou-se em ' || NEW.municipio,
      jsonb_build_object('type','token_usado','municipio',NEW.municipio,'role',NEW.role,'codigo',NEW.codigo),
      'master_admin', NULL);

    PERFORM private.emit_inbox_event(
      'invite.used', 'admin',
      CASE WHEN NEW.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END,
      CASE WHEN NEW.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END,
      NULL, NEW.organization_id, NULL,
      'invite_token', NEW.codigo, 'info',
      'Convite utilizado',
      'Novo ' || COALESCE(NEW.role,'agente') || ' cadastrou-se em ' || COALESCE(NEW.municipio,'—'),
      'tokens',
      jsonb_build_object('municipio', NEW.municipio, 'role', NEW.role, 'codigo', NEW.codigo),
      'token_usado:' || NEW.codigo,
      NULL,
      (
        SELECT coalesce(array_agg(u.uid), '{}'::uuid[])
        FROM public.users u
        WHERE coalesce(u."isApproved", false)
          AND (
            u.role = 'master_admin'
            OR (u.role IN ('supervisor','admin') AND (
              (NEW.organization_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.organization_members om
                WHERE om.organization_id = NEW.organization_id AND om.user_id = u.uid AND om.status='active'
              ))
              OR (NEW.organization_id IS NULL AND u.municipio = NEW.municipio)
            ))
          )
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;
