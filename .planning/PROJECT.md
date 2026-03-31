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

## Estado Atual (v1.1.0 — 2026-03-31)

App com build estável, design system completo e todas as telas implementadas e padronizadas.

- ✓ Build Android compila sem erros (SDK 54)
- ✓ Design System: Colors (WCAG AA), Typography, Spacing, 7 componentes UI
- ✓ Todas as telas redesenhadas com design system
- ✓ Segurança: SecureStore, logs sanitizados, utils consolidados
- ✓ Tema automático baseado no dispositivo (sem dialog)
- ✓ ~18.989 linhas TS/TSX

## Requisitos Validados (v1.1.0)

- ✓ Build Android sem erros — v1.1.0
- ✓ Dependências alinhadas ao SDK 54 — v1.1.0
- ✓ Design system com contraste WCAG AA — v1.1.0
- ✓ Componentes UI reutilizáveis (Button, Card, Badge, etc.) — v1.1.0
- ✓ Telas Auth + Agente redesenhadas — v1.1.0
- ✓ Telas Admin/Supervisor/Master padronizadas — v1.1.0
- ✓ Fallback offline SQLite na tela de detalhe de vistoria — v1.1.0
- ✓ Logs sanitizados (sem dados sensíveis) — v1.1.0
- ✓ Utils consolidados (riscoUtils, htmlUtils, laudoPdfBuilder) — v1.1.0

## Decisões Chave

| Decisão | Racional | Resultado |
|---------|----------|-----------|
| Versões SDK obtidas do `npx expo install --check` | Mais preciso que tabela manual | ✓ Bom |
| Sem lib UI externa — primitives + @expo/vector-icons | Sem lock-in, controle total | ✓ Bom |
| BottomNavBar memoizado sem comparator customizado | Zero-props component | ✓ Bom |
| ThemeContext sem dialog — padrão 'system' automático | Menos fricção no onboarding | ✓ Bom |
| Dynamic import NotificationService no SyncService | Evita crash no Expo Go | ✓ Bom |
| laudoPdfBuilder.ts usa resultado.tsx como canônico | Consistência visual | ✓ Bom |
| Button aceita children como fallback para label | API mais ergonômica | ✓ Bom |
| RPC get_municipios_stats opcional (warn, não throw) | Tela funciona sem RPC | ✓ Bom |

## applicationId
`br.gov.defesacivil.app`

---
*Última atualização: 2026-03-31 após milestone v1.1.0*
