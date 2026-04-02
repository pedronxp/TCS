---
phase: "07"
plan: "01"
subsystem: formularios
tags: [json-audit, wizard, draft-key, testes]
dependency_graph:
  requires: []
  provides: [estrutural_avancado_limites, formularios_audit_tests]
  affects: [wizard, draft-versioning]
tech_stack:
  added: []
  patterns: [json-classification-limits, versioned-draft-keys]
key_files:
  created:
    - utils/__tests__/formularios.test.ts
  modified:
    - assets/formularios/estrutural_avancado.json
    - app/(panel)/inspecoes/wizard.tsx
decisions:
  - "limites[] do estrutural_avancado derivados das regrasGlobal existentes para fallback soma_total enquanto pontuacao_por_item nao e suportado"
  - "versao incrementada para 2 para invalidar rascunhos antigos automaticamente via novo draftKey"
metrics:
  duration_seconds: 120
  completed_date: "2026-04-02"
  tasks_completed: 3
  files_changed: 3
---

# Fase 07 Plano 01: Auditoria e Correção dos JSONs Built-in Summary

Adicionado `classificacao.limites[]` ao `estrutural_avancado.json` (versao 2) e corrigido `draftKey` no wizard para incluir versao do formulario, com suite de 20 testes de auditoria cobrindo todos os 4 JSONs.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Adicionar `classificacao.limites[]` ao estrutural_avancado.json e incrementar versao para 2 | 02cc8a5 |
| 2 | Corrigir `draftKey` no wizard.tsx para incluir `_v${params.formularioVersao}` | 02cc8a5 |
| 3 | Criar `utils/__tests__/formularios.test.ts` com 20 testes de auditoria (todos passando) | 02cc8a5 |

## Verification Results

- Todos os 20 testes passaram: `npx jest utils/__tests__/formularios.test.ts --no-coverage`
- `estrutural_avancado.json` tem `classificacao.limites[]` com 4 entradas
- `estrutural_avancado.json` tem `"versao": 2`
- `draftKey` no wizard inclui `_v${params.formularioVersao || '1'}` na linha 65

## Deviations from Plan

None - plano executado exatamente como escrito.

## Known Stubs

None - todos os JSONs possuem dados reais e o teste valida estrutura completa.

## Self-Check: PASSED

- [x] `utils/__tests__/formularios.test.ts` exists
- [x] `assets/formularios/estrutural_avancado.json` modified (limites[] added, versao=2)
- [x] `app/(panel)/inspecoes/wizard.tsx` modified (draftKey with versao)
- [x] Commit 02cc8a5 exists
