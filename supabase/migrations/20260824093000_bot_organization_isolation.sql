-- Impede que uma entrega associe comunicado e comunidade de organizações
-- diferentes, inclusive quando a escrita é feita pelo worker service_role.

CREATE OR REPLACE FUNCTION private.enforce_canal_envio_organization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  channel_organization_id uuid;
  message_organization_id uuid;
BEGIN
  SELECT channel.organization_id
    INTO channel_organization_id
  FROM public.canais_externos channel
  WHERE channel.id = NEW.canal_id;

  SELECT message.organization_id
    INTO message_organization_id
  FROM public.comunicados message
  WHERE message.id = NEW.comunicado_id;

  IF channel_organization_id IS NULL
     OR message_organization_id IS NULL
     OR channel_organization_id IS DISTINCT FROM message_organization_id THEN
    RAISE EXCEPTION 'canal_envio_organization_mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS canal_envios_enforce_organization ON public.canal_envios;
CREATE TRIGGER canal_envios_enforce_organization
BEFORE INSERT OR UPDATE OF canal_id, comunicado_id ON public.canal_envios
FOR EACH ROW EXECUTE FUNCTION private.enforce_canal_envio_organization();

CREATE INDEX IF NOT EXISTS canal_envios_comunicado_idx
  ON public.canal_envios (comunicado_id);

REVOKE ALL ON FUNCTION private.enforce_canal_envio_organization()
  FROM PUBLIC, anon, authenticated;
