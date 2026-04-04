---
phase: 10-formul-rio-estrutural-inteligente
plan: "01"
subsystem: wizard
tags: [skipSe, condicional, perguntasVisiveis, wizard, formulario-estrutural]
dependency_graph:
  requires: []
  provides: [SkipSe interface, PerguntaModel.skipSe, perguntasVisiveis useMemo, elementoAtual useMemo]
  affects: [app/(panel)/inspecoes/wizard.tsx]
tech_stack:
  added: []
  patterns: [useMemo para listas filtradas, argumento explicito em funcao pura de calculo]
key_files:
  created: []
  modified:
    - app/(panel)/inspecoes/wizard.tsx
decisions:
  - "calcularNivelRisco recebe visiveis como argumento explicito (evita closure inconsistente no useMemo)"
  - "perguntasVisiveis colocada imediatamente apos os derivados de perguntas para manter ordem de declaracao"
  - "elementoAtual usa Set para deduplicar faseIds na ordem de aparicao em perguntasVisiveis"
metrics:
  duration_s: 360
  completed_date: "2026-04-03T01:56:00Z"
  tasks: 2
  files_modified: 1
requirements: [FORM-04]
---

# Phase 10 Plan 01: Formulário Estrutural Inteligente (SkipSe) Summary

**One-liner:** Logica condicional skipSe no wizard via perguntasVisiveis filtrado por respostas, com header de progresso por elemento (faseId).

## Objective

Adicionar suporte a logica condicional (skipSe) no wizard de avaliacao para ocultar perguntas dinamicamente com base em respostas anteriores. Habilita formulario estrutural v2 com skip automatico quando Estado = "Bom", reduzindo de 60 para no maximo 7 perguntas em vistorias sem danos.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Interface SkipSe + flattenPerguntas + perguntasVisiveis | 93fb18c | app/(panel)/inspecoes/wizard.tsx |
| 2 | calcularNivelRisco, finalizar e progresso por elemento | 3a1e03e | app/(panel)/inspecoes/wizard.tsx |

## Changes Made

### Task 1

- Declarada interface `SkipSe { perguntaId: string; opcaoId: string }` antes de `PerguntaModel`
- Campo `skipSe?: SkipSe | null` adicionado a `PerguntaModel`
- `flattenPerguntas()` propaga `skipSe: p.skipSe || null` no `result.push({...})`
- `useMemo perguntasVisiveis` filtra perguntas onde `respostas[p.skipSe.perguntaId] !== p.skipSe.opcaoId`
- `perguntaAtual` e `totalPerguntas` derivados de `perguntasVisiveis` em vez de `perguntas`

### Task 2

- `calcularNivelRisco(visiveis: PerguntaModel[] = perguntasVisiveis)` — assinatura com argumento explicito
- Branch `ponderada_max_elemento`: `visiveis.forEach(p => {...})`
- Branch `soma_total`: `visiveis.forEach(p => {...})`
- `useMemo riscoAtual` passa `perguntasVisiveis` explicitamente e tem `perguntasVisiveis` na dependencia
- `finalizar()`: `perguntasVisiveis.find(...)`, `perguntasVisiveis.indexOf(pendente)`, `calcularNivelRisco(perguntasVisiveis)`
- `useMemo elementoAtual` computa posicao do faseId atual entre fases unicas visiveis
- Header JSX exibe `ELEMENTO X/Y` quando ha faseId, `PERGUNTA X/N` quando nao ha

## Decisions Made

1. **calcularNivelRisco recebe visiveis como argumento explicito** — Evita closure inconsistente: o `useMemo` de `riscoAtual` precisaria referenciar `perguntasVisiveis` de outro useMemo, o que pode criar dependencias circulares ou stale values. Argumento explicito e mais seguro e testavel.

2. **perguntasVisiveis posicionada imediatamente apos derivados de perguntas** — Mantém a ordem natural de declaracao: estado bruto → filtrado → derivados de UI.

3. **elementoAtual usa Set para deduplicar faseIds** — Garante que a contagem de elementos reflete fases distintas na ordem em que aparecem em `perguntasVisiveis` (nao em `perguntas` total).

## Verification

- TypeScript sem erros em wizard.tsx (erros existentes sao pre-existentes em outros arquivos)
- `grep -n "skipSe" wizard.tsx` retorna 5 ocorrencias: interface, PerguntaModel, flattenPerguntas, useMemo (2 linhas)
- Formularios sem skipSe (risco_estrutural_v1, vistoria_deslizamento_v1): `perguntasVisiveis === perguntas` (todos passam no filtro), retrocompatibilidade mantida
- Formularios sem faseId: `elementoAtual === null`, header exibe `PERGUNTA X/N`

## Deviations from Plan

None - plano executado exatamente como escrito.

## Known Stubs

None - nenhum stub ou placeholder criado neste plano.

## Self-Check: PASSED

- [x] `app/(panel)/inspecoes/wizard.tsx` modificado e commitado
- [x] Commit 93fb18c existe (Task 1)
- [x] Commit 3a1e03e existe (Task 2)
- [x] Interface SkipSe declarada
- [x] Campo skipSe em PerguntaModel
- [x] flattenPerguntas propaga skipSe
- [x] perguntasVisiveis via useMemo
- [x] calcularNivelRisco aceita argumento visiveis
- [x] finalizar() usa perguntasVisiveis
- [x] elementoAtual useMemo criado
- [x] Header JSX atualizado com logica condicional
