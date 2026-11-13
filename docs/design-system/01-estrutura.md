# TCS Design System · Documento 01 — Estrutura

**Data:** 18/10/2026 · **Status:** planejamento aprovado para execução
**Identidade:** Graphite Esmeralda V1 (dark-first) · mascote Coruja Sentinela · logo escudo hexagonal
**Escopo:** estrutura completa do design system a ser construído em novo arquivo `.pen` (pen.dev), cobrindo Console web, Portal do cliente, app Expo e páginas públicas. Referências visuais: canvas `untitled.pen` (14 telas-modelo V1) e projeto Penpot "TCS — Web Dashboard" (34 páginas).
**Fonte de verdade de tokens:** `dashboard/src/index.css` (web) · `constants/Colors.ts` + `constants/Spacing.ts` (mobile) · `dashboard/design/route-manifest.mjs` (governança)

---

## 0. Princípios estruturais

1. **Token é contrato, hex é detalhe.** Componentes consomem apenas tokens semânticos; cores literais são proibidas e vigiadas por regex no CI (`validate-design-governance.mjs`). O hex concreto vive numa única camada (`index.css` / `Colors.ts`), remapeável por tema.
2. **Uma taxonomia, quatro vozes.** Console (Graphite dark), Portal (Ceramic light), Mobile (Graphite + banner offline âmbar) e Públicas (documento sobre glow radial) compartilham os mesmos nomes de tokens e componentes; mudam tipografia de título, elevação e densidade — nunca a semântica.
3. **O `.pen` espelha o código.** Nome de nó = nome do componente React (PascalCase); variante = valor do cva variant; variável `$` = custom property CSS. Paridade é validável por script, não por boa vontade.
4. **Estados são cidadãos de primeira classe.** Toda tela nasce com `loading, empty, error, retry, success, permission-denied` (+ estados de assinatura no Portal). Sem exceção, sem "depois".
5. **Governança executável.** Toda regra deste documento que puder virar validador (`npm run design:validate`) deve virar. O que não se valida, degrada.

---

## 1. Taxonomia de tokens

### 1.0 Modelo em 3 camadas

| Camada | Conteúdo | Onde vive | Consumo |
|---|---|---|---|
| **Primitivas** | Escalas brutas nomeadas (graphite-*, emerald-*, amber-*, red-*, blue-*) | `index.css` (comentários) / swatches do `.pen` | **Ninguém** — só alimentam semânticas |
| **Semânticas** | Papel na interface: `--background`, `--card`, `--success`, `--risk-r3`… | `index.css` por tema; `Colors.ts` (hex mobile); variáveis `$` do `.pen` | Componentes, via utilitários Tailwind |
| **Componentes** | Aplicação concreta: gradiente do botão, soft-tinted `risk-r3/14`, glow da nav ativa | cva/classes de cada componente | Somente dentro do componente |

**Primitivas Graphite Esmeralda (base V1):**

| Nome | Hex | Uso |
|---|---|---|
| graphite-950 | `#09090B` | bg dark (Console/Mobile) |
| graphite-900 | `#111114` | card dark |
| graphite-850 | `#16161A` | muted dark |
| graphite-800 | `~#222225` (HSL 240 4% 14%) | border dark (≈ `rgba(255,255,255,.07)` sobre 950) |
| emerald-600 | `#059669` | success light / ring claro |
| emerald-500 · **brand** | `#10B981` | accent oficial V1 (glow `#10B98155`) |
| emerald-400 | HSL 142 71% 45% | success dark / ring escuro |
| amber-500 / amber-600 | `#F59E0B` / `#8A5500` | warning dark / light (AA sobre claro) |
| red-500 / red-600 | `#EF4444` / `#C0291D` | destructive dark / light |
| blue-600 | `#1F6BB5` | info light (dark: HSL 210 60% 55%) |

### 1.1 Cor — tokens semânticos (os vigentes, por tema)

Fonte: `dashboard/src/index.css`. 6 temas remapeiam os mesmos papéis: **light** (Graphite branco, padrão), **dark** (Graphite Esmeralda — identidade oficial), **orca**, **dracula**, **nord**, **gruvbox**.

| Token (papel) | Light | Dark Graphite | Notas |
|---|---|---|---|
| `--background` | 240 6% 97% · #F6F6F7 | 240 11% 4% · **#09090B** | Página |
| `--foreground` | 240 6% 9% · #111113 | 0 0% 98% · #FAFAFA | Texto principal |
| `--card` / `--card-foreground` | #FFFFFF / #111113 | **#111114** / #FAFAFA | Superfície de conteúdo |
| `--popover` | #FFFFFF | #111114 | Menus, paleta |
| `--primary` / `-foreground` / `-hover` | #171717 / #FFF / 0 0% 24% | #FAFAFA / 0 0% 9% / 0 0% 88% | Ação neutra (monocromática) |
| `--secondary` | 240 5% 96% | 240 4% 9% | Hover de ghost, chips |
| `--muted` / `--muted-foreground` | #F4F4F5 / #5F5F64 | #16161A / 240 5% 60% | Texto de apoio |
| `--accent` / `--accent-foreground` | 152 81% 95% / 161 94% 22% | 152 60% 12% / 142 71% 78% | Fundo de linha ativa (esmeralda soft) |
| `--border` / `--input` | 240 5% 90% · #E4E4E7 | 240 4% 14% · ≈ #222225 | Hairline dark ≈ rgba(255,255,255,.07) |
| `--ring` | 161 94% 30% · #059669 | 142 71% 45% | Foco esmeralda |
| `--success` / `-soft` / `-foreground` | 161 94% 30% · #059669 | 142 71% 45% / 142 40% 14% | Status positivo |
| `--warning` / `-soft` / `-foreground` | 38 90% 34% · #8A5500 | 38 80% 55% / 38 55% 14% | AA determinístico em ambos os modos |
| `--destructive` / `-soft` / `-foreground` | 0 72% 42% · #C0291D | 0 72% 56% / 0 55% 14% | Erro/exclusão |
| `--info` / `-soft` / `-foreground` | 210 70% 42% · #1F6BB5 | 210 60% 55% / 210 45% 13% | Informativo |
| `--risk-r1..r4` | 145 55% 36% · 46 88% 42% · 25 85% 50% · 2 68% 47% | idem (constantes) | **Semântica crítica de risco** — não muda por tema |
| `--glass-bg` / `--glass-border` | branco 85% / 30% | 240 5% 7% / 0.92 / branco 10% | `.glass` blur 16px; fallback `prefers-reduced-transparency` |
| `--sidebar-*` (8 tokens) | ver index.css | ver index.css | Rail: bg, primary, accent, border, ring… |

**Token novo a criar (lacuna da identidade V1):**

| Token | Valor | Uso |
|---|---|---|
| `--brand` / `--brand-glow` | `#10B981` / `#10B98155` | Accent de marca: eyebrow, indicador nav ativo, glow de CTAs. Distinto de `--success` (status) para liberar o esmeralda puro como cor de identidade sem colidir com semântica de estado. |

**Temas estendidos (orca/dracula/nord/gruvbox):** remapeiam as mesmas semânticas (ex.: orca bg `#0F1411`, primary `#22C55E`). No `.pen` viram **matriz de remapeamento** (frame de documentação), não telas redesenhadas.

### 1.2 Tipografia — escala por superfície

| Superfície | Títulos | Corpo | Dados/IDs/SLAs |
|---|---|---|---|
| **Console** | Space Grotesk (600/700) | Inter (400–800) | IBM Plex Mono (400/500) |
| **Portal** | Hanken Grotesk (600/700) | Inter | IBM Plex Mono |
| **Mobile Expo** | Inter (700/800) | Inter | mono do SO / IBM Plex Mono |
| **Públicas** | Space Grotesk | Inter | — |

**Escala única (compartilhada):**

| Papel | Tamanho/linha | Fonte | Regras |
|---|---|---|---|
| Display | 40/1.2 · bold | Grotesk | Hero públicas |
| Título H1 | 32 → PageHeader 2xl–2rem/1.15, tracking −0.03em | Grotesk/Hanken | 1 por tela |
| Título H2/H3 | 24/1.4 · 20 | Grotesk/Hanken | Seções |
| Corpo | 15/1.5 · 14 | Inter | Padrão console 15 |
| Small/Caption | 13 · 12 | Inter | Densos, tabelas |
| Label/Eyebrow | 11 uppercase, tracking 0.10–0.14em, 700 | Inter | Esmeralda (`text-success`) no eyebrow; mono no breadcrumb técnico |
| Mono/Dados | 12 · 11 | Plex Mono | IDs, SLAs, timestamps, logs, `tabular-nums` **sempre** + `toLocaleString('pt-BR')` / `Intl` |

**Instalação pendente:** `@fontsource/space-grotesk`, `@fontsource/hanken-grotesk`, `@fontsource/ibm-plex-mono` (hoje só existe `@fontsource/inter`; `tailwind.config.js` tem `fontFamily.display = Inter`). Extensão proposta: `font-display` (Grotesk), `font-portal` (Hanken), `font-mono` (Plex Mono). Regra do projeto: perguntar antes de instalar pacotes.

### 1.3 Espaço — grid 4pt

| Escala | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|
| px | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64 |

- Idêntica no mobile (`constants/Spacing.ts` define `Spacing` + aliases `cardPadding`, `screenPadding`, `gap*`).
- **Layout web:** page-stack `space-y-4`; card `p-5` (20); AppHeader 72px; sidebar Console 232px (recolhida 88px); sidebar Portal 272px; main `max-w-[1440px]`; container 2xl 1400px.
- **Touch mobile:** alvo mínimo 44 (iOS) / 48 (Android) — `TouchTarget` do Spacing.ts; botões portal ≥ 44px sob 1024px (regra já vigente em `.portal-shell`).

### 1.4 Raio

| Token | Web | Mobile | Uso |
|---|---|---|---|
| sm | 8 | 6 | Chips, células densas |
| md | 12 | 12 | Inputs, botões sm, tiles |
| lg | 16 | 16 | Botões default, cards internos |
| **xl (base)** | **20 = `--radius: 1.25rem`** | — | **Cards padrão** |
| 2xl | 24 | 24 | Modais, app icon |
| full | 999 | 999 | Pills, avatares, badges dot |

### 1.5 Sombra / elevação / glow

Dark-first: **borda + glow substituem sombra**. Light (Ceramic): sombra difusa em controles elevados e wells rebaixados (inset).

| Nível | Especificação | Onde |
|---|---|---|
| E0 | Superfície plana + hairline `--border` | Cards estáticos |
| E1 | `0 6px 20px hsl(fg/6%)` + `translateY(-1px)` (hover card 220ms) | Hover de card (assinatura 2.0) |
| E2 | `0 8px 32px` → hover `0 12px 40px -8px` + blur 12 | `.gloss-card` |
| Glass | `--glass-bg` α .92 + blur 16 + `--glass-border` | Sidebar, header sticky, sheets |
| **Glow brand** | `0 0 12px hsl(success/55%)` · botões `shadow-primary/20` · glow radial nas públicas | Nav ativa, CTA primário, empty states |
| Ceramic (Portal) | Sombra difusa elevando controles; wells inset para wells/inputs | Portal claro |

### 1.6 Motion

| Token | Valor | Uso |
|---|---|---|
| `--motion-ease-out` | cubic-bezier(0.16, 1, 0.3, 1) | Entradas, hover, feedback |
| `--motion-ease-in-out` | cubic-bezier(0.65, 0, 0.35, 1) | Transições de estado |
| `--motion-ease-drawer` | cubic-bezier(0.32, 0.72, 0, 1) | Drawers interrompíveis |

| Duração | Valor | Aplicação |
|---|---|---|
| fast | **150ms** | Botões, tabs, hover, foco |
| normal | **200ms** | Dialog, sheet, mudança de etapa, accordion |
| route | **280ms** | `view-fade` entre rotas (fade + 6px up) |
| drawer | 200ms entra / **150ms** sai | Sheets/vaul |
| card-hover | 220ms hoje → **normalizar 200ms** | Elevação de card |

**Reduce:** `prefers-reduced-motion` → 0.01ms (kill global) + `motion-reduce:animate-none` por componente; spinners param, shimmer para de pulsar, transições espaciais somem — mas estado/feedback textual permanece. `prefers-reduced-transparency` → `.glass` vira `--card` sólido sem blur.

### 1.7 Z-index (escada a codificar como `--z-*`)

| Token | Valor | Evidência atual no código |
|---|---|---|
| `--z-surface-control` | 10 | Botão de colapsar sidebar |
| `--z-sticky` | 30 | AppHeader sticky (Console e Portal) |
| `--z-bottom-nav` | 40 | Tab bar mobile do Portal |
| `--z-overlay` | 50 | Radix (dropdown/popover/tooltip/dialog), sheet sidebar mobile, overlay Portal |
| `--z-toast` | 60 | Sonner (padrão alto) |
| `--z-skip-link` | 100 | Link "Pular para o conteúdo" |

### 1.8 Densidade

| Modo | Padding do main | Persistência |
|---|---|---|
| `comfortable` (padrão) | `p-4 sm:p-8 lg:p-12` (boards densos: `p-4 sm:p-8`) | `localStorage tcs.console.density` + `data-density` no shell |
| `compact` | `p-3 sm:p-5 lg:p-8` | idem |

Mobile não tem densidade (touch fixo). O `.pen` documenta os dois modos num frame comparativo.

### 1.9 Lacunas de tokens encontradas na auditoria

1. **Vars referenciadas e indefinidas** (tailwind.config.js aponta para tokens que não existem em `index.css`): `--shadow-card`, `--shadow-preview`, `--chart-1..5`, `--danger-soft`, `--success-soft-foreground`, `--warning-soft-foreground`, `--info-soft-foreground`, `--info-strong`, `--warm*`, `--ink*`, `--commercial-section`. Ação: definir as que forem usadas (chart em Chart.tsx), remover o resto.
2. **Aliases deprecated sem prazo:** `danger-*`, `warm.*`, `ink.*`, `commercial.section`, `status.*`, `chart.*`. Ação: ratchet no validador até zero; remoção na v2.0.
3. **`--brand` (#10B981) inexistente** como token (item 1.1).
4. **Paridade mobile×web quebrada:** mobile dark usa `#171717`/`#1F1F1F` (não Graphite `#09090B`/`#111114`); success mobile `#22C55E` ≠ web. Ação: migração do app para Graphite V1 + validador de paridade.
5. **Fontes de identidade não instaladas** (Space Grotesk, Hanken Grotesk, IBM Plex Mono).

---

## 2. Taxonomia de componentes — 4 camadas

Convenção: cada componente traz **props essenciais**, **estados** (loading/empty/error/retry/success/denied quando aplicáveis) e **lacuna vs o que existe hoje no repo**.

### 2.1 Camada 1 — Primitivos (`dashboard/src/components/ui/`, base shadcn/Radix)

| Componente | Props essenciais | Estados | Lacuna vs 2.0 |
|---|---|---|---|
| **Button** | `variant` default/destructive/outline/secondary/ghost/info/link · `size` default/sm/lg/icon · `asChild` | hover, focus-ring, active `scale-0.97`, disabled 50% | `loading` (spinner+label), variante `success`, glow esmeralda no primário, sizes 44px mobile |
| **Input / Textarea** | `value`, `placeholder`, `disabled`, `readOnly` | focus ring esmeralda, disabled, inválido | Estado de erro inline (aria-invalid + mensagem) |
| **Label / FormField** | `htmlFor`, controle de formulário | — | — |
| **Select** (Radix) | `value`, itens, placeholder | open/hover/focus/disabled | Variante mono (dados técnicos) |
| **Checkbox / Switch** | `checked`, `onCheckedChange` | checked/indeterminate/focus | — |
| **RadioGroup** | — | — | **Não existe** — criar (formulários de risco, filtros) |
| **Badge** | `variant` default/secondary/destructive/outline/success/warning/info | — | Variante `soft` com dot (2.0: "badges soft-tinted com dot") |
| **Card** | `Card/Header/Title/Description/Content` (data-slot) | hover E1 | Variante `dashed` (empty), `soft-*` |
| **Avatar** | — | — | **Não existe** — criar (gradiente por hash do nome, tabela premium) |
| **Table** | `Table/Header/Row/Head/Cell` | header `bg-muted/40`, hover `muted/40` | Sticky header, row selection |
| **Skeleton** | `className` | shimmer | **Shimmer animado** (hoje estático) |
| **Tabs** | `TabsList/Trigger/Content` | active (teclado ✓ testado) | Trigger pill com glow ativo |
| **Tooltip** | `TooltipTrigger/Content`, `delayDuration` | — | — |
| **Dialog / AlertDialog / Sheet / Drawer** | Radix + vaul | open/close 200ms, drawer interrompível | — |
| **DropdownMenu / Popover** | Radix | — | — |
| **Command** (cmdk) | grupos, itens | — | Base da CommandPalette ✓ |
| **Sonner (toast)** | `toast.success/error/warning` | auto-dismiss | Token de duração por severidade (crítico 10s) |
| **Alert** | `variant` + `AlertTitle/Description` | info/success/warning/destructive | — |
| **Progress** | `value` | indeterminado | — |
| **Pagination** | `PaginationControls` | disabled nas extremidades | — |
| **Chart** (recharts) | container theming | — | Gradiente + glow nos pontos; tokens `--chart-1..5` indefinidos |
| **Breadcrumb / Separator / Kbd** | — | — | Kbd não existe como componente (hoje é markup inline no AppHeader) |
| **HighRiskDialog** | ação de alto risco | — | ✓ existe; manter como primitivo de segurança |

**Estados universais da camada 1:** `default · hover · focus-visible (ring) · active · disabled` (+ `loading` em ações).

### 2.2 Camada 2 — Compostos (domain/, states/, data/, layout/, inbox/)

| Componente | Props essenciais | Estados | Lacuna vs 2.0 |
|---|---|---|---|
| **PageHeader** (domain) | `eyebrow`, `title`, `description`, `actions` | — | ✓ 2.0 (eyebrow esmeralda + linha). Adicionar slot breadcrumb mono |
| **MetricCard** (domain 1.0) | `label`, `value`, `icon`, `trend`, `hint` | — | **Evoluir para MetricTile 2.0 (KPI Tremor):** label 12 · valor 28 bold · delta pill ↑↓→ com `-soft` · nota "vs semana anterior" · **sparkline SVG 20px com gradiente** (tudo lacuna) |
| **Badges domain** | `StatusBadge(value)`, `RiskBadge(risk R1-R4)`, `EnvironmentBadge`, `RoleBadge`, `AccountPermissionBadge`, `CustomerKindBadge` | mapeamento automático de severidade | Migrar para o padrão soft+dot 2.0 |
| **DataTableToolbar / ColumnHeader / ViewOptions / Pagination** (data/) | `query`, `filters`, `activeFilterCount`, `onClear`; sort asc/desc | — | **Bulk action bar** (flutuante, contagem + ações), avatares gradiente, **integração @tanstack/react-table** (instalado, não adotado), sticky header, seleção de linhas |
| **AsyncBoundary** (states/) | `loading`, `error`, `empty`, `onRetry`, `timeoutMs=15s` | loading → **timeout/retry** → error → empty → success (children) | **DeniedState** (permission-denied não tem componente), shimmer no loading, empty com glow + CTA, erro com "log anexado" |
| **AsyncLoading/AsyncError/AsyncEmpty** | `rows`, `label`; `error`; `title/description/action` | — | Ver acima |
| **CommandPalette** (layout/) | `open`, grupos Páginas/Clientes/Ações, troca de tema | open/close, empty ("nenhum resultado") | Atalhos por papel; preview de entidade |
| **ConsoleShell** | outlet + sidebar + header + paleta; `data-density` | — | ✓ 2.0 |
| **AppSidebar** | `collapsed`, grupos por permissão, busca no menu | ativo com glow (`nav-active-indicator`) | Rail fino 2.0 (88px com tooltip) já existe ✓ |
| **AppHeader** | contexto da rota (eyebrow+título), busca global, tema, densidade, InboxBell, ações contextuais por formulário | — | Breadcrumb mono técnico (2.0) |
| **PortalShell** | sidebar glass 272px, bottom nav 5 módulos, banner de restrição de criação | trial/active/grace/past-due/canceled → `Badge` de assinatura | — |
| **InboxBell** (inbox/) | `workspace` internal/individual/organization | loading/error/empty/realtime; severity dot (critical/error/warning/success); toast de chegada | — |
| **CustomerContextBar** (domain) | cliente ativo, troca de contexto | — | — |
| **WhatsAppPairingDialog, ComunicadoComposerFields, BotServiceStatus** | fluxos de bot/comunicação | pairing, sending | — |
| **PortalOnboardingChecklist, PortalMap, TurnstileChallenge, ThemePickerModal, GuidedTutorial, CookieConsent, HighAssuranceDialog, GlobalCustomerSearch** | utilitários de produto | ver testes próprios | — |
| **MobileFrameSimulator** (dev) | moldura 393×852 | — | **Dívida:** usa cores `slate-*` literais → migrar para tokens |

### 2.3 Camada 3 — Patterns (composições nomeadas)

Cada pattern = receita fixa de compostos + primitivos, documentada como frame de exemplo no `.pen` (containers com slot onde houver repetição estrutural).

| Pattern | Anatomia | Componentes | Telas-referência (14 do canvas) |
|---|---|---|---|
| **Lista com bulk** | Toolbar + tabela premium + **bulk bar flutuante** (n selecionados + ações) + paginação | DataTable*, Badge soft, Avatar | Clientes |
| **Fila de decisões** (Linear-style) | ícone tile 34px accentSoft + título 13/600 + descrição 12 muted + badge pill com dot + timestamp mono | DecisionRow (novo), StatusBadge | Dashboard "Atenção agora" com SLA mono |
| **Pipeline de assinaturas** | colunas trial → ativa → grace → past due + comprovantes PIX | PipelineChip (novo), Card, Badge | Assinaturas |
| **Inbox 3 zonas** | lista \| thread \| contexto (painel de ficha) | ListRow, InboxItem, Card | WhatsApp |
| **Dossiê do cliente** | contexto persistente + gauge R3 + fotos `IMG_00xx` + QE + instrumentos + filtros compartilhados | GaugeRisk (novo), Tabs, Table | Cliente Detalhe |
| **Bento grid dashboard** | KPI row (4 tiles) + área chart com gradiente/glow + bar list animada + donut + ranking p50/p95 | MetricTile, Chart | Dashboard, Analytics (hero 1.284, QE donut 78%) |
| **Fatura-documento** | documento como peça central + stepper 4 estados + upload com hash | Stepper (novo), Card, mono | Cobrança Portal |
| **Mapa full-bleed** | mapa OSM/MapLibre cobre a tela + painel flutuante + pins R1-R4 | PortalMap, Badge risco | Mapa Portal |
| **Editor 3 painéis** | árvore/estrutura \| canvas \| propriedades + templates globais + chips R1-R4 | Tabs, FormField, Chip | Formulários |
| **Timeline de auditoria** | filtros + sequência cronológica mono densa + `sensitive.access` em âmbar + detalhe sanitizado | Table mono, Badge | Auditoria |
| **Empty state com glow** | ícone com glow radial + título + descrição + CTA único | AsyncEmpty 2.0 | Todos os empty |
| **Banners de contexto** | faixa full-width: offline âmbar (mobile), cobrança (portal), criação bloqueada | BannerBar (novo) | Dashboard mobile, PortalShell |
| **Auth editorial** | composição editorial + Turnstile + erro/carregamento/retorno | TurnstileChallenge, FormField | Login (coruja) |
| **Ciência de documento** | código 6 dígitos + hash + base legal (MP 2.200-2/2001) + ação única | mono, Card | Pública |

### 2.4 Camada 4 — Templates (os 10 do route-manifest)

Estruturas canônicas (fonte: `penpot-handoff.mjs` + `routeTemplates`). Toda rota do `route-manifest.mjs` declara `template` + `states` (mínimo: loading, empty, error, retry, success, permission-denied; Portal adiciona: plan-locked, trial, active, grace, past-due, cancel-at-period-end, canceled, expired).

| Template | Estrutura | Rota representativa | Breakpoints |
|---|---|---|---|
| `public-page` | layout público · hero · prova de valor · CTA · rodapé | `commercial-public` / | 1440/1024/768/390 |
| `authentication` | composição editorial · formulário · erro · carregamento · retorno autenticado | `login`, `portal-login` | 4 |
| `dashboard` | cabeçalho · contexto ou release · métricas · atenção · atalhos | `dashboard-owner`, `portal-individual` | 4 |
| `listing` | cabeçalho · métricas · toolbar · tabela ou lista · paginação | `customers`, `subscriptions` | 4 |
| `context-detail` | contexto persistente · filtros compartilhados · módulos ou abas · ações auditáveis | `customer-detail`, `portal-municipal-equipe-member` | 4 |
| `timeline` | filtros · sequência cronológica · detalhe sanitizado · estado vazio | `audit` | 4 |
| `editor` | versão atual · edição · pré-visualização · validação · publicação e rollback | `plans`, `forms` | 4 |
| `settings` | grupos · origem do valor · alteração pendente · publicação segura | `configuration`, `portal-*-assinatura` | 4 |
| `technical-operation` | resumo de saúde · filtros específicos · eventos ou fila · ações operacionais | `sync`, `builds` | 4 |
| `design-reference` | catálogo vivo: foundations · motion · componentes · patterns · estados | `ui-reference` (StyleGuidePage) | 4 |

### 2.5 Matriz de estados universal

| Estado | Componente dono | Regra |
|---|---|---|
| loading | AsyncLoading (skeleton + spinner, `aria-busy`) | >15s vira timeout |
| retry | AsyncTimeout / AsyncError com botão | inclui "ver log" quando houver |
| error | AsyncError (Alert destructive + mensagem do erro) | nunca tela branca |
| empty | AsyncEmpty (borda dashed, ícone, CTA opcional) | 2.0: glow + CTA único |
| success | sonner toast + confirmação inline | feedback ≤6s (crítico 10s) |
| permission-denied | **DeniedState (a criar)** | redirect suave no Portal; bloqueio explícito no Console |
| plan-locked / billing (Portal) | BannerBar + Badge de assinatura + CTA para checkout | guard do PortalRoute |

**Cobertura de baselines existente:** 33 casos de rota × 97 de estado = **508 baselines** de screenshot (4 breakpoints) — `portalVisualCoverage` no manifest.

---

## 3. Estrutura do arquivo `.pen`

Arquivo novo (proposto: **`TCS Design System.pen`**), no pen.dev. O `untitled.pen` (14 boards V1) permanece como referência visual congelada; o Penpot "TCS — Web Dashboard" vira arquivo histórico.

### 3.1 Ordem das seções (cada uma = frame de seção no nível raiz do documento)

| # | Seção | Conteúdo | Definition of done |
|---|---|---|---|
| 00 | **Capa** | Nome "Graphite Esmeralda", versão semver, data, escudo hexagonal + coruja, índice das seções, changelog resumido | Capa lê sozinha o escopo do DS |
| 01 | **Fundamentos** | (a) primitivas Graphite; (b) semânticas dark Graphite com hex; (c) remapeamento Ceramic light (Portal); (d) matriz dos 4 temas estendidos; (e) risco R1–R4; (f) espécimes tipográficos por superfície; (g) escala 4pt; (h) raio; (i) elevação/glow; (j) curvas de motion desenhadas + durações; (k) escada z-index; (l) comparativo confortável×compacto | Cada token da seção 1 tem swatch/specimen com nome do token |
| 02 | **Marca** | Escudo hexagonal (SVG **gerado**, nunca desenhado à mão), app icon gradiente `#047857→#10B981` raio 24, lockup sidebar 32px, paleta da Coruja (plumagem zinco-escura + esmeralda + capacete amarelo), usos previstos (empty states com glow, onboarding Portal, assinatura do bot, header Console), anti-usos | Um frame por caso de uso + 1 de anti-uso |
| 03 | **Ícones** | Grid dos 155 lucide mapeados (24px), destaque dos 12 módulos, tabela de renames (`funnel→filter`, `house→home`…), regra `aria-hidden` | Grid completo com nomes kebab-case lucide |
| 04 | **Componentes** | Camadas 1 e 2: cada componente `reusable:true` com variantes + frames de estado + slots | Todo componente das seções 2.1/2.2 representado |
| 05 | **Patterns** | Os 14 patterns da seção 2.3 como frames de exemplo compostos por instâncias dos componentes | Cada pattern com anotação de anatomia |
| 06 | **Templates** | Os 10 TPL como frames 1440×900 (`clip:true`) com anotações da estrutura + coluna de estados (sub-frames 390 onde aplicável) + badge da rota representativa | 10/10 com estrutura do manifest |
| 07 | **Mobile** | Frames 390×852: tokens mobile, Dashboard vistoriador (banner offline âmbar), Vistoria wizard (fotos, GPS 4m, sync pendente), Laudo (badge R3, assinatura, PDF/WhatsApp) + estados | Espelhar Spacing/TouchTarget/ComponentSize |
| 08 | **Governança** | Pipeline `design:validate`, matriz de estados, semver, checklist de nova tela, mapa .pen↔código, version history | Check-list executável impressa no canvas |

**Layout do canvas:** componentes no topo de cada seção, telas/exemplos abaixo, crescendo para a direita e para baixo; raiz do documento só com frames de seção (nunca nós soltos); frames de tela com `clip: true`.

### 3.2 O que vira componente reutilizável (`reusable: true`) × frame de exemplo

**Critério:** vira `reusable:true` se (a) repete ≥3× na composição de telas **e** (b) mapeia a um componente React exportado. Telas, swatches, specimens e anotações são sempre frames de exemplo.

**Reutilizáveis — Camada 1 (família `Componente/Variante`):**
`Button/Primary · /Destructive · /Outline · /Secondary · /Ghost · /Info · /Link` (tamanhos = overrides de instância, documentados no catálogo) · `Input · Input/Disabled · Textarea · Label · Select/Trigger · Checkbox · Switch · RadioItem` · `Badge/Neutral · /Info · /Success · /Warning · /Destructive · /Outline · /SoftDot` · `Card · CardHeader · Avatar · AvatarStack · Skeleton · Kbd · Chip/Filtro (com contagem + removable) · Separator · Progress · Pagination/Controls · Alert/Info · /Warning · /Destructive · /Success · Toast/Error · /Success · Tooltip/Bubble · Dropdown/Item · Command/Item · Command/GroupLabel · Table/HeaderCell · Table/Row · Tabs/Trigger · Breadcrumb/Crumb · Dialog/Frame · Sheet/Frame`

**Reutilizáveis — Camada 2:**
`PageHeader` (slots: eyebrow, title, description, actions) · `MetricTile` (slots: label, value, delta, note, sparkline) · `DecisionRow` · `StatusBadge · RiskBadge · RoleBadge · EnvBadge · PlanBadge` · `DataTableToolbar · ColumnHeader (asc/desc/none) · ViewOptions · BulkBar · ContextBar · SidebarItem/Default · /Active (glow indicator) · /Collapsed · NavSectionTitle · SidebarBrand` · `InboxItem · InboxBadge · BannerBar/Warning · /Offline · /PlanLock · Banner/Plan` · `PipelineChip (trial/active/grace/past-due/canceled) · Stepper/Step (done/current/pending) · GaugeRisk (R1–R4) · Sparkline · BarListRow · Kbd` · `StateFrame/Loading · /Empty · /Error · /Retry · /Denied` · **Mobile:** `ModuleCard · ListRow · FlowProgress · StateBanner · MobileTab/Item · ConfirmSheet · OptionSheet`

**Containers reutilizáveis com slot (Camada 3):** `KpiRow` (slot: MetricTile×n) · `DecisionFeed` (slot: DecisionRow×n) — os demais patterns ficam como frames de exemplo (a repetição estrutural neles é de baixa frequência).

**Frames de exemplo (nunca reusable):** capa · swatches/specimens de fundamentos · marca/mascote · grid de ícones · os 14 patterns · os 10 templates · telas das 14 composições V1 · telas mobile · quadros de governança.

### 3.3 Convenções de composição do `.pen`

- **Slots:** frames internos com `slot: [ids recomendados]` (ex.: `PageHeader → actions`, `Card → header/content/actions`, `MetricTile → sparkline`). Slot não usado na instância = `enabled: false`.
- **Variantes:** componente-mãe + filhos nomeados `Componente/Variante` — instância já nasce com a variante certa (mais simples que override de propriedades).
- **Ícones:** nós `icon` com `library: "lucide"`, nomes kebab-case idênticos ao `lucide-react`, `aria-hidden` emulável por anotação.
- **Mascote/escudo:** via `Generate` com `type: "svg"` — nunca desenhar com paths à mão (regra pen.dev e do projeto).
- **Números/dados:** fontes mono com `tabular-nums` representado por Plex Mono; conteúdo de exemplo em pt-BR real (nomes, SLAs, hashes `IMG_00xx`).

### 3.4 Temas no `.pen`

O `.pen` é **dark-first Graphite**: as variáveis carregam os valores do tema dark (identidade oficial). O **Ceramic light** (Portal) ganha um frame de remapeamento completo na seção 01 (mesmos nomes de token, valores claros + regras de elevação difusa/wells). Os 4 temas estendidos (orca, dracula, nord, gruvbox) viram matriz de remapeamento — são fenômeno de código (`data-theme`), não de design.

---

## 4. Mapeamento `.pen` ↔ código

### 4.1 Convenção de nomes

| Objeto no `.pen` | Nome | Espelho no código |
|---|---|---|
| Componente reutilizável | `Button`, `PageHeader`, `MetricTile` (PascalCase) | Componente React exportado (idêntico) |
| Variante | `Button/Destructive` | `<Button variant="destructive">` (valor do cva) |
| Estado | frame de exemplo `Button · loading` | prop/estado do componente |
| Slot | frame interno `actions` | prop `actions?: ReactNode` / `children` |
| Nó `icon` | `lucide: "layout-dashboard"` | `<LayoutDashboard aria-hidden />` |
| Nó texto | content = label real pt-BR | prop de texto/children |
| Instância em tela | nome = componente-mãe | uso do componente na página |
| Variável `$background` | valor hex dark Graphite | custom property `--background` em `index.css` |
| Frame de template | `06 · TPL · Listagem` | `template: 'listing'` no route-manifest |

### 4.2 Onde cada token vive

| Token | Arquivo dono | Forma |
|---|---|---|
| Cor semântica web (todos os temas) | `dashboard/src/index.css` | custom properties HSL em blocos `:root[data-theme=...]` — **fonte de verdade** |
| Adaptador utilitários | `dashboard/tailwind.config.js` | `colors.* = hsl(var(--*))`; fontFamily; borderRadius; boxShadow — sem valor bruto novo |
| Cor mobile | `constants/Colors.ts` | 6 paletas hex → `createTheme()` (projeção da mesma semântica; **riscos R1–R4 idênticos**) |
| Espaço/raio mobile | `constants/Spacing.ts` | escala 4pt + aliases + TouchTarget/ComponentSize |
| Motion | `index.css` (`--motion-ease-*`) | curvas; durações hoje espalhadas em classes (normalizar) |
| Z-index | proposto `--z-*` | hoje literals espalhados (ver 1.7) |
| Variáveis do `.pen` | documento pen.dev | mesmos nomes kebab-case das custom properties, com `$` |

### 4.3 Regras de paridade

1. **Token novo entra nos três lugares no mesmo change:** `.pen` (variável + swatch) + `index.css` (custom property) + `tailwind.config.js` (adaptador) — e `Colors.ts` se atingir mobile. Sem exceção, o validador rejeita var usada no Tailwind e não definida no CSS (hoje existem ~15 casos, ver 1.9).
2. **Contraste AA é testável:** pares `*/*-foreground` nos 6 temas verificados por script (converte HSL→hex, calcula razão 4.5:1 / 3:1 large). Já é meta da spec de identidade.
3. **Hex mobile × HSL web:** validador de paridade com tolerância ±2 por canal, exceções documentadas (ex.: `riscoR3` mobile `#D9531F` vs web HSL 25 85% 50%).
4. **Manifest:** cada rota ganha campo `penFrame` (ex.: `penFrame: '06 · TPL · Listagem'`) além do legado `penpot` — o `validate-pen-sync` cruza com frames existentes no `.pen`.

---

## 5. Governança

### 5.1 `design:validate` hoje (4 validadores, rodam em `build` e `test`)

| Validador | O que garante |
|---|---|
| `validate-route-manifest.mjs` | cruzamento router × manifest: toda rota registrada com template, estados, audiência, permissão |
| `validate-design-governance.mjs` | **orçamentos:** zero cores literais `(bg|text|border|ring|accent)-(red|blue|slate|…)-N` e teto de primitivas HTML (`<button|input|select|textarea|table>`) nas 17 páginas governadas + componentes estruturais |
| `validate-penpot-handoff.mjs` | 34 páginas Penpot verificadas, 9 TPL boards com estrutura, baselines por breakpoint |
| `validate-portal-boundary.mjs` | fronteira Console × Portal (imports, permissões, guards) |

### 5.2 Evolução proposta (novos validadores, mesma suíte)

1. **`validate-design-tokens.mjs`** — (a) contraste AA dos pares `*/*-foreground` nos 6 temas; (b) **paridade hex mobile×web** (`Colors.ts` × HSL de `index.css`); (c) toda var referenciada no Tailwind existe no CSS (mata as ~15 fantasmas atuais); (d) ratchet: contagem de aliases deprecated (`danger/warm/ink/status/chart`) só desce, zero na v2.0.
2. **`validate-pen-sync.mjs`** — exporta o `.pen` (JSON) e confere: todo nó `reusable` tem componente React com o mesmo nome; toda rota do manifest com `penFrame` aponta para frame existente; nomes de template = `routeTemplates`.
3. **Meta-teste do catálogo:** todo componente de `components/ui` e `domain/` tem demonstração na StyleGuidePage (`StyleGuidePage.test.tsx` estendido) — o catálogo vivo não pode ficar atrás do código.

### 5.3 StyleGuidePage (`/app/referencia-ui`) como catálogo vivo

Evolui de "referência" para **espelho em runtime do `.pen`** — mesmas seções, mesma ordem: Foundations (tokens por tema, tipografia por superfície, espaço, raio, motion, densidade) · Brand (TcsMark, coruja, uso do glow) · Components (todos os primitivos e compostos com variantes e estados) · Patterns (fila de decisões, bulk bar, pipeline, empty com glow) · States (matriz completa) · Templates (atalhos para rotas representativas). Rodapé com a versão semver do DS. Regra de ouro: **componente novo entra no `.pen` + StyleGuidePage + test no mesmo PR.**

### 5.4 Versionamento (semver)

| | Quando | Exemplos |
|---|---|---|
| **MAJOR** | remoção/renome de token ou componente, mudança de estrutura de template | remover aliases deprecated; renomear `MetricCard`→`MetricTile` |
| **MINOR** | componente/pattern/template/token novo, compatível | `DeniedState`, `--brand`, seção Mobile |
| **PATCH** | ajuste de valor de token, correção visual | warn 38 90% 34%→36% |

- Baseline: **v1.0.0 = Graphite Esmeralda V1** (este documento).
- Changelog: `docs/design-system/CHANGELOG.md` (série: 01-estrutura, 02-tokens, 03-componentes, 04-patterns-templates, 05-governanca).
- Versão visível em três lugares sempre sincronizados: capa do `.pen`, rodapé da StyleGuidePage, constante no `route-manifest.mjs`.
- Deprecação: alias vive 2 versões com aviso no console do validador, sai na MAJOR seguinte.

### 5.5 Checklist de nova tela (consolidado — SKILL.md + manifest + este DS)

- [ ] Rota registrada em router + manifest (`route()`/`portalRoute()` com template, estados, `penFrame`) + menu/navigation
- [ ] Página usa o template canônico (seção 2.4) e os componentes do DS — zero primitiva HTML acima do orçamento
- [ ] Estados via `AsyncBoundary` (loading/empty/error/retry) + `DeniedState`/guards — `npm run design:validate` passa
- [ ] Zero cor literal (só token semântico); números `tabular-nums` + `Intl` pt-BR; datas pt-BR
- [ ] Densidade testada (comfortable + compact); breakpoints 1440/1024/768/390
- [ ] A11y: aria-label em ícone-botão, foco visível, contraste AA, `motion-reduce`, skip-link
- [ ] Teste `NovaPage.test.tsx` (render/empty/erro) + baselines visuais nos 4 breakpoints
- [ ] Frame no `.pen` referenciado; componente novo já está no `.pen` e na StyleGuidePage
- [ ] UTF-8 sem mojibake; CPF nunca em tela; mapas OSM/MapLibre (nunca Google)

---

## 6. Roadmap de construção do `.pen` (fases com DoD)

| Fase | Entrega | DoD |
|---|---|---|
| 0 | Arquivo criado, variáveis `$` de todos os tokens da seção 1 | validador de paridade roda verde |
| 1 | Seções 00–03 (capa, fundamentos, marca, ícones) | swatches conferidos × index.css/Colors.ts |
| 2 | Camada 1 completa (primitivos + variantes + estados) | todo item de 2.1 com instância |
| 3 | Camada 2 (compostos, incl. MetricTile 2.0, BulkBar, DeniedState, BannerBar) | composição de 3 telas-teste só com instâncias |
| 4 | Patterns (14) + containers com slot | anatomia anotada |
| 5 | Templates (10) + estados 390 | cruzamento com route-manifest |
| 6 | Mobile (390×852) | paridade Spacing/TouchTarget |
| 7 | Governança impressa + `validate-pen-sync` no CI | suíte `design:validate` completa verde |

---

## Apêndice — Fontes consultadas (read-only)

| Arquivo | Uso neste documento |
|---|---|
| `dashboard/src/index.css` | Tokens dos 6 temas, glass, sidebar, radius, motion (§1) |
| `dashboard/tailwind.config.js` | Adaptador, escala de raio, aliases deprecated, lacunas (§1, §4) |
| `dashboard/src/components/**` (ui/, domain/, states/, data/, layout/, inbox/, portal/, brand/, bot/, auth/, customers/, public/, account/, security/, tutorial/) | Inventário completo (§2) |
| `dashboard/src/pages/StyleGuidePage.tsx` | Catálogo vivo atual (§5.3) |
| `dashboard/design/route-manifest.mjs` | 10 templates, estados obrigatórios, breakpoints, 508 baselines (§2.4, §2.5, §5) |
| `dashboard/design/penpot-handoff.mjs` | Estruturas dos TPL, 34 páginas Penpot (§2.4, §3) |
| `dashboard/scripts/validate-*.mjs` | Governança atual (§5.1) |
| `dashboard/package.json` | `design:validate` no build/test; deps (radix, cmdk, tanstack, recharts, sonner) |
| `constants/Colors.ts`, `constants/Spacing.ts` | Mobile: 6 paletas, grid 4pt, TouchTarget (§1, §4) |
| `components/ui/` (Expo) | Barrel mobile: Card, Button, Badge, States, Sheet, FlowProgress… (§2.2) |
| `.opencode/skills/tcs-console/SKILL.md` | Regras do projeto, padrão 2.0, checklist (§0, §5.5) |
| `docs/superpowers/specs/2026-10-17-identidade-visual-tcs-design.md` | Identidade V1: Graphite Esmeralda, tipografia por superfície, 14 composições, brand (§1, §2.3, §3) |
| Skill pen.dev (SKILL.md, components.md, design-system.md) | Modelo `reusable`/slots/variáveis do `.pen` (§3) |
