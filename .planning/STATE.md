---
gsd_state_version: 1.0
milestone: v1.2.0
milestone_name: Correções Críticas + Funcionalidades Core
status: planning
stopped_at: Milestone v1.2.0 iniciado — definindo requisitos
last_updated: "2026-03-31T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# State — Defesa Civil Expo

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-31 — Milestone v1.2.0 started

## Accumulated Context

- App está em v1.1.0 com build estável e design system completo
- Problemas críticos a resolver: mapa (tela branca), tokens (expiração falsa), formulários offline (campos, sync, layout), sistema de risco R1-R4, logs admin, mensagens de erro em inglês, fluxo de cadastro de municípios
- Offline stack: expo-sqlite (migrations v1–v5) + SyncService
- Backend: Supabase (Auth + PostgreSQL + Storage)
- Mapa: react-native-webview + Leaflet.js (nunca abriu)

## Project Reference

Ver: .planning/PROJECT.md (atualizado 2026-03-31)

**Core value:** App offline-first para vistorias técnicas de risco estrutural em campo
**Focus atual:** Correção dos problemas críticos de funcionalidade
