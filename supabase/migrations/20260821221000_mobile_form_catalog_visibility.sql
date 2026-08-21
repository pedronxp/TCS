-- Disponibiliza somente o estado do catálogo nativo para o app.
-- Isso permite que uma desativação publicada no web seja respeitada até offline,
-- sem liberar o conteúdo de formulários inativos pela política de leitura geral.

CREATE OR REPLACE FUNCTION public.list_mobile_form_catalog()
RETURNS TABLE (
  codigo_sistema text,
  ativo boolean,
  atualizado_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'mobile_form_catalog_not_authenticated' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT form."codigoSistema", coalesce(form.ativo, false), form."atualizadoEm"
  FROM public.formularios form
  WHERE form."codigoSistema" IS NOT NULL
  ORDER BY form."codigoSistema";
END;
$$;

REVOKE ALL ON FUNCTION public.list_mobile_form_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_mobile_form_catalog() TO authenticated;
NOTIFY pgrst, 'reload schema';
