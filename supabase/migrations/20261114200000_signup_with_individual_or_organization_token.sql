CREATE TABLE private.individual_signup_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nonce_hash text NOT NULL UNIQUE,
 key_id uuid NOT NULL REFERENCES private.individual_access_keys(id), email text NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), consumed_by uuid REFERENCES auth.users(id)
);
CREATE INDEX individual_signup_claims_key_created ON private.individual_signup_claims(key_id,created_at);
REVOKE ALL ON private.individual_signup_claims FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.search_signup_organizations(p_search text)
RETURNS TABLE(id uuid, name text, municipality text, uf text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT o.id, o.display_name, o.municipality_name, o.state_code FROM public.organizations o
 WHERE length(btrim(p_search)) BETWEEN 2 AND 120 AND o.status IN ('onboarding','pilot','active')
 AND strpos(translate(lower(concat_ws(' ',o.display_name,o.municipality_name,o.state_code)), 'áàãâéêíóôõúüç', 'aaaaeeiooouuc'),translate(lower(btrim(p_search)), 'áàãâéêíóôõúüç', 'aaaaeeiooouuc')) > 0
 ORDER BY o.display_name,o.id LIMIT 20;
$$;

CREATE FUNCTION public.prepare_individual_key_signup(p_code text,p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k private.individual_access_keys; nonce text; normalized_email text := lower(btrim(p_email));
BEGIN
 IF normalized_email IS NULL OR normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'signup_email_invalid'; END IF;
 SELECT * INTO k FROM private.individual_access_keys WHERE code_hash=md5(upper(btrim(p_code))) FOR UPDATE;
 IF k.id IS NULL OR k.used_at IS NOT NULL OR k.revoked_at IS NOT NULL OR k.expires_at <= now() THEN RAISE EXCEPTION 'key_unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.plans WHERE id=k.plan_id AND status='active') THEN RAISE EXCEPTION 'individual_plan_not_published'; END IF;
 IF (SELECT count(*) FROM private.individual_signup_claims WHERE key_id=k.id AND created_at>now()-interval '1 hour') >= 20 THEN RAISE EXCEPTION 'key_rate_limit'; END IF;
 nonce := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
 INSERT INTO private.individual_signup_claims(nonce_hash,key_id,email,expires_at) VALUES(md5(nonce),k.id,normalized_email,least(k.expires_at,now()+interval '15 minutes'));
 RETURN jsonb_build_object('individual_signup_nonce',nonce,'access_days',k.access_days,'expires_at',k.expires_at);
END $$;

CREATE FUNCTION public.prepare_organization_token_signup(p_codigo text,p_email text,p_organization_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation public.invite_tokens;
BEGIN
 SELECT * INTO invitation FROM public.invite_tokens WHERE upper(btrim(codigo))=upper(btrim(p_codigo)) FOR UPDATE;
 IF invitation.codigo IS NULL OR coalesce(invitation.usado,false) OR invitation.revoked_at IS NOT NULL OR invitation."expiraEm" <= now() THEN RAISE EXCEPTION 'invalid_invitation'; END IF;
 IF p_organization_id IS NULL OR invitation.organization_id IS DISTINCT FROM p_organization_id THEN RAISE EXCEPTION 'invitation_organization_mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_organization_id AND status IN ('onboarding','pilot','active')) THEN RAISE EXCEPTION 'organization_unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE organization_id=p_organization_id AND status IN ('trial','active','grace') AND coalesce(CASE status WHEN 'grace' THEN grace_ends_at WHEN 'trial' THEN coalesce(trial_ends_at,current_period_end) ELSE current_period_end END,'infinity'::timestamptz)>now()) THEN RAISE EXCEPTION 'municipal_subscription_inactive'; END IF;
 RETURN public.prepare_legacy_invite_signup(p_codigo,p_email);
END $$;

-- Runs before the existing on_auth_user_created AFTER INSERT trigger. Both run
-- in the Auth transaction: a failure rolls back the identity and key consumption.
CREATE FUNCTION private.apply_signup_access_token() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE nonce text := nullif(btrim(NEW.raw_user_meta_data->>'individual_signup_nonce'),'');
 claim private.individual_signup_claims; k private.individual_access_keys; invitation public.invite_tokens;
 legacy_claim private.signup_invite_claims; access_end timestamptz;
BEGIN
 IF nonce IS NOT NULL AND nullif(NEW.raw_user_meta_data->>'signup_claim_nonce','') IS NOT NULL THEN RAISE EXCEPTION 'conflicting_signup_tokens'; END IF;
 IF nonce IS NULL THEN
   -- Recheck lifecycle at actual signup, including older clients.
   IF nullif(NEW.raw_user_meta_data->>'signup_claim_nonce','') IS NOT NULL THEN
     SELECT * INTO legacy_claim FROM private.signup_invite_claims WHERE nonce_hash=encode(extensions.digest(NEW.raw_user_meta_data->>'signup_claim_nonce','sha256'),'hex');
     SELECT * INTO invitation FROM public.invite_tokens WHERE codigo=legacy_claim.legacy_invite_code FOR UPDATE;
     IF invitation.codigo IS NULL OR invitation.revoked_at IS NOT NULL OR coalesce(invitation.usado,false) OR invitation."expiraEm"<=now() THEN RAISE EXCEPTION 'invalid_invitation'; END IF;
     IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=invitation.organization_id AND status IN ('onboarding','pilot','active')) THEN RAISE EXCEPTION 'organization_unavailable'; END IF;
     IF NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE organization_id=invitation.organization_id AND status IN ('trial','active','grace') AND coalesce(CASE status WHEN 'grace' THEN grace_ends_at WHEN 'trial' THEN coalesce(trial_ends_at,current_period_end) ELSE current_period_end END,'infinity'::timestamptz)>now()) THEN RAISE EXCEPTION 'municipal_subscription_inactive'; END IF;
   END IF;
   RETURN NEW;
 END IF;
 SELECT * INTO claim FROM private.individual_signup_claims WHERE nonce_hash=md5(nonce) FOR UPDATE;
 IF claim.id IS NULL OR claim.consumed_by IS NOT NULL OR claim.expires_at<=now() OR claim.email IS DISTINCT FROM lower(btrim(NEW.email)) THEN RAISE EXCEPTION 'invalid_or_expired_signup_claim'; END IF;
 SELECT * INTO k FROM private.individual_access_keys WHERE id=claim.key_id FOR UPDATE;
 IF k.id IS NULL OR k.used_at IS NOT NULL OR k.revoked_at IS NOT NULL OR k.expires_at<=now() THEN RAISE EXCEPTION 'key_unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.plans WHERE id=k.plan_id AND status='active') THEN RAISE EXCEPTION 'individual_plan_not_published'; END IF;
 INSERT INTO public.users(uid,name,username,email,phone,role,municipio,"isApproved",organization_id,"createdAt")
 VALUES(NEW.id,left(coalesce(nullif(btrim(NEW.raw_user_meta_data->>'name'),''),split_part(NEW.email,'@',1)),150),
 'individual-'||replace(NEW.id::text,'-',''),lower(btrim(NEW.email)),nullif(left(regexp_replace(coalesce(NEW.raw_user_meta_data->>'phone',''),'[^0-9+]','','g'),20),''),'agent',NULL,true,NULL,now());
 access_end := now()+make_interval(days=>k.access_days);
 INSERT INTO public.subscriptions(plan_id,plan_version_id,user_id,status,current_period_start,current_period_end,provider,cancel_at_period_end)
 VALUES(k.plan_id,k.plan_version_id,NEW.id,'active',now(),access_end,'access_key',true);
 UPDATE private.individual_access_keys SET used_by=NEW.id,used_at=now() WHERE id=k.id;
 UPDATE private.individual_signup_claims SET consumed_by=NEW.id WHERE id=claim.id;
 UPDATE auth.users SET raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)-'individual_signup_nonce' WHERE id=NEW.id;
 INSERT INTO public.subscription_audit_events(actor_id,event_type,entity_type,entity_id,metadata)
 VALUES(NEW.id,'individual_key_signup','individual_access_key',k.id::text,jsonb_build_object('access_until',access_end));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.apply_signup_access_token() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_apply_signup_access_token AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.apply_signup_access_token();
REVOKE ALL ON FUNCTION public.search_signup_organizations(text),public.prepare_individual_key_signup(text,text),public.prepare_organization_token_signup(text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_signup_organizations(text),public.prepare_individual_key_signup(text,text),public.prepare_organization_token_signup(text,text,uuid) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
