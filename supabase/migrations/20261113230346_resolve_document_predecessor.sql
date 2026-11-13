-- Offline versions may supersede a draft that was never published. Link to
-- the nearest preserved predecessor of this inspection and document type.
CREATE FUNCTION private.resolve_generated_document_predecessor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.generated_documents AS predecessor
    WHERE predecessor.id = NEW.supersedes_id
      AND predecessor.vistoria_id = NEW.vistoria_id
      AND predecessor.document_type = NEW.document_type
      AND predecessor.document_version < NEW.document_version
  ) THEN
    SELECT predecessor.id INTO NEW.supersedes_id
    FROM public.generated_documents AS predecessor
    WHERE predecessor.vistoria_id = NEW.vistoria_id
      AND predecessor.document_type = NEW.document_type
      AND predecessor.document_version < NEW.document_version
    ORDER BY predecessor.document_version DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.resolve_generated_document_predecessor() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER generated_documents_resolve_predecessor
BEFORE INSERT ON public.generated_documents
FOR EACH ROW EXECUTE FUNCTION private.resolve_generated_document_predecessor();
