---
phase: "07"
plan: "02"
subsystem: "wizard"
tags: ["risco", "banner", "animacao", "useMemo", "Animated"]
dependency_graph:
  requires: ["07-01"]
  provides: ["banner-risco-tempo-real"]
  affects: ["wizard.tsx"]
tech_stack:
  added: []
  patterns: ["useMemo para calculo reativo", "Animated.timing com useNativeDriver", "footer column layout"]
key_files:
  created: []
  modified:
    - "app/(panel)/inspecoes/wizard.tsx"
decisions:
  - "riscoAtual useMemo posicionado APÓS calcularNivelRisco (const não é hoistada — evitar ReferenceError)"
  - "footer mudado de flexDirection:row para column; botoes envolvidos em View row interna"
metrics:
  duration_seconds: 125
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_modified: 1
---

# Phase 07 Plan 02: Banner de Risco em Tempo Real no Wizard — Summary

Banner animado de nível de risco (R1–R4) no footer do wizard usando useMemo reativo + Animated.timing com useNativeDriver, aparece após a primeira resposta.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Adicionar imports (useMemo, Animated, riscoLabel, riscoColor) e calcular risco reativo | f91be18 |
| 2 | Inserir banner no footer + atualizar estilos (footer column, banner styles) | f91be18 |

## Decisions Made

1. **useMemo posicionado após calcularNivelRisco:** `const calcularNivelRisco` não é hoistada em JavaScript — colocar o `useMemo` antes causaria ReferenceError em runtime. Solução: mover `riscoAtual` e o `useEffect` de animação para logo após a definição da função.

2. **Footer reestruturado para coluna:** O footer original usava `flexDirection: 'row'` para colocar os botões lado a lado. Mudado para `flexDirection: 'column'` + `gap: 0`, com os botões envolvidos em um `<View style={{ flexDirection: 'row', gap: 12 }}>` para manter o layout horizontal deles.

3. **riscoAtual retorna `{ nivel, pontuacao }`:** A função `calcularNivelRisco()` retorna um objeto, não uma string. O banner usa `riscoAtual.nivel` para cor/label/ícone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reordenação do useMemo para após calcularNivelRisco**
- **Found during:** Task 1
- **Issue:** O plano indicava adicionar `useMemo` antes dos `useEffect` iniciais, mas `calcularNivelRisco` é definida como `const` depois — o `useMemo` teria causado ReferenceError em runtime
- **Fix:** `riscoAtual` useMemo e seu `useEffect` de animação foram movidos para após a definição de `calcularNivelRisco`
- **Files modified:** `app/(panel)/inspecoes/wizard.tsx`
- **Commit:** f91be18

**2. [Rule 1 - Bug] Banner usa `riscoAtual.nivel` em vez de `riscoAtual`**
- **Found during:** Task 2
- **Issue:** O plano tratava `riscoAtual` como string, mas `calcularNivelRisco()` retorna `{ nivel: string, pontuacao: number }`. O banner precisava de `.nivel` para acessar o nível.
- **Fix:** Todas as referências no JSX do banner usam `riscoAtual.nivel` (cor, label, ícone, toUpperCase)
- **Files modified:** `app/(panel)/inspecoes/wizard.tsx`
- **Commit:** f91be18

## Verification

TypeScript check: sem erros em wizard.tsx ou riscoUtils.ts. Os 25 erros reportados pelo tsc são todos em arquivos pré-existentes não tocados por este plano.

## Known Stubs

Nenhum.

## Self-Check: PASSED

- `app/(panel)/inspecoes/wizard.tsx` — modificado e commitado em f91be18
- Commit f91be18 existe no histórico git
