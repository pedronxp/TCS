---
phase: 02-design-system
plan: gap-02
subsystem: navigation
tags: [react-memo, performance, bottom-nav, refactor]
dependency_graph:
  requires: []
  provides: [DS-06]
  affects: [components/BottomNavBar.tsx]
tech_stack:
  added: []
  patterns: [React.memo with prop-based inner component, thin wrapper pattern]
key_files:
  modified:
    - components/BottomNavBar.tsx
decisions:
  - BottomNavBarInner receives role+pathname as props so React.memo equality check is meaningful
  - Outer BottomNavBar is a plain function (not memo'd) — no benefit since it always re-renders on context change
  - useTheme kept inside BottomNavBarInner so theme changes correctly trigger re-render of the inner component
metrics:
  duration_seconds: 120
  completed_date: "2026-03-29"
  tasks_completed: 1
  files_modified: 1
---

# Phase 02 Plan gap-02: BottomNavBar Memoization Refactor Summary

**One-liner:** Introduced prop-based React.memo via BottomNavBarInner so AuthContext changes without role change no longer re-render the navigation bar.

## What Was Built

Refactored `components/BottomNavBar.tsx` from a zero-props memoized component (where React.memo was ineffective) to a two-layer architecture:

- **`BottomNavBarInner`** — `React.memo(function BottomNavBarInner({ role, pathname }))`. Receives `role: string` and `pathname: string` as props. Contains all rendering logic, tab selection, active-state detection, and styles. Uses `useTheme()` internally (theme changes should still trigger re-render — correct behavior).
- **`BottomNavBar`** (exported) — Plain function that calls `useAuth()` and `usePathname()`, extracts only `profile.role`, guards on `!profile`, and renders `<BottomNavBarInner role={profile.role} pathname={pathname} />`.

## Why This Matters

The original `React.memo(BottomNavBarComponent)` was wrapping a component with zero props. React.memo compares props shallowly — with no props, it could never skip a re-render caused by internal hook subscriptions (`useAuth`, `usePathname`). Every AuthContext change (session refresh, TOKEN_REFRESHED event re-fetching the profile) triggered a full re-render of the nav bar even when `profile.role` was unchanged.

The new pattern ensures that when `profile.role` stays the same and `pathname` stays the same, `BottomNavBarInner` is skipped entirely.

## Acceptance Criteria — All Met

| Criterion | Status |
|-----------|--------|
| `React.memo(function BottomNavBarInner` present | PASS |
| `interface BottomNavBarInnerProps` with `role: string` | PASS |
| Outer `BottomNavBar` passes `profile.role` as prop | PASS |
| `React.memo(BottomNavBarComponent)` removed | PASS |
| Export is `export function BottomNavBar()` | PASS |

## Deviations from Plan

None — plan executed exactly as written. The refactor matched the architecture specification in the plan one-to-one.

## Known Stubs

None.

## Self-Check

- `components/BottomNavBar.tsx` exists and contains all required patterns (verified via grep).
- Commit `ef5b17d` exists in git log.

## Self-Check: PASSED
