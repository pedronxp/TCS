-- Domain eligibility is part of claiming an invitation, not a client-side
-- pre-check. Keeping it in the claim transaction prevents a forged signup from
-- bypassing the municipal email-domain rule.
CREATE OR REPLACE FUNCTION public.prepare_legacy_invite_signup(p_codigo text, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_invite public.invite_tokens%ROWTYPE;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_nonce text;
  v_expires_at timestamptz := now() + interval '15 minutes';
  v_role text;
  v_domains text[];
  v_domain text;
BEGIN
  IF p_codigo IS NULL OR trim(p_codigo) = ''
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = '22023';
  END IF;
  SELECT invitation.* INTO v_invite FROM public.invite_tokens AS invitation
  WHERE upper(trim(invitation.codigo)) = upper(trim(p_codigo)) FOR UPDATE;
  IF NOT FOUND OR coalesce(v_invite.usado, false)
     OR (v_invite."expiraEm" IS NOT NULL AND v_invite."expiraEm" <= now()) THEN
    RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = '22023';
  END IF;
  IF v_invite.email_destinatario IS NOT NULL
     AND lower(trim(v_invite.email_destinatario)) <> v_email THEN
    RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = '42501';
  END IF;
  SELECT m.dominios_email INTO v_domains FROM public.municipios AS m WHERE m.nome = v_invite.municipio;
  v_domain := lower(split_part(v_email, '@', 2));
  IF coalesce(array_length(v_domains, 1), 0) > 0
     AND NOT (v_domain = ANY(ARRAY(SELECT lower(btrim(domain)) FROM unnest(v_domains) AS domain))) THEN
    RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = '42501';
  END IF;
  v_role := coalesce(nullif(trim(v_invite.role), ''), 'agent');
  IF v_role NOT IN ('admin', 'supervisor', 'agent') THEN
    RAISE EXCEPTION 'invalid_invitation_role' USING ERRCODE = '42501';
  END IF;
  UPDATE private.signup_invite_claims
  SET status = CASE WHEN expires_at <= now() THEN 'expired' ELSE 'revoked' END
  WHERE legacy_invite_code = v_invite.codigo AND status = 'pending';
  v_nonce := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO private.signup_invite_claims (nonce_hash, legacy_invite_code, email, expires_at)
  VALUES (encode(extensions.digest(v_nonce, 'sha256'), 'hex'), v_invite.codigo, v_email, v_expires_at);
  RETURN jsonb_build_object('signup_claim_nonce', v_nonce, 'expires_at', v_expires_at);
END;
$function$;

-- No caller needs a separate municipal-domain oracle anymore.
-- check_email_domain is absent from the versioned history (its original
-- definition migration was dropped during the paridade reorganization). In
-- legacy catalogs where it still exists, retain the hardening: revoke PUBLIC,
-- anon and authenticated so no browser role can call the now-redundant domain
-- oracle. On a clean catalog this is a no-op so the migration applies
-- deterministically alongside the versioned history.
DO $block$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'check_email_domain'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'text, text'
  ) THEN
    REVOKE ALL ON FUNCTION public.check_email_domain(text, text) FROM PUBLIC, anon, authenticated;
  END IF;
END $block$;
