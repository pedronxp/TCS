---
phase: 03-ui-auth-agente
plan: "07"
subsystem: panel/perfil
tags: [perf, ux, design-system, supabase, react-native]
dependency_graph:
  requires: [02-design-system]
  provides: [perfil-screen-redesigned]
  affects: [app/(panel)/perfil.tsx]
tech_stack:
  added: []
  patterns:
    - count:exact parallel queries (PERF-05)
    - design-system Badge/Card/ErrorState integration
key_files:
  created:
    - app/(panel)/perfil.tsx
  modified: []
decisions:
  - "Badge uses label prop (not children) — adapted to actual component API"
  - "agent role maps to success variant, admin to error, supervisor/master_admin to warning — semantic color mapping for roles"
  - "statsError only shown for agent/supervisor/admin stats section, not blocking entire screen"
metrics:
  duration_seconds: 180
  completed_date: "2026-03-30"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 03 Plan 07: Perfil Screen — PERF-05 + UX-08 + Design System Summary

**One-liner:** Profile screen refactored with 4x count:exact parallel Supabase queries (O(1) vs full-fetch), design system Badge/Card/ErrorState, and Ver Introducao onboarding revisit button.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Perfil — count:exact queries, Badge, Ver Introducao, ErrorState, Card | e984390 | app/(panel)/perfil.tsx |

## What Was Built

**PERF-05 — count:exact queries for agent stats:**
The original implementation fetched all vistoria records with `.select('nivelRisco, dataVistoria')` and filtered in JavaScript. This scales linearly with data. Replaced with 4 parallel `Promise.all` queries using `{ count: 'exact', head: true }` — Supabase runs these as O(1) COUNT(*) queries server-side with no data transfer.

**UX-08 — Ver Introducao button:**
Added a new row in the Configuracoes section that navigates to `/onboarding` via `router.push('/onboarding')`, allowing agents to revisit the app introduction tour at any time.

**Design system integration:**
- `Badge` component replaces the inline `roleBadge` View with border/background color calculations
- `Card` component wraps heroCard and infoCard sections (border-radius, shadow, surface token)
- `Card` component wraps each StatCard (eliminates duplicate border/shadow inline styles)
- `ErrorState` replaces silent catch — when loadStats fails, `statsError` state drives a retry UI

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Badge API mismatch: uses `label` prop, not `children`**
- **Found during:** Task 1 — reading Badge.tsx
- **Issue:** Plan referenced `<Badge variant={...}>{profile?.role}</Badge>` but the actual Badge component API uses `label` prop not `children`
- **Fix:** Used `<Badge variant={roleBadgeVariant} label={roleLabel} />` — also passed the human-readable label instead of raw role string
- **Files modified:** app/(panel)/perfil.tsx

**2. [Rule 2 - Missing functionality] loadStats refactored to no-arg for ErrorState retry**
- **Found during:** Task 1 — original loadStats accepted (uid, role, municipio) params but ErrorState onRetry needs a no-arg callback
- **Issue:** `onRetry={loadStats}` would be called with no arguments, losing uid/role/municipio
- **Fix:** Refactored `loadStats` to use `authProfile` from closure (no params). Error state retry calls the same closure-based function correctly.
- **Files modified:** app/(panel)/perfil.tsx

## Known Stubs

None — all data is wired to live Supabase queries. Stats display is conditional on `authProfile` being loaded.

## Self-Check: PASSED

- `app/(panel)/perfil.tsx` exists: FOUND
- Commit e984390 exists: FOUND
- 7 count:exact matches (4 for agent path, 3 for supervisor/admin path): VERIFIED
- Badge import and usage: VERIFIED
- Ver Introducao navigating to /onboarding: VERIFIED
- statsError state and ErrorState render: VERIFIED
