-- Restaura a exibicao condicional da justificativa tecnica do formulario
-- nativo de deslizamento.
--
-- A migration 20261006130000 tornou a pergunta "desl2_q2_justificativa_tecnica"
-- sempre visivel e obrigatoria. O efeito foi o inverso do desejado: em toda
-- vistoria de encosta — inclusive nas de inclinacao suave, em que a
-- classificacao altura x distancia nem aparece — o agente era obrigado a
-- escrever uma justificativa tecnica para uma pergunta que nao foi feita.
--
-- Aqui a justificativa volta a ser exibida (e exigida) apenas quando ela se
-- aplica: encosta vertical (q2_e) ou talude solapado (q2_f). A regra
-- condicional de risco "altura x distancia" continua exigindo a justificativa
-- nos casos de "Muito alto" e "Não foi possível estimar".

WITH ajuste AS (
  SELECT
    f.id,
    jsonb_build_object(
      'perguntaId', 'desl2_q2',
      'respostaIds', jsonb_build_array('q2_e', 'q2_f')
    ) AS mostrar_quando
  FROM public.formularios f
  WHERE f."codigoSistema" = 'vistoria_deslizamento_v3'
)
UPDATE public.formularios f
SET
  "fases" = (
    SELECT coalesce(jsonb_agg(
             jsonb_set(
               fase,
               '{perguntas}',
               coalesce((SELECT jsonb_agg(
                         CASE p->>'id'
                           WHEN 'desl2_q2_justificativa_tecnica'
                             THEN p || a.mostrar_quando
                           ELSE p
                         END
                         ORDER BY ord)
                  FROM jsonb_array_elements(coalesce(fase->'perguntas', '[]'::jsonb))
                       WITH ORDINALITY AS e(p, ord)), '[]'::jsonb)
             ),
             ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(f."fases") WITH ORDINALITY AS e(fase, ord)
  ),
  "perguntas" = (
    SELECT coalesce(jsonb_agg(
             CASE p->>'id'
               WHEN 'desl2_q2_justificativa_tecnica'
                 THEN p || a.mostrar_quando
               ELSE p
             END
             ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(coalesce(f."perguntas", '[]'::jsonb))
           WITH ORDINALITY AS e(p, ord)
  ),
  "atualizadoEm" = now()
FROM ajuste a
WHERE f.id = a.id
  AND jsonb_typeof(f."fases") = 'array'
  AND jsonb_array_length(f."fases") > 0;

NOTIFY pgrst, 'reload schema';
