BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(2);

INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
VALUES ('95000000-0000-4000-8000-000000000001', 'whatsapp-recovery-owner@example.test', now(), '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.internal_staff(user_id, role, status, display_name)
VALUES ('95000000-0000-4000-8000-000000000001', 'owner', 'active', 'WhatsApp Recovery Owner')
ON CONFLICT (user_id) DO UPDATE SET role = 'owner', status = 'active';

INSERT INTO public.organizations(id, slug, display_name, municipality_name, status)
VALUES ('95000000-0000-4000-8000-000000000002', 'whatsapp-recovery-org', 'WhatsApp Recovery Org', 'Recovery', 'pilot')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bot_sessoes(
  id, organization_id, vinculado_por, telefone, status,
  expected_phone, pairing_method, pairing_ready
)
VALUES (
  '95000000-0000-4000-8000-000000000003',
  '95000000-0000-4000-8000-000000000002',
  '95000000-0000-4000-8000-000000000001',
  '5532984792322', 'desconectado', '32984792322', 'qr', true
);

INSERT INTO private.bot_auth_state(session_id, key_category, key_id, encrypted_payload)
VALUES ('95000000-0000-4000-8000-000000000003', 'creds', 'creds', 'stale-encrypted-credentials');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
SELECT public.prepare_bot_session_pairing(
  '95000000-0000-4000-8000-000000000003',
  '32984792322', '', 'qr'
);
RESET ROLE;

SELECT extensions.is(
  (SELECT count(*)::integer FROM private.bot_auth_state
   WHERE session_id = '95000000-0000-4000-8000-000000000003'),
  0,
  'preparing a fresh QR removes stale encrypted Baileys credentials'
);
SELECT extensions.ok(
  (SELECT status = 'aguardando_qr' AND pairing_ready AND pairing_method = 'qr'
   FROM public.bot_sessoes
   WHERE id = '95000000-0000-4000-8000-000000000003'),
  'session remains ready for a fresh QR after credentials are cleared'
);

SELECT * FROM extensions.finish();
ROLLBACK;
