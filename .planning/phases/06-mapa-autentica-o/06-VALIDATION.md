---
phase: 06
slug: mapa-autentica-o
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest-expo 54.0.0 |
| **Config file** | package.json (jest key) |
| **Quick run command** | `npm test -- --passWithNoTests` |
| **Full suite command** | `npm test -- --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --passWithNoTests`
- **After every plan wave:** Run `npm test -- --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green + manual smoke test on device
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-??-01 | MAPA | 1 | MAPA-01 | manual (device) | manual smoke test | N/A | ⬜ pending |
| 06-??-02 | MAPA | 1 | MAPA-02 | manual (device) | manual smoke test | N/A | ⬜ pending |
| 06-??-03 | AUTH | 1 | AUTH-01 | unit | `npm test -- utils/__tests__/tokenExpiry.test.ts` | ❌ W0 | ⬜ pending |
| 06-??-04 | AUTH | 1 | AUTH-02 | manual | manual smoke test against Supabase | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `utils/__tests__/tokenExpiry.test.ts` — stub + unit tests for AUTH-01 date comparison logic

*MAPA-01, MAPA-02, AUTH-02 require manual device testing — no automated test gap to fill.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WebView container renders with non-zero dimensions, no white screen | MAPA-01 | Requires physical device — WebView rendering cannot be tested with jest | Open map screen on Android + iOS device, confirm map renders without white screen |
| Leaflet CDN scripts load without console errors | MAPA-02 | Requires real network in WebView sandbox on physical device | Open map screen on device with internet, confirm tiles load and no console errors |
| Municipality insert succeeds for master_admin | AUTH-02 | Requires live Supabase connection with correct RLS policies | Log in as master_admin, create a new municipality, confirm it appears in the list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
