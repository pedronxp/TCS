---
phase: 03-ui-auth-agente
plan: 10
subsystem: ui
tags: [react-native, expo, sqlite, supabase, offline-first, offline-badge, error-state]

# Dependency graph
requires:
  - phase: 03-ui-auth-agente
    provides: Badge and ErrorState components from design system
provides:
  - "Vistoria detail screen with Supabase+SQLite fallback for offline vistorias"
  - "Normalized VistoriaLocal fields (snake_case to camelCase) for offline records"
  - "Offline Badge (warning) when vistoria status is Pendente de sincronizacao"
  - "ErrorState with retry when vistoria not found in Supabase or SQLite"
affects: [inspecoes-detail, offline-sync, vistoria-laudo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase-first + SQLite fallback pattern for offline-first detail screens"
    - "VistoriaLocal snake_case fields normalized to camelCase before state update"
    - "fetchError state separate from loading for granular error vs not-found handling"

key-files:
  created: []
  modified:
    - app/(panel)/inspecoes/[id].tsx
    - utils/database.ts (no changes needed — getVistoriaById already existed)

key-decisions:
  - "getVistoriaById already existed in utils/database.ts — no modification needed"
  - "populateReport extracted as named function to avoid duplication across Supabase and SQLite branches"
  - "fetchError state drives ErrorState rather than repurposing vistoria null check — cleaner separation"

patterns-established:
  - "Offline fallback pattern: try Supabase, catch/fallback to SQLite, throw if neither"
  - "Badge variant=warning for offline-only records identified by status field"

requirements-completed: [BUG-C4, UX-redesign]

# Metrics
duration: 10min
completed: 2026-03-30
---

# Phase 03 Plan 10: Vistoria Detail Offline Fallback Summary

**Supabase-first + SQLite fallback for vistoria detail screen, with normalized VistoriaLocal fields, offline warning Badge, and ErrorState with retry on fetch failure**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-30T22:20:00Z
- **Completed:** 2026-03-30T22:30:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Refactored `fetchDetalhes` in `app/(panel)/inspecoes/[id].tsx` to try Supabase first, then fall back to local SQLite via `getVistoriaById`
- VistoriaLocal snake_case fields (e.g., `agente_uid`, `endereco_rua`) normalized to camelCase before `setVistoria` and `populateReport`
- Offline Badge with `variant="warning"` shown in header when `status === 'Pendente de sincronizacao'`
- `fetchError` state drives ErrorState component with `onRetry={fetchDetalhes}` when vistoria not found anywhere
- `getVistoriaById` was already present in `utils/database.ts` — no database changes required

## Task Commits

1. **Task 1: [id].tsx — SQLite fallback + offline badge + ErrorState** - `e754ca9` (feat)

## Files Created/Modified
- `app/(panel)/inspecoes/[id].tsx` — Added getVistoriaById import, Badge, ErrorState; refactored fetchDetalhes with fallback; added fetchError state; added offline Badge in header

## Decisions Made
- `getVistoriaById` already existed in `utils/database.ts`, querying `vistorias_offline` table — no duplication needed.
- Extracted `populateReport` as a standalone function inside the component to avoid duplicating the `initReport` call in both the Supabase and SQLite branches.
- Added `fetchError` as a separate state from `vistoria === null` so the two conditions can be rendered differently: `fetchError` triggers ErrorState with retry, while `vistoria === null` (after no error) falls through to a generic "not found" view.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Vistoria detail screen now handles offline vistorias correctly
- Agents can view vistorias they created offline before sync completes
- ErrorState with retry provides graceful degradation when both sources fail

---
*Phase: 03-ui-auth-agente*
*Completed: 2026-03-30*
