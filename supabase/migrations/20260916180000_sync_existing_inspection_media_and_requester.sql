-- Uma tentativa de sync após protocolo alocado precisa complementar os campos
-- pendentes (principalmente fotos cujo upload só é autorizado após a criação).
DO $$
DECLARE
  definition text;
  old_block text := $old$
  IF v_existing.id IS NOT NULL AND NULLIF(btrim(v_existing.protocolo), '') IS NOT NULL THEN
    RETURN jsonb_build_object(
      'inspection_id', v_existing.id,
      'organization_id', v_existing.organization_id,
      'protocol', v_existing.protocolo,
      'official', true,
      'legacy', v_existing.protocol_series IS NULL
    );
  END IF;$old$;
  new_block text := $new$
  IF v_existing.id IS NOT NULL AND NULLIF(btrim(v_existing.protocolo), '') IS NOT NULL THEN
    UPDATE public.vistorias AS target
    SET
      "responsavelNome" = coalesce(nullif(btrim(p_inspection ->> 'responsavelNome'), ''), target."responsavelNome"),
      "fotoUrl" = coalesce(nullif(p_inspection ->> 'fotoUrl', ''), target."fotoUrl"),
      "fotosUrls" = CASE
        WHEN jsonb_typeof(p_inspection -> 'fotosUrls') = 'array'
          AND jsonb_array_length(p_inspection -> 'fotosUrls') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(p_inspection -> 'fotosUrls'))
        ELSE target."fotosUrls"
      END
    WHERE target.id = v_existing.id
    RETURNING * INTO v_existing;

    RETURN jsonb_build_object(
      'inspection_id', v_existing.id,
      'organization_id', v_existing.organization_id,
      'protocol', v_existing.protocolo,
      'official', true,
      'legacy', v_existing.protocol_series IS NULL
    );
  END IF;$new$;
BEGIN
  SELECT pg_get_functiondef('public.sync_finalized_inspection(jsonb)'::regprocedure) INTO definition;
  IF position(old_block IN definition) = 0 THEN
    RAISE EXCEPTION 'sync_finalized_inspection_expected_block_not_found';
  END IF;
  EXECUTE replace(definition, old_block, new_block);
END;
$$;

NOTIFY pgrst, 'reload schema';
