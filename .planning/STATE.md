---
gsd_state_version: 1.0
milestone: v1.2.0
milestone_name: Correções Críticas + Funcionalidades Core
status: planning
stopped_at: Roadmap v1.2.0 criado — Phases 06-09 definidas, aguardando plan-phase
last_updated: "2026-03-31T00:00:00.000Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# State — Defesa Civil Expo

## Current Position

Phase: Not started (roadmap criado)
Plan: —
Status: Roadmap aprovado — pronto para plan-phase 06
Last activity: 2026-03-31 — Roadmap v1.2.0 definido (4 fases, 10 requisitos)

## Phase List (v1.2.0)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 06 | Mapa + Autenticação | MAPA-01, MAPA-02, AUTH-01, AUTH-02 | Not started |
| 07 | Formulários + Classificação de Risco | FORM-01, FORM-02, FORM-03 | Not started |
| 08 | Sincronização Offline | SYNC-01 | Not started |
| 09 | UX + Correções Finais | UX-01, UX-02 | Not started |

## Accumulated Context

- App está em v1.1.0 com build estável e design system completo
- Problemas críticos a resolver: mapa (tela branca), tokens (expiração falsa), formulários offline (campos, sync, layout), sistema de risco R1-R4, logs admin, mensagens de erro em inglês, fluxo de cadastro de municípios
- Offline stack: expo-sqlite (migrations v1–v5) + SyncService
- Backend: Supabase (Auth + PostgreSQL + Storage)
- Mapa: react-native-webview + Leaflet.js (nunca abriu — fix é layout WebView flex:1)
- Token expiry: problema de config JWT no Supabase dashboard, não bug de código
- Sync: implementar outbox pattern com idempotency keys + last-write-wins

## Project Reference

Ver: .planning/PROJECT.md (atualizado 2026-03-31)

**Core value:** App offline-first para vistorias técnicas de risco estrutural em campo
**Focus atual:** Fase 06 — Mapa + Autenticação
