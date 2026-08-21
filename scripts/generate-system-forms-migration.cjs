/* Gera a migração do catálogo nativo a partir dos mesmos JSONs consumidos pelo app.
 * Execute após alterar um formulário nativo: node scripts/generate-system-forms-migration.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sources = [
  'risco_inundacao_v1.json',
  'risco_incendio_vegetacao_v1.json',
  'inspecao_ponte_passarela_v1.json',
  'inspecao_bueiro_drenagem_v1.json',
  'avaliacao_arvore_cbmmg_v1.json',
  'vistoria_deslizamento_v3.json',
  'risco_estrutural_novo_v2.json',
];

const forms = sources.map((file) => JSON.parse(fs.readFileSync(path.join(root, 'assets', 'formularios', file), 'utf8')));
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const values = forms.map((form) => `  (${sql(form.id)}, ${sql(form.titulo)}, ${sql(form.descricao || '')}, ${sql(JSON.stringify(form))}::jsonb)`).join(',\n');

const migration = `-- Catálogo publicado dos formulários nativos do aplicativo.
-- Gerado por scripts/generate-system-forms-migration.cjs a partir de assets/formularios.

ALTER TABLE public.formularios ADD COLUMN IF NOT EXISTS "codigoSistema" text;
CREATE UNIQUE INDEX IF NOT EXISTS formularios_codigo_sistema_key ON public.formularios ("codigoSistema") WHERE "codigoSistema" IS NOT NULL;

WITH source_forms(codigo, titulo, descricao, payload) AS (
VALUES
${values}
), inserted AS (
  INSERT INTO public.formularios (
    "codigoSistema", titulo, descricao, perguntas, "criadoEm", ativo, municipio,
    "criadoPorNome", "publicadoEm", "atualizadoEm", status, versao,
    "criadoPorUid", classificacao, "tipoCalculo", fases
  )
  SELECT
    codigo, titulo, nullif(descricao, ''),
    jsonb_path_query_array(payload, '$.fases[*].perguntas[*]'), now(), true, NULL,
    'Sistema', now(), now(), 'publicado', greatest(coalesce((payload->>'versao')::integer, 1), 1),
    NULL, payload->'classificacao', coalesce(payload->>'tipoCalculo', 'soma_total'), payload->'fases'
  FROM source_forms source
  WHERE NOT EXISTS (SELECT 1 FROM public.formularios existing WHERE existing."codigoSistema" = source.codigo)
  RETURNING id, versao
)
INSERT INTO public.internal_form_versions (form_id, version, status, snapshot, created_by, reason)
SELECT form_row.id, inserted.versao, 'publicado', to_jsonb(form_row), NULL, 'Importação do formulário nativo do aplicativo'
FROM inserted
JOIN public.formularios form_row ON form_row.id = inserted.id
ON CONFLICT (form_id, version) DO NOTHING;

CREATE OR REPLACE FUNCTION public.list_internal_forms()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT private.has_internal_permission('technical.read') THEN
    RAISE EXCEPTION 'technical_read_not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'system_code', f."codigoSistema",
    'title', f.titulo,
    'description', f.descricao,
    'status', f.status,
    'active', f.ativo,
    'municipality', f.municipio,
    'version', f.versao,
    'questions', f.perguntas,
    'classification', f.classificacao,
    'phases', f.fases,
    'calculation_type', f."tipoCalculo",
    'updated_at', f."atualizadoEm",
    'versions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'version', version.version,
        'status', version.status,
        'reason', version.reason,
        'created_at', version.created_at
      ) ORDER BY version.version DESC)
      FROM public.internal_form_versions version
      WHERE version.form_id = f.id
    ), '[]'::jsonb)
  ) ORDER BY f."atualizadoEm" DESC), '[]'::jsonb)
  INTO result
  FROM public.formularios f;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_internal_forms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_forms() TO authenticated;
NOTIFY pgrst, 'reload schema';
`;

const destination = path.join(root, 'supabase', 'migrations', '20260821220000_seed_system_forms.sql');
fs.writeFileSync(destination, migration);
console.log(`Generated ${destination} with ${forms.length} system forms.`);
