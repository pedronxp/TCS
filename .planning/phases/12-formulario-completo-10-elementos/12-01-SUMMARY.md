---
phase: 12-formulario-completo-10-elementos
plan: "01"
subsystem: formularios
tags: [formulario, json, assets, selecao-formulario]
dependency_graph:
  requires: []
  provides: [risco_estrutural_completo_v1-formulario]
  affects: [selecao-formulario, formulariosAssets]
tech_stack:
  added: []
  patterns: [json-formulario-nativo, assets-registro, formularios-builtin]
key_files:
  created:
    - assets/formularios/risco_estrutural_completo_v1.json
    - utils/formulariosAssets.ts
  modified:
    - app/(panel)/inspecoes/selecao-formulario.tsx
decisions:
  - selecao-formulario.tsx atualizado para versão main antes de inserir novo formulário (worktree estava desatualizado com IDs legados)
metrics:
  duration_s: 243
  completed_date: "2026-04-03"
  tasks_completed: 1
  files_changed: 3
---

# Phase 12 Plan 01: Formulário Completo 10 Elementos — Summary

**One-liner:** JSON nativo com 10 fases estruturais × 4 perguntas (40 total) registrado como formulário built-in "Avaliação Completa — 10 Elementos".

## Objective

Adaptar os JSONs externos para o formato nativo do app e registrar novo formulário built-in com cobertura completa de 10 elementos estruturais.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Criar JSON nativo com 10 elementos e registrar nos 3 arquivos | 2df9037 | assets/formularios/risco_estrutural_completo_v1.json, utils/formulariosAssets.ts, app/(panel)/inspecoes/selecao-formulario.tsx |

## Files Created/Modified

### Created
- **`assets/formularios/risco_estrutural_completo_v1.json`** — JSON com 10 fases × 4 perguntas (40 total). Elementos: fundação, estrutura, cobertura, alvenaria, piso, escada, parede, fachada, drenagem, elétrica.

### Modified
- **`utils/formulariosAssets.ts`** — Adicionada chave `risco_estrutural_completo_v1` ao objeto `ASSETS` (o arquivo foi criado no worktree pois existia apenas na branch main).
- **`app/(panel)/inspecoes/selecao-formulario.tsx`** — Inserido novo item em `FORMULARIOS_BUILTIN` entre `risco_estrutural_v2` e `risco_estrutural_v1`.

## JSON Structure

- **Fases:** 10
- **Perguntas por fase:** 4 (estado, gravidade, extensão, ativa)
- **Total de perguntas:** 40
- **tipoCalculo:** `ponderada_max_elemento`

### Pesos por elemento

| Elemento | Peso |
|----------|------|
| Fundação | 1.5 |
| Estrutura | 1.5 |
| Parede | 1.4 |
| Drenagem | 1.1 |
| Alvenaria | 1.0 |
| Escada | 1.0 |
| Cobertura | 0.9 |
| Elétrica | 0.9 |
| Piso | 0.8 |
| Fachada | 0.8 |

### imagemLocal keys utilizadas

- Estado (fundação): `fund_bom`, `fund_regular`, `fund_ruim`, `fund_pessimo`
- Estado (demais 9 elementos): `est_bom`, `est_regular`, `est_ruim`, `est_pessimo`
- Gravidade: `grav_nenhuma`, `grav_leve`, `grav_moderada`, `grav_severa`
- Extensão: `ext_pontual`, `ext_setorial`, `ext_generalizada`
- Ativa: `opcao_nao`, `opcao_sim`

## Verification Results

```
Fases: 10
Total perguntas: 40
IDs das fases: fase_fundacao, fase_estrutura, fase_cobertura, fase_alvenaria, fase_piso, fase_escada, fase_parede, fase_fachada, fase_drenagem, fase_eletrica
PASS: JSON valido com 10 fases e 40 perguntas
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Worktree com selecao-formulario.tsx desatualizado**
- **Found during:** Task 1
- **Issue:** A branch do worktree (`worktree-agent-a22e236c`) tinha `selecao-formulario.tsx` com IDs de formulários legados (`estrutural_v1`, `deslizamento_campo_v1`, `estrutural_avancado_v1`, `inundacao_v1`) referenciando JSONs inexistentes. A versão do branch main tinha os IDs corretos.
- **Fix:** Substituído pelo conteúdo da branch main antes de inserir o novo formulário.
- **Files modified:** `app/(panel)/inspecoes/selecao-formulario.tsx`
- **Commit:** 2df9037

**2. [Rule 3 - Blocking] formulariosAssets.ts ausente no worktree**
- **Found during:** Task 1
- **Issue:** O arquivo `utils/formulariosAssets.ts` existia na branch main mas não estava presente na branch do worktree.
- **Fix:** Copiado do branch main e então modificado com a nova entrada.
- **Files modified:** `utils/formulariosAssets.ts`
- **Commit:** 2df9037

## Known Stubs

None — todas as referências ao formulário estão conectadas ao arquivo JSON real.

## Self-Check: PASSED

- [x] `assets/formularios/risco_estrutural_completo_v1.json` existe e tem 10 fases com 40 perguntas
- [x] `utils/formulariosAssets.ts` contém chave `risco_estrutural_completo_v1`
- [x] `app/(panel)/inspecoes/selecao-formulario.tsx` lista `risco_estrutural_completo_v1` em `FORMULARIOS_BUILTIN`
- [x] Commit 2df9037 existe no repositório
