---
phase: 03-ui-auth-agente
plan: 09
subsystem: wizard
tags: [bug-fix, auto-save, foto, animation, ux]
dependency_graph:
  requires: [03-08]
  provides: [wizard-stepRef-fix, wizard-foto-url-persistence, wizard-fade-animation]
  affects: [app/(panel)/inspecoes/wizard.tsx]
tech_stack:
  added: []
  patterns: [useRef-stale-closure-fix, Animated-fade-transition, foto-url-extraction]
key_files:
  created: []
  modified:
    - app/(panel)/inspecoes/wizard.tsx
decisions:
  - stepRef.current used in auto-save setTimeout callback to avoid stale closure over step state
  - foto_url extracted from first 'foto'-type question response; falls back to null if none answered
  - animateToStep() replaces direct setStep() in all navigation handlers (header back, footer VOLTAR, avancar)
  - progressFill height also updated alongside progressTrack for consistency
metrics:
  duration_s: 180
  completed_date: "2026-03-30T22:16:19Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase 03 Plan 09: Wizard Critical Bug Fixes + UX Improvements Summary

Fixes two data-loss bugs in wizard: stepRef stale-closure auto-save (BUG-M9) and hardcoded null foto_url losing captured photos (BUG-A6), plus fade transition animation and improved visual feedback.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Wizard stepRef fix + foto_url + fade + feedback | 1481b6a | Done |

## What Was Built

### BUG-M9 Fix — stepRef Auto-save Stale Closure
The `setResposta` function uses a `setRespostas(r => ...)` updater pattern. Inside that callback, the `step` variable from the outer closure was captured at the time the callback was created — not the current step. This caused auto-save to always write step 0 (or the step at last render) instead of the actual current step.

Fix: `stepRef = useRef(step)` declared after the `step` state, with a `useEffect(() => { stepRef.current = step; }, [step])` to keep it current. The auto-save `setTimeout` now uses `stepRef.current` which always reflects the actual current step.

### BUG-A6 Fix — foto_url Persistence
The `vistoriaLocal` object was constructed with `foto_url: null` unconditionally, discarding any photo URI the user captured via the foto-type question. Fix: before constructing `vistoriaLocal`, find the first foto-type question that has a response (`respostas[p.id]`), extract its URI as `fotoUri`, and use `foto_url: fotoUri` in the object. Falls back to `null` if no photo was taken.

### Fade Transition Animation
Imported `Animated` from react-native. Added `fadeAnim = useRef(new Animated.Value(1)).current`. Created `animateToStep(newStep)` that fades opacity to 0 over 100ms, calls `setStep(newStep)`, then fades back to 1 over 200ms. All navigation (header back button, footer VOLTAR button, `avancar` next handler) now calls `animateToStep()` instead of `setStep()` directly.

The question content area is wrapped in `<Animated.View style={{ opacity: fadeAnim }}>`.

### Visual Feedback
- FINALIZAR button: when `salvando=true`, shows `<Text style={{ color: '#fff' }}>Salvando...</Text>` alongside `<ActivityIndicator color="#fff" size="small" />` in a row layout, replacing the previous spinner-only state.
- Progress track height: changed from `3` to `4` (both `progressTrack` and `progressFill` styles).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all changes wire to real data (stepRef.current reflects live state, fotoUri comes from actual respostas).

## Self-Check: PASSED

- File exists: `app/(panel)/inspecoes/wizard.tsx` — FOUND
- Commit 1481b6a — FOUND
- `stepRef` grep matches: useRef declaration, useEffect sync, stepRef.current in auto-save — VERIFIED
- `foto_url: fotoUri` — VERIFIED
- `fadeAnim` — VERIFIED
- `Salvando...` — VERIFIED
- `progressTrack: { height: 4 }` — VERIFIED
