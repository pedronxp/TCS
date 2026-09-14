-- Agenda consentida do WhatsApp. Ela só é preenchida depois que uma conta é
-- vinculada e fica disponível apenas para a equipe interna autorizada.
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sessao_id uuid NOT NULL REFERENCES public.bot_sessoes(id) ON DELETE CASCADE,
  jid text NOT NULL,
  telefone text NOT NULL,
  nome text,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_contacts_session_jid_unique UNIQUE (sessao_id, jid)
);
CREATE INDEX IF NOT EXISTS whatsapp_contacts_org_nome_idx
  ON public.whatsapp_contacts (organization_id, nome);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_contacts FROM PUBLIC, anon, authenticated;

-- Não há SELECT direto pelo cliente: a RPC abaixo valida a permissão antes de
-- expor nome e telefone ao console interno.
CREATE OR REPLACE FUNCTION public.internal_list_whatsapp_contacts(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'sessao_id', c.sessao_id, 'jid', c.jid,
      'telefone', c.telefone, 'nome', c.nome, 'sincronizado_em', c.sincronizado_em
    ) ORDER BY coalesce(c.nome, c.telefone), c.telefone)
    FROM public.whatsapp_contacts c
    WHERE c.organization_id = p_organization_id
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.internal_list_whatsapp_contacts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_list_whatsapp_contacts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_delete_whatsapp_contact(p_contact_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.whatsapp_contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.internal_delete_whatsapp_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_delete_whatsapp_contact(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_clear_whatsapp_contacts(p_organization_id uuid, p_sessao_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.whatsapp_contacts
  WHERE organization_id = p_organization_id
    AND (p_sessao_id IS NULL OR sessao_id = p_sessao_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.internal_clear_whatsapp_contacts(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_clear_whatsapp_contacts(uuid, uuid) TO authenticated;
