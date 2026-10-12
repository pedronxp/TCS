---
description: Roda a governança de rotas + build do dashboard e reporta correções necessárias
---

Rode a validação completa do TCS Dashboard e reporte os resultados:

1. `cd dashboard && npm run design:validate` — governança: manifest × rotas × baselines visuais
2. `cd dashboard && npx tsc -b --noEmit` — tipos (se rápido; senão pule e avise)
3. Se houverem falhas: explique **exatamente** o que o validador reclamou (ele aponta id/arquivo), e proponha a correção mínima — mas **não edite** sem eu confirmar.

Formato do relatório: ✅/❌ por etapa + tabela de falhas com correção sugerida + veredito (APROVADO / CORRIGIR).

Parâmetros adicionais: $ARGUMENTS
