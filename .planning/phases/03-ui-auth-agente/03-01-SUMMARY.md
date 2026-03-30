---
phase: 03-ui-auth-agente
plan: 01
subsystem: onboarding
tags: [ux, onboarding, design-system, animation, swipe]
dependency_graph:
  requires: [02-design-system]
  provides: [onboarding-redesign]
  affects: [app/onboarding.tsx]
tech_stack:
  added: []
  patterns: [Button-design-system, FlatList-swipeable, momentum-scroll-sync]
key_files:
  created: [app/onboarding.tsx]
  modified: []
decisions:
  - import path is ../components/ui (not ../../) because app/onboarding.tsx is one level below root
  - Removed TouchableOpacity and buttonStyle overrides entirely — Button component handles all styling
  - handleFinalizar/handleNext retained as named functions (not inlined) for clarity
metrics:
  duration_s: 300
  completed_date: "2026-03-29"
  tasks: 1
  files: 1
---

# Phase 03 Plan 01: Onboarding — Visual Hierarchy + Swipe + Design System Buttons Summary

Onboarding screen upgraded with swipeable FlatList, enlarged icon circles (220/160), improved typography (fontSize 30 / weight 800 / letterSpacing -0.8), and Button components from the Phase 2 design system replacing both TouchableOpacity buttons.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Onboarding — swipe + visual hierarchy + design system buttons | b0d61c3 | app/onboarding.tsx |

## Changes Made

### app/onboarding.tsx

**Functional changes:**
- `scrollEnabled` changed from `false` to `true` on FlatList — users can swipe slides manually
- `onMomentumScrollEnd` added to FlatList — dot indicator updates when user swipes (rounds offset / width to get index)
- TouchableOpacity "Pular" replaced with `<Button variant="ghost">` routing to `/(auth)`
- TouchableOpacity "Próximo"/"Começar" replaced with `<Button variant="primary">` that calls `handleNext` or `handleFinalizar`

**Visual changes:**
- iconCircle: 200x200 → 220x220 (borderRadius 100 → 110)
- iconInner: 140x140 → 160x160 (borderRadius 70 → 80)
- slide paddingTop: 80 → 100
- title: fontSize 28 → 30, letterSpacing -0.5 → -0.8, marginBottom 16 → 20
- subtitle: fontSize 16 → 17, lineHeight 24 → 26
- iconCircle marginBottom: 48 → 60
- dots gap: 6 → 8; active dot width: 24 → 28
- Removed nextBtn/nextText styles (handled by Button component)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Corrected Button import path**
- **Found during:** Task 1
- **Issue:** Plan shows `'../../components/ui'` but file lives at `app/onboarding.tsx` — one level below root, so correct path is `'../components/ui'`
- **Fix:** Used `../components/ui` (not `../../components/ui`)
- **Files modified:** app/onboarding.tsx
- **Commit:** b0d61c3

## Known Stubs

None — all content is real data (SLIDES array), real navigation handlers, and real design system components.

## Self-Check: PASSED

- [x] app/onboarding.tsx created: b0d61c3
- [x] scrollEnabled={true} present
- [x] onMomentumScrollEnd present
- [x] Button import from ../components/ui present
- [x] iconCircle width: 220 present
- [x] fontSize: 30 in title present
