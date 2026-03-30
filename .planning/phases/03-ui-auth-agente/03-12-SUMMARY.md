---
phase: 03-ui-auth-agente
plan: 12
subsystem: inspecoes-ui
tags: [design-system, card, badge, async-states, form-selection]
dependency_graph:
  requires: [03-08]
  provides: [selecao-formulario-redesign]
  affects: [app/(panel)/inspecoes/selecao-formulario.tsx]
tech_stack:
  added: []
  patterns: [Card-wrapper, Badge-variant, LoadingState/EmptyState/ErrorState trio]
key_files:
  modified:
    - app/(panel)/inspecoes/selecao-formulario.tsx
decisions:
  - Built-in forms keep their original icon field (layers, trending-down, home, droplet); getFormIcon helper only applies to dynamic custom forms
  - formError set in catch block but cache fallback still runs — built-in forms always remain available even on error
  - EmptyState shown only for custom forms section (built-in forms always render); empty message targets admin-published forms
metrics:
  duration_s: 180
  completed_date: "2026-03-30"
  tasks_completed: 1
  files_modified: 1
---

# Phase 03 Plan 12: Selecao Formulario — Card Redesign and Async States Summary

Replaced plain card views in form selection screen with design system Card components, adding Feather icon + title (fontSize 16, fontWeight 700) + description + Badge type per card, and implemented all three async states (LoadingState, EmptyState, ErrorState) for the custom forms section.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Selecao-formulario — Card wrappers, icon+badge per card, async states | 54a8c5d | app/(panel)/inspecoes/selecao-formulario.tsx |

## What Was Built

The form selection screen (`selecao-formulario.tsx`) now:

1. **Card wrappers** — Both built-in and custom forms are wrapped in the design system `Card` component with dynamic border highlighting for selected state
2. **Rich card layout** — Each card shows: 44x44 icon container with Feather icon + title (fontSize 16, fontWeight 700) + description text + Badge row with chevron/checkmark
3. **Badge types** — Built-in forms show `<Badge variant="success">Built-in</Badge>`; custom forms show `<Badge variant="warning">Personalizado</Badge>`
4. **Async states**:
   - `LoadingState` renders while fetching custom forms
   - `ErrorState` with `onRetry={fetchDynamicForms}` renders on fetch failure
   - `EmptyState` with icon="file-text" renders when no custom forms are available
5. **formError state** — Added `useState<string | null>(null)` with `setFormError(null)` at fetch start and `setFormError('Erro ao carregar formulários.')` in catch block
6. **getFormIcon helper** — Maps form title keywords (água/enchente/inundacao → droplet, geo/desliz/talude → map-pin, estrutur/constru → home, default → file-text)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all data sources are wired. Built-in forms use hardcoded catalog (intentional, mirrors Flutter app). Custom forms fetch from Supabase with SQLite cache fallback.

## Self-Check: PASSED

- File exists: app/(panel)/inspecoes/selecao-formulario.tsx — FOUND
- Commit 54a8c5d — FOUND
- Card import and usage — FOUND (lines 10, 209, 226, 254, 271)
- Badge import and usage — FOUND (lines 10, 218, 263)
- LoadingState import and usage — FOUND (lines 10, 232)
- EmptyState import and usage — FOUND (lines 10, 237)
- ErrorState import and usage — FOUND (lines 10, 234)
