BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(8);

INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  ('94000000-0000-4000-8000-000000000001', 'storage-a@example.test', now(), '{}'::jsonb),
  ('94000000-0000-4000-8000-000000000002', 'storage-b@example.test', now(), '{}'::jsonb),
  ('94000000-0000-4000-8000-000000000003', 'storage-c@example.test', now(), '{}'::jsonb);

INSERT INTO public.organizations(id, slug, display_name, status)
VALUES
  ('94100000-0000-4000-8000-000000000001', 'storage-org-a', 'Storage Org A', 'pilot'),
  ('94100000-0000-4000-8000-000000000002', 'storage-org-b', 'Storage Org B', 'pilot');
INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at)
VALUES
  ('94100000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001', 'agent', 'active', now()),
  ('94100000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000002', 'owner', 'active', now()),
  ('94100000-0000-4000-8000-000000000002', '94000000-0000-4000-8000-000000000003', 'owner', 'active', now());

SELECT extensions.ok(
  private.can_write_customer_storage_object('fotos', 'users/94000000-0000-4000-8000-000000000001/vistoria/foto.jpg', '94000000-0000-4000-8000-000000000001'),
  'customer can write only below its immutable user prefix'
);
SELECT extensions.ok(
  NOT private.can_write_customer_storage_object('fotos', 'users/94000000-0000-4000-8000-000000000003/vistoria/foto.jpg', '94000000-0000-4000-8000-000000000001'),
  'customer cannot forge another user prefix'
);
SELECT extensions.ok(
  NOT private.can_write_customer_storage_object('fotos', '2026/Municipio/vistoria/foto.jpg', '94000000-0000-4000-8000-000000000001'),
  'new writes cannot use an unscoped legacy path'
);
SELECT extensions.ok(
  private.can_access_customer_storage_object('fotos', 'users/94000000-0000-4000-8000-000000000001/vistoria/foto.jpg', '94000000-0000-4000-8000-000000000001'),
  'object owner can read its media'
);
SELECT extensions.ok(
  private.can_access_customer_storage_object('fotos', 'users/94000000-0000-4000-8000-000000000001/vistoria/foto.jpg', '94000000-0000-4000-8000-000000000002'),
  'active administrator in the same organization can read member media'
);
SELECT extensions.ok(
  NOT private.can_access_customer_storage_object('fotos', 'users/94000000-0000-4000-8000-000000000001/vistoria/foto.jpg', '94000000-0000-4000-8000-000000000003'),
  'another organization cannot read customer media'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'private.can_access_customer_storage_object(text,text,uuid)', 'EXECUTE'),
  'anonymous role cannot call the storage authorization helper'
);
SELECT extensions.ok(
  has_function_privilege('authenticated', 'private.can_access_customer_storage_object(text,text,uuid)', 'EXECUTE'),
  'authenticated Storage policies can execute the authorization helper'
);

SELECT * FROM extensions.finish();
ROLLBACK;
