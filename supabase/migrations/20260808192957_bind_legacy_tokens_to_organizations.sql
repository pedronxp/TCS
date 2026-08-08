-- Legacy mobile codes remain supported, but every newly issued municipal code
-- is bound to an organization and can be accepted by an authenticated Google
-- or password identity without trusting client metadata.

CREATE OR REPLACE FUNCTION private.bind_legacy_invite_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization uuid;
BEGIN
  IF NEW.organization_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT organization.id INTO v_organization
  FROM public.organizations AS organization
  WHERE lower(trim(organization.municipality_name)) = lower(trim(NEW.municipio))
    AND organization.status IN ('onboarding','trial','active')
  ORDER BY organization.created_at
  LIMIT 1;
  IF v_organization IS NULL THEN
    RAISE EXCEPTION 'municipal_organization_not_found' USING ERRCODE = '23503';
  END IF;
  NEW.organization_id := v_organization;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.bind_legacy_invite_organization()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS invite_tokens_bind_organization ON public.invite_tokens;
CREATE TRIGGER invite_tokens_bind_organization
BEFORE INSERT OR UPDATE OF municipio, organization_id
ON public.invite_tokens
FOR EACH ROW
EXECUTE FUNCTION private.bind_legacy_invite_organization();

CREATE OR REPLACE FUNCTION public.accept_legacy_municipal_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_invite public.invite_tokens%ROWTYPE;
  v_member_role text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT lower(email), email_confirmed_at INTO v_email, v_confirmed FROM auth.users WHERE id = v_user;
  IF v_confirmed IS NULL THEN RAISE EXCEPTION 'verified_email_required' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_invite
  FROM public.invite_tokens
  WHERE upper(trim(codigo)) = upper(trim(p_token))
  FOR UPDATE;
  IF v_invite.codigo IS NULL THEN RETURN jsonb_build_object('accepted', false, 'reason', 'invalid'); END IF;
  IF coalesce(v_invite.usado, false) THEN RETURN jsonb_build_object('accepted', false, 'reason', 'already_used'); END IF;
  IF v_invite."expiraEm" IS NOT NULL AND v_invite."expiraEm" <= now() THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'expired');
  END IF;
  IF v_invite.email_destinatario IS NOT NULL
     AND lower(trim(v_invite.email_destinatario)) <> v_email THEN
    RAISE EXCEPTION 'email_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_invite.organization_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'organization_missing');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE organization_id = v_invite.organization_id
      AND status IN ('trial','active','grace')
  ) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'subscription_inactive');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_user AND status IN ('active','invited','suspended')
  ) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'membership_conflict');
  END IF;

  PERFORM public.reconcile_customer_identity();
  v_member_role := CASE
    WHEN v_invite.role = 'admin' THEN 'coordinator'
    WHEN v_invite.role = 'supervisor' THEN 'supervisor'
    ELSE 'agent'
  END;
  INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at)
  VALUES (v_invite.organization_id, v_user, v_member_role, 'active', now());

  UPDATE public.invite_tokens
  SET usado = true,
      "usadoPorUid" = v_user,
      "usadoPorNome" = coalesce((SELECT name FROM public.users WHERE uid = v_user), split_part(v_email, '@', 1)),
      "usadoEm" = now(),
      usado_em = now()
  WHERE codigo = v_invite.codigo;

  RETURN jsonb_build_object(
    'accepted', true,
    'organization_id', v_invite.organization_id,
    'role', v_member_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_legacy_municipal_invite(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_legacy_municipal_invite(text)
  TO authenticated;
