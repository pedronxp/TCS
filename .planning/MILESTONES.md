# Milestones

## v1.1.0 — Build Estável + UI Redesign + Qualidade (Shipped: 2026-03-31)

**Fases:** 5 | **Planos:** 23 | **Período:** 2026-03-24 → 2026-03-31 (7 dias)
**Commits:** 67 | **Código:** ~18.989 linhas TS/TSX

**Realizações:**

1. Build Android estabilizado — SDK 54 alinhado, `expo-crypto` canary removido, assets de ícone Android criados, Jest config corrigida, permissões enxutas
2. Design System completo — tokens Colors (WCAG AA), Typography, Spacing + 7 componentes UI (`Card`, `Button`, `Badge`, `EmptyState`, `LoadingState`, `ErrorState`, `SectionHeader`)
3. 14 telas Auth + Agente redesenhadas — onboarding, login, register, forgot-password, dashboard, perfil, mapas e fluxo completo de inspeções com fallback offline SQLite
4. Telas Admin/Supervisor/Master padronizadas — EmptyState/ErrorState/LoadingState em todos os painéis administrativos
5. Segurança e dívida técnica — SecureStore para tokens, logs sanitizados, utils consolidados (`riscoUtils`, `htmlUtils`, `laudoPdfBuilder`), imports dinâmicos no SyncService

**Arquivo:** `.planning/milestones/v1.1.0-ROADMAP.md`

---
