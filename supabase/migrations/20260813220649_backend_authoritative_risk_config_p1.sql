CREATE OR REPLACE FUNCTION public.save_municipio_risk_config(p_configuracao jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_role text;
  v_municipio text;
  v_item record;
  v_previous_max integer := -1;
  v_count integer := 0;
BEGIN
  SELECT role, municipio INTO v_role, v_municipio
  FROM public.users WHERE uid = auth.uid() AND coalesce("isApproved", false);
  IF v_role NOT IN ('admin', 'master_admin') OR v_municipio IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_configuracao) <> 'array' OR jsonb_array_length(p_configuracao) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'invalid_risk_config' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN
    SELECT nivel, "minPontos", "maxPontos", descricao
    FROM jsonb_to_recordset(p_configuracao) AS value(nivel text, "minPontos" integer, "maxPontos" integer, descricao text)
    ORDER BY "minPontos"
  LOOP
    IF v_item.nivel NOT IN ('r1','r2','r3','r4')
       OR v_item."minPontos" IS NULL OR v_item."maxPontos" IS NULL
       OR v_item."minPontos" <> v_previous_max + 1
       OR v_item."maxPontos" < v_item."minPontos"
       OR char_length(btrim(coalesce(v_item.descricao, ''))) NOT BETWEEN 1 AND 240 THEN
      RAISE EXCEPTION 'invalid_risk_config' USING ERRCODE = '22023';
    END IF;
    v_previous_max := v_item."maxPontos";
    v_count := v_count + 1;
  END LOOP;
  IF v_count <> jsonb_array_length(p_configuracao) THEN RAISE EXCEPTION 'invalid_risk_config' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.risk_configs (municipio, configuracao, atualizado_por, atualizado_em)
  VALUES (v_municipio, p_configuracao, auth.uid(), now())
  ON CONFLICT (municipio) DO UPDATE SET configuracao = excluded.configuracao, atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_municipio_risk_config()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE v_role text; v_municipio text;
BEGIN
  SELECT role, municipio INTO v_role, v_municipio FROM public.users WHERE uid = auth.uid() AND coalesce("isApproved", false);
  IF v_role NOT IN ('admin', 'master_admin') OR v_municipio IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.risk_configs WHERE municipio = v_municipio;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_municipio_risk_config(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_municipio_risk_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_municipio_risk_config(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_municipio_risk_config() TO authenticated;
