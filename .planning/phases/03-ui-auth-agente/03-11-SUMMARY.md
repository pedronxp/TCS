---
phase: 03-ui-auth-agente
plan: 11
subsystem: inspecoes/dados-iniciais
tags: [bug-fix, ux, cep, validation, mask]
dependency_graph:
  requires: [03-08]
  provides: [CEP validation guard, CEP mask formatting, error banner]
  affects: [app/(panel)/inspecoes/dados-iniciais.tsx]
tech_stack:
  added: []
  patterns: [inline error banner with rgba(239,68,68,0.08), XXXXX-XXX mask pattern]
key_files:
  created: []
  modified:
    - app/(panel)/inspecoes/dados-iniciais.tsx
decisions:
  - buscarCep accepts optional cepOverride parameter to avoid stale closure when called auto-trigger from handleCepChange
  - maxLength updated to 9 to accommodate XXXXX-XXX format (5 digits + hyphen + 3 digits)
metrics:
  duration_seconds: 300
  completed_date: "2026-03-30"
  tasks_completed: 1
  files_modified: 1
requirements_addressed: [BUG-UX-05, UX-redesign]
---

# Phase 03 Plan 11: CEP Validation Guard + Mask + Error Banner Summary

CEP pre-request validation guard (cepLimpo.length !== 8), XXXXX-XXX mask, and rgba error banner replacing plain text error in dados-iniciais.tsx.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Dados-iniciais — CEP validation guard + mask + error banner + field consistency | 383a99c | app/(panel)/inspecoes/dados-iniciais.tsx |

## What Was Built

Fixed BUG-UX-05 in `app/(panel)/inspecoes/dados-iniciais.tsx`:

1. **CEP validation guard** — `buscarCep` now extracts `cepLimpo` and checks `cepLimpo.length !== 8` before making any HTTP request, setting `erroCep('CEP deve ter 8 dígitos.')` and returning early. Previously it silently returned without user feedback.

2. **CEP mask** — `handleCepChange` now applies XXXXX-XXX format: strips non-digits, limits to 8 digits, inserts hyphen after position 5. `maxLength` updated to 9. Placeholder updated to `"CEP (ex: 12345-678)"`.

3. **Error banner** — Replaced plain `<Text style={styles.errorText}>` with the standard error banner using `backgroundColor: 'rgba(239,68,68,0.08)'`, red border, and `Feather "alert-circle"` icon (Feather was already imported).

4. **Field consistency** — Input style updated: `height: 52 → 60`, `borderRadius: 12 → 16`, `paddingHorizontal: 14 → 16`. CEP button updated to match: `height: 52 → 60`, `borderRadius: 12 → 16`.

5. **Stale closure fix** — `buscarCep` accepts optional `cepOverride?: string` so `handleCepChange` can pass the freshly-formatted value directly, avoiding React state not-yet-committed issue.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale closure in auto-trigger CEP search**
- **Found during:** Task 1
- **Issue:** `handleCepChange` calls `buscarCep()` after `setForm(...)` — React state update is async, so `form.cep` inside `buscarCep` would read the old value, causing the length check to operate on stale data.
- **Fix:** Added optional `cepOverride?: string` parameter to `buscarCep`. `handleCepChange` passes `formatado` directly. Manual "BUSCAR" button press still uses `form.cep` (fine, since it runs after state settles).
- **Files modified:** app/(panel)/inspecoes/dados-iniciais.tsx
- **Commit:** 383a99c

## Known Stubs

None.

## Self-Check: PASSED

- File exists: app/(panel)/inspecoes/dados-iniciais.tsx — FOUND
- Commit 383a99c — FOUND (git rev-parse --short HEAD)
- cepLimpo.length !== 8 guard — present at line 121
- slice(0, 5) mask — present at line 148
- rgba(239,68,68,0.08) banner — present at lines 259-260
- setErroCep with null and error string — present at lines 122, 125, 131, 140, 150
