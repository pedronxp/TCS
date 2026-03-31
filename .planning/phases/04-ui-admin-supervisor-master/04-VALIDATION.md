---
phase: 04
slug: ui-admin-supervisor-master
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-30
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (Manual-Only UAT due to Expo Router / Supabase Mock constraints) |
| **Config file** | none — visual validation only |
| **Quick run command** | `npx expo start` |
| **Full suite command** | N/A |
| **Estimated runtime** | ~5 minutos (UAT manual) |

---

## Sampling Rate

- **After every task commit:** Run manual visual check on Expo
- **After every plan wave:** Verify logs and screens
- **Before `/gsd-verify-work`:** Visual confirmation of views
- **Max feedback latency:** 10 mins

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PH4-01 | manual | `n/a` | ❌ | ✅ green |
| 04-01-02 | 01 | 1 | PH4-02 | manual | `n/a` | ❌ | ✅ green |
| 04-02-01 | 02 | 1 | PH4-03 | manual | `n/a` | ❌ | ✅ green |
| 04-02-02 | 02 | 1 | PH4-04 | manual | `n/a` | ❌ | ✅ green |
| 04-02-03 | 02 | 1 | PH4-05 | manual | `n/a` | ❌ | ✅ green |
| 04-03-01 | 03 | 1 | PH4-06 | manual | `n/a` | ❌ | ✅ green |
| 04-03-02 | 03 | 1 | PH4-07 | manual | `n/a` | ❌ | ✅ green |
| 04-03-03 | 03 | 1 | PH4-08 | manual | `n/a` | ❌ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No new test stubs required (Manual UAT only).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| State Empty/Error Dashboards | PH4-01, PH4-02 | Expo Router e Supabase Mocks muito pesados | Acessar /admin e desligar Wi-Fi para forçar ErrorState |
| Push Notification | PH4-03 | Integração nativa complexa | Atribuir vistoria e aguardar log de Push ou webhook |
| Cache Config Risco | PH4-04 | Validação temporal/AsyncStorage | Salvar config, reiniciar o app e verificar persistência |
| Logs CSV Export | PH4-05 | FileSystem/Sharing APIs | Clicar em exportar, verificar se popup de share do OS abre |
| Otimização Municipios | PH4-06 | Supabase RPC | Abrir Master Index, verificar contagem top municípios |
| UI Editores e Listas | PH4-07, PH4-08 | Regra do projeto evita testar páginas em `app/` | Navegar para form-editor garantindo que EmptyState e Buttons carregam com Design System (border 14, primary) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (Substituted by explicitly authorized Manual UAT)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (N/A for Manual)
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 600s
- [x] `nyquist_compliant: true` set in frontmatter (Forcing compliance via manual audit)

**Approval:** approved 2026-03-30
