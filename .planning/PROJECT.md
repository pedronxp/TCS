# Defesa Civil — App de Vistoria Técnica de Risco Estrutural

## Objetivo
Aplicativo mobile para agentes da Defesa Civil realizarem vistorias técnicas de risco estrutural em campo, com suporte offline-first, sincronização automática e geração de laudos PDF.

## Stack
- **Frontend:** Expo SDK 54 + Expo Router 6 + React 19 + React Native 0.81.5
- **Backend:** Supabase (Auth + PostgreSQL + Storage)
- **Offline:** expo-sqlite (migrations v1–v5) + SyncService (batch sync)
- **PDF:** expo-print + expo-sharing
- **Mapa:** react-native-webview + Leaflet.js

## Roles
- `master_admin` — Gestão de municípios e configurações globais
- `admin` — Gestão de usuários, formulários, tokens e relatórios do município
- `supervisor` — Gerenciamento de equipe e atribuição de vistorias
- `agent` — Realiza vistorias em campo

## Regras de Negócio Críticas
- NUNCA usar CPF (LGPD)
- Município vem sempre do perfil do usuário logado
- Token de convite é single-use
- Verificar `isApproved` após login antes de navegar
- Hierarquia: master_admin > admin > supervisor > agent

## Status Atual
PDR Fases 0–5 concluídas (~99%). App funcional com todas as telas implementadas.
**Fase 01 completa (2026-03-29):** Dependências alinhadas ao SDK 54, canary removido, Jest config corrigida, permissões Android enxutas.

## applicationId
`br.gov.defesacivil.app`
