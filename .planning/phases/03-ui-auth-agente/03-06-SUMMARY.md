---
phase: 03-ui-auth-agente
plan: "06"
subsystem: panel/dashboard
tags: [performance, ux, perf-01, usememo, card, errorstate]
dependency_graph:
  requires:
    - components/ui/Card
    - components/ui/ErrorState
    - components/ui/index.ts
  provides:
    - app/(panel)/dashboard.tsx with memoized date/time, Card-based KPIs, ErrorState on failure
  affects:
    - Agent dashboard home screen
tech_stack:
  added: []
  patterns:
    - useMemo with empty dep array for mount-only computation (PERF-01)
    - ErrorState conditional render replacing KPI section on metrics failure
    - Card component for KPI and shortcut grid containers
key_files:
  created:
    - app/(panel)/dashboard.tsx
  modified: []
decisions:
  - useMemo with empty dep array computes diaSemana and dataFormatada once at mount — prevents recalculation on every render
  - metricsError state drives conditional render: ErrorState replaces KPI row when fetch fails, restored on retry
  - Card noPadding=false used for grid cards (inherits default padding 16) — kpiInner adds padding:20 override via nested View
metrics:
  duration_seconds: 240
  completed_date: "2026-03-30"
  tasks_completed: 1
  files_modified: 1
---

# Phase 03 Plan 06: Dashboard Performance + Visual Improvements Summary

**One-liner:** useMemo for mount-only date/time (PERF-01), Card-based KPI and shortcut grid, ErrorState when fetchMetrics fails.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Dashboard — useMemo + Card KPIs + ErrorState | 4a80a1c | app/(panel)/dashboard.tsx |

## What Was Built

Applied PERF-01 performance fix and visual improvements to `app/(panel)/dashboard.tsx`:

**PERF-01 — useMemo for date/time:**
- Removed inline `const hoje = new Date()`, `diaSemana`, `dataFormatada` calculations from component body
- Added `useMemo(() => { ... }, [])` with empty dependency array — computes only on mount

**ErrorState on metrics failure:**
- Added `metricsError` state (`useState<string | null>(null)`)
- `fetchMetrics` sets `setMetricsError(null)` at start (clears on retry) and `setMetricsError('Não foi possível carregar as métricas')` in catch block
- KPI section conditionally renders `<ErrorState message={metricsError} onRetry={onRefresh} />` when `metricsError !== null`

**Card-based KPI cards:**
- Replaced custom `kpiCard` View with `<Card style={styles.kpiCardBase}>` (noPadding=false for Card's own padding)
- Added `kpiInner` View with `padding: 20` for content breathing room
- `kpiRow` uses `gap: 16` (up from 12)

**Card-based shortcut grid:**
- Replaced `TouchableOpacity` + `gridCard` View with `<Card ... onPress={...}>` — Card handles press affordance via its `onPress` prop

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `app/(panel)/dashboard.tsx` exists and contains all required patterns
- [x] `useMemo` with `[]` dep array present (line 25-30)
- [x] `metricsError` state declared, set in catch, cleared at start of fetch (lines 20, 44, 80)
- [x] `ErrorState` imported and rendered conditionally (lines 9, 135)
- [x] `Card` imported and used for KPI and grid cards (line 9, 138-232)
- [x] Commit 4a80a1c exists

## Self-Check: PASSED
