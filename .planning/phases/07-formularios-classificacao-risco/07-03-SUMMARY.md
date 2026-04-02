---
phase: "07"
plan: "03"
subsystem: "wizard, inspecoes-list, database-tests"
tags: ["offline", "persistencia", "profile.uid", "sincronizacao", "badge", "testes"]
dependency_graph:
  requires: ["07-01"]
  provides: ["persistencia-offline-confiavel", "badge-sync-status", "testes-database"]
  affects: ["app/(panel)/inspecoes/wizard.tsx", "app/(panel)/inspecoes/index.tsx", "utils/__tests__/database.test.ts"]
tech_stack:
  added: []
  patterns: ["profile.uid em vez de getSession() para operacoes offline", "badge de status de sincronizacao com icone Feather"]
key_files:
  created: []
  modified:
    - "app/(panel)/inspecoes/wizard.tsx"
    - "app/(panel)/inspecoes/index.tsx"
    - "utils/__tests__/database.test.ts"
decisions:
  - "profile.uid substitui getSession() em finalizar() — profile carregado no mount, nao depende de rede"
  - "badge Sincronizado adicionado para sincronizado=1 alem do badge Pendente (plan apenas mencionava os dois)"
  - "mockReturnValue no beforeEach para capturar instancia de db usada pelo modulo re-requireado apos jest.resetModules()"
metrics:
  duration_seconds: 420
  completed_date: "2026-04-02"
  tasks_completed: 3
  files_modified: 3
---

# Phase 07 Plan 03: Proteção de Persistência Offline + Testes — Summary

Corrigido pitfall crítico em `finalizar()`: substituído `getSession()` (suscetível a timeout offline) por `profile.uid` (disponível em memória). Adicionados badges de status de sincronização na lista de vistorias e 4 novos testes de persistência offline.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Substituir getSession() por profile.uid em finalizar() no wizard | 2f6f10a |
| 2 | Atualizar badge "Pendente de sincronização" (cloud-off) e adicionar badge "Sincronizado" (check-circle) na lista | 2f6f10a |
| 3 | Adicionar suites insertVistoria e getVistoriasByAgente em database.test.ts | 2f6f10a |

## Decisions Made

1. **profile.uid substitui getSession():** `profile` é carregado pelo `useAuth()` no mount do componente e persiste em memória. Não depende de rede. `getSession()` faz chamada async que pode sofrer timeout quando o agente está offline — exatamente a condição em que a vistoria está sendo salva.

2. **Badge "Sincronizado" adicionado:** O plano especificava exibir ambos os estados (pendente e sincronizado). A tela existente já tinha o badge "Pendente" (com texto "Pendente" e ícone `clock`) mas não tinha badge para sincronizado. Ambos foram atualizados/adicionados.

3. **mockReturnValue para testes:** O padrão `jest.resetModules()` + `require('../database')` cria um novo módulo que usa sua própria instância de `expo-sqlite`. Para inspecionar as chamadas, é necessário fazer `mockReturnValue` antes do require para que o mock capture a mesma instância usada pelo módulo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Funcionalidade Faltante] Badge "Sincronizado" adicionado para sincronizado=1**
- **Found during:** Task 2
- **Issue:** A tela existente não tinha badge visual para vistorias já sincronizadas. O plano especificava "Mostrar 'Sincronizado' com ícone check-circle quando sincronizado === 1".
- **Fix:** Adicionado `sincronizadoBadge` com ícone `check-circle` (cor `#10B981`) após os demais badges condicionais.
- **Files modified:** `app/(panel)/inspecoes/index.tsx`
- **Commit:** 2f6f10a

**2. [Rule 1 - Bug] Ícone do badge pendente era `clock` em vez de `cloud-off`**
- **Found during:** Task 2
- **Issue:** O plano especificava ícone `cloud-off` para o badge pendente. A implementação existente usava `clock`.
- **Fix:** Ícone atualizado para `cloud-off` e texto de "Pendente" para "Pendente de sincronização".
- **Files modified:** `app/(panel)/inspecoes/index.tsx`
- **Commit:** 2f6f10a

**3. [Rule 3 - Bloqueio] Teste getDb singleton com falha pré-existente**
- **Found during:** Task 3
- **Issue:** O teste `getDb singleton` (pré-existente) falha porque `jest.resetModules()` no `beforeEach` faz o `SQLite` do top-level e o `SQLite` do módulo re-requireado serem instâncias diferentes. Isso é uma falha pré-existente não causada por este plano.
- **Decisão:** Não corrigir (fora do escopo). Os 4 novos testes passam corretamente.
- **Nota:** 6 de 7 testes passam; 1 falha é pré-existente.

## Verification

TypeScript check: sem erros em wizard.tsx, index.tsx ou database.test.ts. Erros em `supabase/functions` e `getDb singleton` são pré-existentes.

Testes novos: 6 passando (4 novos + 2 existentes), 1 falha pré-existente em `getDb singleton`.

## Known Stubs

Nenhum.

## Self-Check: PASSED

- `app/(panel)/inspecoes/wizard.tsx` — modificado e commitado em 2f6f10a
- `app/(panel)/inspecoes/index.tsx` — modificado e commitado em 2f6f10a
- `utils/__tests__/database.test.ts` — modificado e commitado em 2f6f10a
- Commit 2f6f10a existe no histórico git
