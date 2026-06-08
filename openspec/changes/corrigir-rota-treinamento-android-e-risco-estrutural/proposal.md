## Why

O fluxo de aula precisa ficar estavel em Android antes de novas vistorias: o video mostra tela branca, piscada e uma linha preta residual ao iniciar uma vistoria no Modo Treinamento. Ao mesmo tempo, a avaliacao estrutural precisa separar laje de pilares/vigas e tratar "Inexistente" em fundacao e estrutura como uma condicao tecnica grave que exige justificativa.

## What Changes

- Corrigir a frente de rota/mapeamento para evitar rota, linha ou artefato visual residual em Android quando o usuario sai do mapa ou inicia uma nova vistoria.
- Validar coordenadas antes de abrir rota, enquadrar mapa, renderizar marcador ou acionar "Como Chegar", bloqueando valores vazios, invalidos ou `0,0`.
- Corrigir a entrada de `Nova Vistoria` no Modo Treinamento para que a tela inicial da vistoria renderize imediatamente, sem ficar presa em tela branca, GPS, reverse geocode ou redirecionamento duplicado.
- Garantir que o fluxo de treinamento continue local-only, usando apenas as rotas de inspecao permitidas e sem acionar sincronizacao de producao.
- Ajustar o formulario `risco_estrutural_novo_v2`:
  - manter a opcao `Inexistente` somente em `Fundacao` e `Estrutura`;
  - renomear `Estrutura (pilares, vigas, lajes)` para `Estrutura (pilares e vigas)`;
  - criar a nova pergunta `Laje` logo depois da pergunta de estrutura;
  - remover `Inexistente` das demais perguntas estruturais;
  - exigir justificativa do agente quando `Inexistente` for marcado em fundacao ou pilares/vigas.
- Ajustar o calculo e os testes para que "Inexistente" nesses dois elementos nao seja tratado como risco zero, preservando a escala 0-10 e os limites R1-R4.

## Capabilities

### New Capabilities

- `map-routing-stability`: estabilidade e validacao de coordenadas/rotas/mapa em Android e fluxos de "Como Chegar".
- `training-android-inspection-entry`: entrada robusta de nova vistoria no Modo Treinamento em Android, com render inicial estavel e sem bloqueio por GPS ou guard de rota.
- `structural-risk-form-laje`: evolucao do formulario estrutural para separar laje, restringir `Inexistente` e exigir justificativa tecnica nos elementos criticos.

### Modified Capabilities

## Impact

- Rotas e telas: `app/(panel)/treinamento/index.tsx`, `app/(panel)/inspecoes/dados-iniciais.tsx`, `app/(panel)/inspecoes/selecao-formulario.tsx`, `app/(panel)/inspecoes/wizard.tsx`, `app/(panel)/inspecoes/[id].tsx`, `app/(panel)/mapas.tsx`, `app/_layout.tsx`.
- Formulario built-in: `assets/formularios/risco_estrutural_novo_v2.json`.
- Helpers de formulario e risco: `utils/formulariosAssets.ts`, `utils/riscoUtils.ts`.
- Relatorio/laudo/respostas resolvidas: telas de relatorio/laudo e builder de PDF quando exibirem justificativas.
- Testes: `utils/__tests__/formularios.test.ts`, `utils/__tests__/risco.test.ts`, testes de treinamento/navegacao se houver cobertura existente aplicavel.
- Sem mudanca esperada em schema remoto ou politica de sincronizacao de producao.
