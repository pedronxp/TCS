---
phase: 03-ui-auth-agente
plan: 08
subsystem: inspections-list
tags: [design-system, ux, state-components, card]
dependency_graph:
  requires: [02-design-system]
  provides: [inspections-list-design-system-integration]
  affects: [app/(panel)/inspecoes/index.tsx]
tech_stack:
  added: []
  patterns: [EmptyState, LoadingState, ErrorState, Card, fetchError-state-pattern]
key_files:
  created:
    - app/(panel)/inspecoes/index.tsx
  modified: []
decisions:
  - fetchError cleared at start of each fetchVistorias call (setFetchError(null) before try block)
  - Card.onPress used to replace outer TouchableOpacity in InspecaoCard — single pressable surface, no nested TouchableOpacity
  - ErrorState only shown when !loading to avoid flashing during retry
  - FlatList only rendered when !loading && fetchError === null — clean mutual exclusion of states
metrics:
  duration_seconds: 180
  completed_date: "2026-03-29"
  tasks_completed: 1
  files_modified: 1
---

# Phase 03 Plan 08: Inspecoes List — Design System State Components Summary

**One-liner:** Replaced inline ActivityIndicator and empty-view in inspections list with EmptyState, LoadingState, ErrorState, and Card design system components, adding fetchError state with retry.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Inspecoes index — EmptyState + LoadingState + ErrorState + Card wrappers | 708993d | app/(panel)/inspecoes/index.tsx |

## What Was Built

The inspections list screen (`app/(panel)/inspecoes/index.tsx`) was updated to use the design system state components:

- **LoadingState**: Replaces the `ActivityIndicator` that was shown conditionally with `{loading ? <ActivityIndicator .../> : <FlatList .../>}`. Now rendered as `{loading && <LoadingState />}` alongside the FlatList/ErrorState.

- **EmptyState**: Replaces the inline `ListEmptyComponent` View with Feather icon + Text. Now uses `EmptyState` with `icon="clipboard"`, translated title/description, and a "Nova Vistoria" action button that navigates to the creation flow.

- **ErrorState**: New state added. A `fetchError: string | null` state was introduced. The `fetchVistorias` function now calls `setFetchError(null)` at the start (before the try block) and `setFetchError('Erro ao carregar vistorias. Toque para tentar novamente.')` in the catch block. When `fetchError !== null && !loading`, `ErrorState` is rendered with an `onRetry` callback.

- **Card**: The `InspecaoCard` component's outer `TouchableOpacity` was replaced with the `Card` component using its `onPress` prop. This ensures consistent card styling (border radius, shadow/border, surface color) from the design system.

## Decisions Made

- **fetchError cleared before fetch:** Prevents stale error messages from persisting when the user triggers a retry or navigation back/forth.

- **Card.onPress replaces TouchableOpacity:** The `Card` component natively supports `onPress` (renders as `TouchableOpacity` internally), eliminating the need for a wrapping `TouchableOpacity` and ensuring consistent card presentation.

- **Mutual exclusion of UI states:** `FlatList` is only rendered when `!loading && fetchError === null`. `ErrorState` is only shown when `!loading`. This prevents UI state conflicts (e.g., showing loading spinner + error at the same time).

## Deviations from Plan

None — plan executed exactly as written. The `Card` component's `onPress` prop was used to replace the outer `TouchableOpacity` in `InspecaoCard` rather than wrapping it, which is a natural implementation of "wrap the outer View with Card" since the Card already handles press interactions.

## Known Stubs

None — all data flows are wired. The EmptyState "Nova Vistoria" action navigates to the real creation route `/(panel)/inspecoes/dados-iniciais`.

## Self-Check: PASSED
