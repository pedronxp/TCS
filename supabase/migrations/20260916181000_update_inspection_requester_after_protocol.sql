-- Atualização idempotente do solicitante após o protocolo oficial existir.
CREATE OR REPLACE FUNCTION public.update_inspection_requester(
  p_inspection_id uuid,
  p_requester_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := nullif(btrim(coalesce(p_requester_name, '')), '');
BEGIN
  IF auth.uid() IS NULL OR p_inspection_id IS NULL OR v_name IS NULL OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'invalid_inspection_requester' USING ERRCODE = '22023';
  END IF;

  UPDATE public.vistorias AS inspection
  SET "responsavelNome" = v_name
  WHERE inspection.id = p_inspection_id
    AND inspection."agenteUid"::text = auth.uid()::text;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inspection_not_found_or_forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_inspection_requester(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_inspection_requester(uuid, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
