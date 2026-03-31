---
phase: "05-seguranca-divida-tecnica"
plan: "05"
subsystem: "security-refactoring"
tags: ["security", "refactoring", "utils", "typescript", "pdf", "sqlite"]
dependency_graph:
  requires: []
  provides: ["utils/riscoUtils", "utils/htmlUtils", "utils/laudoPdfBuilder", "types/vistoria"]
  affects: ["app/(panel)/inspecoes", "app/(panel)/admin", "app/(panel)/supervisor", "app/(panel)/master", "services/SyncService", "utils/supabase"]
tech_stack:
  added: ["expo-secure-store"]
  patterns: ["shared utility modules", "dynamic imports", "typed navigation params"]
key_files:
  created:
    - utils/laudoPdfBuilder.ts
  modified:
    - utils/supabase.ts
    - utils/logger.ts
    - services/NotificationService.ts
    - services/SyncService.ts
    - app/(auth)/register.tsx
    - app/(panel)/inspecoes/[id].tsx
    - app/(panel)/inspecoes/resultado.tsx
    - app/(panel)/inspecoes/laudo.tsx
    - app/(panel)/inspecoes/relatorio.tsx
    - app/(panel)/inspecoes/wizard.tsx
    - app/(panel)/admin/index.tsx
    - app/(panel)/admin/estatisticas.tsx
    - app/(panel)/admin/logs.tsx
    - app/(panel)/admin/relatorios.tsx
    - app/(panel)/supervisor/index.tsx
    - app/(panel)/supervisor/agente.tsx
    - app/(panel)/supervisor/equipe.tsx
    - app/(panel)/supervisor/atribuicao.tsx
    - app/(panel)/mapas.tsx
    - app/(panel)/perfil.tsx
    - app/(panel)/master/logs.tsx
    - types/vistoria.ts
key_decisions:
  - "utils/laudoPdfBuilder.ts uses resultado.tsx design (most complete) as canonical — laudo.tsx and relatorio.tsx now produce identical layout"
  - "SyncService uses dynamic import for NotificationService guarded by Constants.appOwnership !== 'expo' to prevent expo-notifications crash in Expo Go"
  - "WizardParams kept as type alias in types/vistoria.ts but wizard.tsx uses Record<string, string> for useLocalSearchParams due to expo-router generic constraint"
  - "supervisor/index.tsx query expanded to return all VistoriaNormalizada fields to satisfy TypeScript strict type checking"
  - "LogCategory union type extended with 'notifications' to support NotificationService logger calls"
metrics:
  duration_seconds: 1800
  completed_date: "2026-03-31"
  tasks_completed: 12
  files_modified: 22
---

# Phase 05 Plan 05: Segurança + Dívida Técnica Summary

JWT secured via expo-secure-store, 3 PDF generators unified into one builder, 5 helper functions deduplicated across 13+ files, and Expo Go compatibility fixed via dynamic NotificationService import.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 5.1 | Migrate JWT from AsyncStorage to expo-secure-store | 33705be |
| 5.2 | Restrict select('*') in register.tsx to explicit fields | 33705be |
| 5.3 | Replace console.log with logger.warn in NotificationService | e5fa663 |
| 5.4 | Add municipio/agenteUid filters + SQLite fallback in inspecoes/[id].tsx | d7173dc |
| 5.5 | Limit VACUUM SQLite to once per day via AsyncStorage timestamp | c0ef5ca |
| 5.6 | Create utils/riscoUtils.ts — consolidated riscoLabel/riscoColor/riscoIcon/riscoConduta | d7173dc |
| 5.7 | Create utils/htmlUtils.ts — consolidated escapeHtml/formatarData/formatarDataHora/tempoRelativo | d7173dc |
| 5.8 | Create utils/laudoPdfBuilder.ts — unified PDF HTML generator for all 3 PDF screens | 20e5cc3, 3eced46 |
| 5.9 | Create types/vistoria.ts — VistoriaSupabase, VistoriaNormalizada, AtividadeItem, WizardParams | d7173dc, 40c4d1c |
| 5.10 | Fix "Compartilhar" button in resultado.tsx — distinct from "Baixar PDF" behavior | 3eced46 |
| 5.11 | Fix wizard.tsx foto_url — persist photo URI in SQLite instead of null | 40c4d1c |
| 5.12 | Convert NotificationService import in SyncService to dynamic import (Expo Go fix) | cb3ffd8 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Add 'notifications' to LogCategory union type**
- **Found during:** Task 5.3 verification
- **Issue:** NotificationService called `logger.warn('notifications', ...)` but 'notifications' was not in the LogCategory type, causing TS error
- **Fix:** Added 'notifications' to the LogCategory union in utils/logger.ts
- **Files modified:** utils/logger.ts
- **Commit:** cb3ffd8

**2. [Rule 1 - Bug] Fix missing notificarNovaAtribuicao import in atribuicao.tsx**
- **Found during:** TypeScript check
- **Issue:** supervisor/atribuicao.tsx called `notificarNovaAtribuicao()` without importing it — pre-existing bug
- **Fix:** Added `import { notificarNovaAtribuicao } from '../../../services/NotificationService'`
- **Files modified:** app/(panel)/supervisor/atribuicao.tsx
- **Commit:** cb3ffd8

**3. [Rule 1 - Bug] Expand supervisor/index.tsx Supabase query for VistoriaNormalizada type**
- **Found during:** Task 5.9 TypeScript check
- **Issue:** Query selected only `id, nivelRisco, endereco, dataVistoria, agenteNome` but VistoriaNormalizada requires additional fields (pontuacaoTotal, municipio, respostasJson, formularioId)
- **Fix:** Expanded select to include all fields; added null guard on dataVistoria comparison
- **Files modified:** app/(panel)/supervisor/index.tsx
- **Commit:** cb3ffd8

**4. [Rule 2 - Missing] Add dataFormatada variable back in relatorio.tsx**
- **Found during:** Task 5.8 refactoring
- **Issue:** After removing `buildHtml()` function, the `dataFormatada` variable was lost but is still used in the UI
- **Fix:** Re-added dataFormatada as a local computed variable in the component
- **Files modified:** app/(panel)/inspecoes/relatorio.tsx
- **Commit:** 3eced46

**5. [Rule 1 - Bug] Fix supervisor/equipe.tsx missing tempoRelativo import**
- **Found during:** Task 5.7 verification
- **Issue:** equipe.tsx still had local tempoRelativo function not caught in initial scan
- **Fix:** Removed local function, added import from htmlUtils
- **Files modified:** app/(panel)/supervisor/equipe.tsx
- **Commit:** c289033

## Verification Results

```
grep -rn "function riscoLabel|function riscoColor|RISCO_LABELS =|RISCO_CORES =" app/
# Result: empty (zero duplicates)

grep -rn "function escapeHtml|function formatarData|function tempoRelativo" app/
# Result: empty (zero duplicates)

grep -n "AsyncStorage" utils/supabase.ts
# Result: only comment reference (no usage)

grep -n "console.log" services/NotificationService.ts
# Result: empty

grep -n "select('*')" app/(auth)/register.tsx
# Result: empty

grep -rn "gerarHtmlLaudo|buildHtml|<!DOCTYPE html>" app/(panel)/inspecoes/
# Result: empty (zero inline HTML generators)

npx tsc --noEmit
# Result: only pre-existing errors in app/(auth), onboarding.tsx, test-ui.tsx
# Zero errors in phase 05 files
```

## Known Stubs

None — all functionality is wired.

## Self-Check: PASSED

Files created/verified:
- FOUND: utils/laudoPdfBuilder.ts
- FOUND: utils/riscoUtils.ts
- FOUND: utils/htmlUtils.ts
- FOUND: types/vistoria.ts

Commits verified:
- FOUND: 33705be (task 5.1-5.2)
- FOUND: e5fa663 (task 5.3)
- FOUND: d7173dc (task 5.4)
- FOUND: c0ef5ca (task 5.5)
- FOUND: 076030e (task 5.6/5.7/5.9 admin/supervisor)
- FOUND: 20e5cc3 (task 5.8 laudoPdfBuilder)
- FOUND: 3eced46 (task 5.8/5.10 inspecoes screens)
- FOUND: c289033 (task 5.7 remaining files)
- FOUND: 40c4d1c (task 5.9/5.11 wizard)
- FOUND: cb3ffd8 (task 5.12 + deviations)
