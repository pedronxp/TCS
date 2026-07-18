BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(12);

SELECT extensions.has_table('public', 'generated_documents', 'generated_documents exists');
SELECT extensions.has_table('public', 'document_acknowledgement_events', 'acknowledgement events exists');
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.generated_documents'::regclass),
  'generated_documents has RLS enabled'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.document_acknowledgement_events'::regclass),
  'acknowledgement events has RLS enabled'
);
SELECT extensions.has_function('public', 'finalize_document_acknowledgement', ARRAY['jsonb'], 'public finalization wrapper exists');
SELECT extensions.has_function('private', 'finalize_document_acknowledgement', ARRAY['jsonb'], 'private privileged finalizer exists');
SELECT extensions.has_function('public', 'append_document_acknowledgement_correction', ARRAY['uuid','text','text'], 'correction wrapper exists');
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.generated_documents', 'INSERT'),
  'authenticated cannot insert documents directly'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.document_acknowledgement_events', 'UPDATE'),
  'authenticated cannot update append-only events'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.document_acknowledgement_events', 'DELETE'),
  'authenticated cannot delete append-only events'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'document-evidence' AND public = false),
  'document evidence bucket is private'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname IN ('document_evidence_insert','document_evidence_select')),
  2,
  'storage has scoped insert and select policies'
);

SELECT * FROM extensions.finish();
ROLLBACK;
