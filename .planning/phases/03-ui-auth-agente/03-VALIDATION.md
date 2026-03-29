---
phase: 03
slug: ui-auth-agente
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest-expo (jest 29.x) |
| **Config file** | package.json → `jest` section (jest-expo preset) |
| **Quick run command** | `npm test -- --passWithNoTests --testPathPattern="(utils|database)"` |
| **Full suite command** | `npm test -- --passWithNoTests` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node -e "require('./package.json')"` (fast syntax check)
- **After every plan wave:** Run `npm test -- --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Screen | Wave | Requirement | Test Type | Automated Command | Status |
|---------|--------|------|-------------|-----------|-------------------|--------|
| 03-auth-01 | onboarding.tsx | 1 | UX-redesign | static | `grep "scrollEnabled={true}" app/onboarding.tsx` | ⬜ pending |
| 03-auth-02 | (auth)/index.tsx | 1 | UX-redesign | static | `grep "Button" app/\(auth\)/index.tsx` | ⬜ pending |
| 03-auth-03 | login.tsx | 1 | UX-redesign | static | `grep "email.trim()" app/\(auth\)/login.tsx` | ⬜ pending |
| 03-auth-04 | register.tsx | 1 | SEG-05 | static | `grep "select('id, codigo" app/\(auth\)/register.tsx` | ⬜ pending |
| 03-auth-05 | forgot-password.tsx | 1 | UX-redesign | static | `grep "Button" app/\(auth\)/forgot-password.tsx` | ⬜ pending |
| 03-panel-01 | dashboard.tsx | 2 | PERF-01 | static | `grep "useMemo" app/\(panel\)/dashboard.tsx` | ⬜ pending |
| 03-panel-02 | perfil.tsx | 2 | PERF-05 | static | `grep "count: 'exact'" app/\(panel\)/perfil.tsx` | ⬜ pending |
| 03-panel-03 | inspecoes/index.tsx | 2 | UX-redesign | static | `grep "EmptyState" app/\(panel\)/inspecoes/index.tsx` | ⬜ pending |
| 03-insp-01 | wizard.tsx (stepRef) | 3 | BUG-M9 | static | `grep "stepRef" app/\(panel\)/inspecoes/wizard.tsx` | ⬜ pending |
| 03-insp-02 | wizard.tsx (foto) | 3 | BUG-A6 | static | `grep "foto_url" app/\(panel\)/inspecoes/wizard.tsx` | ⬜ pending |
| 03-insp-03 | [id].tsx | 3 | BUG-C4 | static | `grep "getVistoriaById" app/\(panel\)/inspecoes/\[id\].tsx` | ⬜ pending |
| 03-insp-04 | dados-iniciais.tsx | 3 | BUG-UX-05 | static | `grep "cepLimpo.length !== 8" app/\(panel\)/inspecoes/dados-iniciais.tsx` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase is pure UI refactoring — no new test files needed. All verifications use grep-based static analysis on committed code.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slide desliza com dedo | onboarding UX | Requires device/emulator | Deslizar lateralmente nos slides no emulador |
| Vistoria offline funciona | BUG-C4 | Requires offline mode | Desligar WiFi → abrir vistoria criada offline |
| Foto salva aparece no laudo | BUG-A6 | Requires camera | Tirar foto no wizard → gerar laudo → verificar imagem |
| Fade de transição suave | wizard UX | Visual only | Verificar animação ao navegar entre perguntas |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
