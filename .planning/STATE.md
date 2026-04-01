---
gsd_state_version: 1.0
milestone: v1.2.0
milestone_name: — Correções Críticas + Funcionalidades Core
status: executing
last_updated: "2026-04-01T22:05:37Z"
last_activity: 2026-04-01 -- Phase 06 Plan 02 checkpoint reached (Task 3)
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 3
  completed_plans: 0
---

# State — Defesa Civil Expo

## Current Position

Phase: 06 (mapa-autentica-o) — EXECUTING
Plan: 2 of 3 (checkpoint: aguardando SQL no Supabase)
Status: Executing Phase 06 — checkpoint human-verify ativo
Last activity: 2026-04-01 -- Phase 06 Plan 02 checkpoint reached (Task 3)

## Decisions Made

- AUTH-01: Usar RPC server-side `validate_invite_token` para comparação de expiração de token via PostgreSQL `now()`, eliminando bug de fuso horário onde tokens recém-criados apareciam como expirados

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
