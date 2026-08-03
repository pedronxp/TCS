BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(18);

CREATE TEMP TABLE identity_claim_result(payload jsonb);
GRANT SELECT, INSERT ON identity_claim_result TO anon, authenticated;

-- User-editable Auth metadata is presentation-only and cannot grant access.
INSERT INTO auth.users(
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data
) VALUES (
  '61000000-0000-4000-8000-000000000001',
  'malicious@example.test',
  now(),
  '{"name":"Malicious","role":"master_admin","municipio":"Qualquer","organization_id":"62000000-0000-4000-8000-000000000001","isApproved":true}'::jsonb,
  '{"provider":"google"}'::jsonb
);

SELECT extensions.is(
  (SELECT role FROM public.users WHERE uid = '61000000-0000-4000-8000-000000000001'),
  'agent',
  'forged metadata creates only a neutral agent profile'
);
SELECT extensions.is(
  (SELECT coalesce("isApproved", false) FROM public.users WHERE uid = '61000000-0000-4000-8000-000000000001'),
  false,
  'forged metadata cannot approve a profile'
);
SELECT extensions.is(
  (SELECT municipio FROM public.users WHERE uid = '61000000-0000-4000-8000-000000000001'),
  NULL::text,
  'forged municipality is ignored'
);
SELECT extensions.is(
  (SELECT organization_id FROM public.users WHERE uid = '61000000-0000-4000-8000-000000000001'),
  NULL::uuid,
  'forged organization is ignored'
);
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.owner_admins
    WHERE user_id = '61000000-0000-4000-8000-000000000001'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = '61000000-0000-4000-8000-000000000001'
  ),
  'public signup creates no platform or internal staff role'
);
SELECT extensions.is(
  (SELECT count(*) FROM public.organization_members WHERE user_id = '61000000-0000-4000-8000-000000000001'),
  0::bigint,
  'forged metadata creates no membership'
);

SELECT extensions.throws_ok(
  $$
    INSERT INTO auth.users(id, email, raw_user_meta_data)
    VALUES (
      '61000000-0000-4000-8000-000000000002',
      'invalid-claim@example.test',
      '{"signup_claim_nonce":"not-a-real-claim"}'::jsonb
    )
  $$,
  '42501',
  'invalid_or_expired_signup_claim',
  'an invalid opaque claim aborts the whole auth insert'
);

INSERT INTO public.organizations(
  id, slug, display_name, municipality_name, state_code, status
) VALUES (
  '62000000-0000-4000-8000-000000000001',
  'identity-security-test',
  'Identity Security Test',
  'Cataguases',
  'MG',
  'pilot'
);

INSERT INTO public.invite_tokens(
  codigo,
  "criadoPorNome",
  email_destinatario,
  "expiraEm",
  municipio,
  organization_id,
  role,
  usado
) VALUES (
  'SECU-RITY-0001',
  'Security Test',
  'invited@example.test',
  now() + interval '1 hour',
  'Cataguases',
  '62000000-0000-4000-8000-000000000001',
  'supervisor',
  false
);

SET LOCAL ROLE anon;
INSERT INTO identity_claim_result(payload)
SELECT public.prepare_legacy_invite_signup(
  'SECU-RITY-0001',
  'invited@example.test'
);
RESET ROLE;

SELECT extensions.ok(
  length((SELECT payload->>'signup_claim_nonce' FROM identity_claim_result)) = 64,
  'anonymous registration receives a short-lived opaque claim'
);
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM private.signup_invite_claims
    WHERE nonce_hash = (SELECT payload->>'signup_claim_nonce' FROM identity_claim_result)
  ),
  'the claim table stores only the nonce hash'
);

INSERT INTO auth.users(
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data
)
SELECT
  '61000000-0000-4000-8000-000000000003',
  'invited@example.test',
  now(),
  jsonb_build_object(
    'name', 'Invited Supervisor',
    'role', 'master_admin',
    'municipio', 'Forjado',
    'signup_claim_nonce', payload->>'signup_claim_nonce'
  )
FROM identity_claim_result;

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = '61000000-0000-4000-8000-000000000003'
      AND raw_user_meta_data ? 'signup_claim_nonce'
  ),
  'the transport nonce is removed from Auth metadata before commit'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.users
    WHERE uid = '61000000-0000-4000-8000-000000000003'
      AND role = 'supervisor'
      AND municipio = 'Cataguases'
      AND organization_id = '62000000-0000-4000-8000-000000000001'
      AND "isApproved" = true
  ),
  'profile authorization is derived from the locked server invitation'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = '61000000-0000-4000-8000-000000000003'
      AND organization_id = '62000000-0000-4000-8000-000000000001'
      AND role = 'supervisor'
      AND status = 'active'
  ),
  'trusted organization invitation creates the compatible membership atomically'
);
SELECT extensions.ok(
  (SELECT usado FROM public.invite_tokens WHERE codigo = 'SECU-RITY-0001')
  AND EXISTS (
    SELECT 1 FROM private.signup_invite_claims
    WHERE legacy_invite_code = 'SECU-RITY-0001'
      AND status = 'consumed'
      AND consumed_by = '61000000-0000-4000-8000-000000000003'
  ),
  'invitation and claim are consumed in the auth transaction'
);
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.owner_admins
    WHERE user_id = '61000000-0000-4000-8000-000000000003'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = '61000000-0000-4000-8000-000000000003'
  ),
  'trusted customer invitations still cannot create internal roles'
);

SELECT extensions.throws_ok(
  format(
    $sql$
      INSERT INTO auth.users(id, email, raw_user_meta_data)
      VALUES (
        '61000000-0000-4000-8000-000000000004',
        'invited@example.test',
        %L::jsonb
      )
    $sql$,
    jsonb_build_object(
      'signup_claim_nonce',
      (SELECT payload->>'signup_claim_nonce' FROM identity_claim_result)
    )::text
  ),
  '42501',
  'invalid_or_expired_signup_claim',
  'a consumed claim cannot be reused'
);

SELECT extensions.ok(
  NOT has_function_privilege(
    'anon',
    'public.mark_token_used(text,uuid,text,text)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.mark_token_used(text,uuid,text,text)',
    'EXECUTE'
  ),
  'legacy non-atomic invitation consumption is closed to clients'
);

SELECT extensions.ok(
  NOT has_function_privilege(
    'authenticated',
    'public.portal_ensure_individual_profile()',
    'EXECUTE'
  ),
  'legacy profile activation cannot bypass customer bootstrap'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.users
    WHERE uid = '61000000-0000-4000-8000-000000000001'
      AND role = 'agent'
      AND municipio IS NULL
      AND organization_id IS NULL
      AND "isApproved" = false
  ),
  'neutral identity remains pending until authoritative bootstrap'
);

SELECT * FROM extensions.finish();
ROLLBACK;
