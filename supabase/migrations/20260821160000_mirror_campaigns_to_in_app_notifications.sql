-- A campaign must remain visible in-product even when a device has not yet
-- registered a push endpoint. Push is an additional delivery channel, not the
-- sole record of an operational notice.

CREATE OR REPLACE FUNCTION private.mirror_campaign_to_in_app_notifications()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_roles text[];
BEGIN
  v_roles := CASE WHEN cardinality(coalesce(NEW.target_roles, ARRAY[]::text[])) = 0
    THEN ARRAY['agent', 'supervisor', 'admin', 'master_admin']::text[]
    ELSE NEW.target_roles
  END;
  INSERT INTO public.notificacoes(titulo, corpo, tipo, municipio, destinatario_role, payload)
  SELECT NEW.title, NEW.body, NEW.category, NEW.municipio, role,
    jsonb_build_object('campaign_id', NEW.id, 'priority', NEW.priority, 'source', 'notification_campaign')
  FROM unnest(v_roles) AS role;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_campaigns_create_in_app_notification ON public.notification_campaigns;
CREATE TRIGGER notification_campaigns_create_in_app_notification
  AFTER INSERT ON public.notification_campaigns
  FOR EACH ROW EXECUTE FUNCTION private.mirror_campaign_to_in_app_notifications();

REVOKE ALL ON FUNCTION private.mirror_campaign_to_in_app_notifications() FROM PUBLIC, anon, authenticated;
