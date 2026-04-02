---
phase: 06-mapa-autentica-o
plan: "05"
subsystem: ui
tags: [react-native, animated, connectivity, offline, banner, design-system]

requires:
  - phase: 02-design-system
    provides: Colors tokens (warning, success) and ThemeContext

provides:
  - Floating ConnectivityBanner pill that appears below the header when offline/restored

affects: []

tech-stack:
  added: []
  patterns:
    - "Floating pill via alignSelf: 'center' with no left/right — content-driven width"
    - "position: 'absolute' with top: insets.top + HEADER_HEIGHT places pill below navigation"
    - "Animated.spring for enter, Animated.timing for exit"

key-files:
  created: []
  modified:
    - components/ConnectivityBanner.tsx

key-decisions:
  - "alignSelf: 'center' (not left/right: 0) is how to create truly floating pills in RN absolute-positioned context"
  - "Pill positioned at insets.top + 56 + 8 — below header — no overlap with navigation"
  - "theme.warning / theme.success used instead of hardcoded hex for dark mode support"

patterns-established:
  - "Floating toast/pill pattern: position absolute + alignSelf center + no width constraints"

requirements-completed: []

duration: 15min
completed: 2026-04-02
---

# Phase 06 Plan 05: ConnectivityBanner Pill Redesign Summary

**ConnectivityBanner refactored from full-width fixed bar to floating centered pill using Animated.spring, positioned below the navigation header with design system color tokens**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-02T00:00:00Z
- **Completed:** 2026-04-02T00:15:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Converted full-width banner (left: 0, right: 0) to a floating centered pill via `alignSelf: 'center'`
- Positioned pill below the app header at `insets.top + 56 + 8` — no overlap with navigation
- Replaced hardcoded hex colors (`#F59E0B`, `#10B981`) with `theme.warning` and `theme.success` from design system
- Added `Animated.spring` for a more natural enter animation and drop shadow for floating effect
- Added `pointerEvents="none"` so pill does not block touch events on underlying content

## Task Commits

1. **Task 1: Refatorar ConnectivityBanner para pill flutuante** - `83255d9` (feat)
2. **Task 2: Corrigir design responsivo do pill flutuante** - `fcdf30f` (fix)

## Files Created/Modified

- `components/ConnectivityBanner.tsx` - Floating pill with spring animation, design system colors, header-aware positioning

## Decisions Made

- `alignSelf: 'center'` without `left`/`right` constraints is the correct React Native pattern for content-width absolute positioned elements — the width is determined by content + `paddingHorizontal`
- Top offset uses `insets.top + HEADER_HEIGHT + 8` (56px assumed header height) to avoid overlapping the Stack navigator header
- `theme.warning` (amber) for offline state, `theme.success` (green) for restored state — both adapt to light/dark mode automatically

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pill rendering as full-width bar instead of centered pill**

- **Found during:** Task 2 (user verification of the banner design)
- **Issue:** Initial implementation still used `left: 0, right: 0` in the StyleSheet which overrides `alignSelf: 'center'`, causing the view to span the full screen width. Also used hardcoded hex colors.
- **Fix:** Removed `left` and `right` from StyleSheet, relying solely on `alignSelf: 'center'` for centering. Replaced hardcoded hex with `theme.warning` / `theme.success`.
- **Files modified:** `components/ConnectivityBanner.tsx`
- **Verification:** Component width is now driven by content + paddingHorizontal only
- **Committed in:** `fcdf30f`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in initial implementation)
**Impact on plan:** Fix was required to meet the visual specification. No scope creep.

## Issues Encountered

User testing revealed the initial implementation (Task 1 commit `83255d9`) still rendered as a full-width bar because `StyleSheet.create` with `left: 0, right: 0` was not removed despite adding `alignSelf: 'center'`. The second commit resolved this.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ConnectivityBanner pill is complete and matches the floating toast design pattern
- No blockers for subsequent work

---
*Phase: 06-mapa-autentica-o*
*Completed: 2026-04-02*
