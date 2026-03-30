# Roadmap — Defesa Civil Expo

## Milestone: v1.1.0 — Build Estável + UI Redesign + Qualidade
**Objetivo:** Tornar o app pronto para distribuição APK com build estável, interface consistente e moderna, bugs críticos corrigidos e dívida técnica reduzida.

**Contexto:** App com fases PDR 0–5 concluídas (~99%). Análise completa identificou 6 itens críticos que bloqueiam o build de produção, problemas de consistência visual em todas as telas, e dívida técnica com funções duplicadas em 6+ arquivos.

---

## Phase 1: Correções de Build e Dependências
**Goal:** Garantir que o projeto compila sem erros e todas as dependências estão alinhadas ao SDK 54.

**Scope:**
- Alinhar todas as dependências ao Expo SDK 54 (7 pacotes com versão SDK 55 errada)
- Remover `expo-crypto` canary e substituir pela versão estável ou remover se não usada
- Remover `lucide-react-native` (dependência morta — nunca importada)
- Criar assets de ícone Android faltando (`android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`, `icon.png`, `splash-icon.png`)
- Corrigir configuração do Jest (`setupAfterEnv`, `testMatch`)
- Remover permissões Android não usadas (`ACCESS_BACKGROUND_LOCATION`, `USE_BIOMETRIC`, `USE_FINGERPRINT`)

**Must-haves:**
- `npx expo install --check` passa sem erros
- Build Android não falha por assets faltando
- Zero dependências canary/pré-release em produção

---

## Phase 2: Design System — Base Visual
**Goal:** Criar fundação de design consistente (cores, tipografia, espaçamento, componentes base) que será usada por todas as telas nas fases seguintes.

**Scope:**
- Expandir `constants/Colors.ts` — adicionar tokens `success`, `warning`, `error`, `surface`, `surfaceVariant`, `muted`, `onSurface`, melhorar contraste (WCAG AA)
- Criar `constants/Typography.ts` — escala tipográfica completa (display, heading, body, caption, label) com fontSizes, fontWeights, lineHeights
- Criar `constants/Spacing.ts` — escala de espaçamento consistente (4, 8, 12, 16, 20, 24, 32, 40, 48)
- Criar componentes reutilizáveis em `components/ui/`:
  - `Card.tsx` — container com sombra, border-radius, padding padronizados
  - `Button.tsx` — variantes (primary, secondary, ghost, danger) com loading state e feedback visual
  - `Badge.tsx` — para status de risco (R1/R2/R3/R4) e roles
  - `EmptyState.tsx` — estado vazio padronizado com ícone, título e ação opcional
  - `LoadingState.tsx` — skeleton e spinner padronizados
  - `ErrorState.tsx` — estado de erro com mensagem e botão retry
  - `SectionHeader.tsx` — cabeçalho de seção consistente
- Atualizar `BottomNavBar.tsx` — memoizar com `React.memo`, refinamento visual

**Must-haves:**
- Todos os componentes base implementados e funcionando
- `Colors.ts` com contraste mínimo WCAG AA (4.5:1)
- `BottomNavBar` memoizado

---

## Phase 3: UI Redesign — Auth + Agente
**Goal:** Aplicar o novo design system em todas as telas da jornada de autenticação e do painel do agente (telas mais usadas).

**Scope:**

**Auth (4 telas):**
- `onboarding.tsx` — redesign dos slides, hierarquia visual melhor, botão "Ver introdução" no perfil
- `(auth)/index.tsx` — tela de boas-vindas mais limpa
- `login.tsx` — feedback visual em loading, mensagens de erro inline
- `register.tsx` + `forgot-password.tsx` — consistência com login

**Painel Agente (3 telas + fluxo de inspeções):**
- `dashboard.tsx` — usar `useMemo` para data/hora, Cards com breathing room, hierarquia clara
- `mapas.tsx` — estados de loading/erro melhorados
- `perfil.tsx` — hierarquia visual melhorada, queries com `count: exact`

**Fluxo de Inspeções (9 telas):**
- `inspecoes/index.tsx` — lista com `EmptyState`, feedback de erro
- `dados-iniciais.tsx` — validação de CEP antes da request
- `selecao-formulario.tsx` — cards de formulário mais claros
- `wizard.tsx` — feedback visual nas ações, corrigir closure stale de `step`
- `risco.tsx`, `resultado.tsx`, `foto.tsx` — design consistente
- `[id].tsx` — adicionar fallback SQLite para vistorias offline
- `laudo.tsx` — sem mudanças funcionais, apenas visual

**Must-haves:**
- Todas as telas auth + agente usando componentes do design system
- `inspecoes/[id].tsx` funciona offline (fallback SQLite implementado)
- Wizard com feedback visual em cada ação

**Plans:** 9/14 plans executed

Plans:
- [x] 03-01-PLAN.md — onboarding.tsx: swipe habilitado + hierarquia visual + Button
- [x] 03-02-PLAN.md — (auth)/index.tsx: ícone shield + título Defesa Civil + Button
- [x] 03-03-PLAN.md — login.tsx: banner de erro + email.trim() + Button
- [x] 03-04-PLAN.md — register.tsx: formatação token XXXX-XXXX-XXXX + select restrito + força de senha
- [x] 03-05-PLAN.md — forgot-password.tsx: layout consistente + estado de sucesso + Button
- [x] 03-06-PLAN.md — dashboard.tsx: useMemo data/hora + Card KPIs + ErrorState
- [x] 03-07-PLAN.md — perfil.tsx: count:exact queries + Badge role + Ver Introdução + ErrorState
- [x] 03-08-PLAN.md — inspecoes/index.tsx: EmptyState + LoadingState + ErrorState + Card
- [ ] 03-09-PLAN.md — wizard.tsx: stepRef fix (BUG-M9) + foto_url (BUG-A6) + fade + feedback
- [ ] 03-10-PLAN.md — [id].tsx: fallback SQLite (BUG-C4) + badge offline + ErrorState
- [x] 03-11-PLAN.md — dados-iniciais.tsx: validação CEP (BUG-UX-05) + máscara XXXXX-XXX
- [ ] 03-12-PLAN.md — selecao-formulario.tsx: Card + Badge tipo + 3 estados async
- [ ] 03-13-PLAN.md — risco.tsx + resultado.tsx + foto.tsx: header consistente + Button + EmptyState
- [ ] 03-14-PLAN.md — laudo.tsx: header consistente + Button + LoadingState (sem mudança funcional)

---

## Phase 4: UI Redesign — Admin + Supervisor + Master
**Goal:** Aplicar o design system nas telas administrativas, com estados de erro/vazio implementados em todas as telas que hoje falham silenciosamente.

**Scope:**

**Admin (10 telas):**
- `admin/index.tsx` — ErrorState quando KPIs falham, layout menos denso
- `usuarios.tsx`, `tokens.tsx`, `gerar-token.tsx` — consistência visual
- `estatisticas.tsx` — melhorar visualização de dados (barras, distribuição risco)
- `relatorios.tsx` — otimizar `select('*')` para campos necessários apenas
- `form-editor.tsx`, `editor-perguntas.tsx` — sem mudanças funcionais, visual
- `risco-config.tsx` — adicionar TTL de 24h ao cache AsyncStorage
- `logs.tsx` — exportação básica de logs (CSV)

**Supervisor (4 telas):**
- `supervisor/index.tsx` — ErrorState quando lista falha
- `equipe.tsx`, `agente.tsx` — hierarquia visual melhorada
- `atribuicao.tsx` — notificação push ao agente ao criar atribuição

**Master (3 telas):**
- `master/index.tsx` — design consistente
- `municipios.tsx` — substituir query sem LIMIT por RPC com GROUP BY
- `master/logs.tsx` — consistência com admin/logs

**Must-haves:**
- Zero telas com falha silenciosa (todas têm ErrorState)
- `municipios.tsx` sem query sem LIMIT
- Notificação push ao criar atribuição no supervisor
- TTL de 24h no cache de risco-config

**Plans:** 4 plans

Plans:
- [ ] 04-01-PLAN.md — Dashboards ErrorStates em Admin, Supervisor e Master
- [ ] 04-02-PLAN.md — Funcionalidades Pendentes (Push, TTL Risco Config, CSV)
- [ ] 04-03-PLAN.md — Otimização Master Municipios e Hierarquia Visual de Admin (Tokens, Usuarios, Estatísticas)
- [ ] 04-04-PLAN.md — Hierarquia Visual Supervisor (Equipe, Agente) e Editores (Admin)

---

## Phase 5: Segurança + Dívida Técnica
**Goal:** Corrigir vulnerabilidades de segurança identificadas e eliminar duplicação de código com extração para utils compartilhados.

**Scope:**

**Segurança:**
- Migrar JWT de `AsyncStorage` para `expo-secure-store`
- Restringir campos retornados em `register.tsx` (select específico em vez de `select('*')`)
- Substituir `console.log` por `logger.warn` em `NotificationService.ts`
- Mover rate-limit de token para Supabase (RPC ou trigger)
- Adicionar filtros de município/agenteUid em `inspecoes/[id].tsx`

**Dívida Técnica:**
- Criar `utils/riscoUtils.ts` — consolidar `riscoLabel()`, `riscoColor()` dos 6+ arquivos
- Criar `utils/htmlUtils.ts` — consolidar `escapeHtml()`, `tempoRelativo()`, `formatarData()`
- Criar `utils/laudoPdfBuilder.ts` — unificar os 3 geradores de HTML para PDF
- Criar `types/vistoria.ts` — interfaces TypeScript compartilhadas (eliminar `any[]`)
- Corrigir botão "Compartilhar" em `resultado.tsx` (implementar flow separado de share)
- Limitar `VACUUM` SQLite a 1x/dia com timestamp
- Corrigir foto do wizard para persistir no SQLite

**Must-haves:**
- JWT em `expo-secure-store` (não AsyncStorage)
- Zero funções `riscoLabel/riscoColor/escapeHtml` duplicadas
- Um único gerador de PDF compartilhado
- Botão "Compartilhar" com comportamento distinto do "Baixar PDF"
- `VACUUM` com limite de frequência
