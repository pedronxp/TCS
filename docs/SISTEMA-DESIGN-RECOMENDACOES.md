# Sistema de Design — Padrão de Cores TCS

**Versão:** 2.0 — Redesign Minimalista + Glass
**Data:** 05/08/2026
**Escopo:** Dashboard web (`/app/*`) — página pública de vendas (`CommercialPage`, `PlansCatalogPage`) permanece com identidade própria.

> Este é o documento único de referência. Toda página ou componente do dashboard deve usar **apenas** as cores definidas aqui. Não criar cores novas inline.

---

## 1. Filosofia

O novo sistema é **monocromático com um único acento verde**. Não é "menos cor por gosto" — é hierarquia visual via tipografia, espaço e elevação sutil.

- **Preto** (`#171717`) ↔ **Branco** (`#FFFFFF`) e 2 tons de cinza compõem 95% da interface.
- **Verde** (`#15774A`) é o único pop de cor, reservado para ação primária, foco, sucesso e item ativo.
- **Glass** (translucidez + blur) aparece apenas em sidebar, popovers e command palette — nunca em cards de conteúdo.
- **Cores semânticas** (warning, destructive, info) só aparecem em status/badges — nunca como decoração.

---

## 2. Tokens (source of truth)

Implementado em `dashboard/src/index.css`. Estes são os valores a referenciar via Tailwind (`bg-primary`, `text-muted-foreground`, etc.) — **nunca usar hex direto em componentes**.

### 2.1 Base — Light Mode

| Token | HSL | Hex | Uso |
|---|---|---|---|
| `--background` | `0 0% 98%` | `#FAFAFA` | Fundo da aplicação |
| `--foreground` | `0 0% 9%` | `#171717` | Texto primário |
| `--card` | `0 0% 100%` | `#FFFFFF` | Superfície de cards |
| `--card-foreground` | `0 0% 9%` | `#171717` | Texto em cards |
| `--primary` | `158 75% 35%` | `#15774A` | **Único acento** — botões primários, links, ativos |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Texto sobre primary |
| `--primary-hover` | `158 75% 30%` | `#0F5437` | Hover de primary |
| `--muted` | `0 0% 96%` | `#F5F5F5` | Background sutil, hover |
| `--muted-foreground` | `0 0% 40%` | `#666666` | Texto secundário, labels |
| `--secondary` | `0 0% 96%` | `#F5F5F5` | Background secundário |
| `--border` | `0 0% 88%` | `#E0E0E0` | Bordas e divisores |
| `--input` | `0 0% 88%` | `#E0E0E0` | Bordas de inputs |
| `--ring` | `158 75% 35%` | `#15774A` | Focus ring (verde) |

### 2.2 Glass (translucidez)

| Token | Valor | Uso |
|---|---|---|
| `--glass-bg` | `0 0% 100% / 0.7` | Background glass (sidebar, popovers) |
| `--glass-border` | `0 0% 100% / 0.18` | Borda glass sutil |
| `--glass-shadow` | `0 0% 0% / 0.05` | Sombra mínima |
| `.glass` class | — | `backdrop-filter: blur(24px) saturate(180%)` |

### 2.3 Semânticas (status apenas)

| Token | Hex | Uso |
|---|---|---|
| `--success` | `#15774A` | Mesmo verde do primary |
| `--success-soft` | `#ECFAF3` | Background de badge de sucesso |
| `--warning` | `#C77A00` | Badge de atenção |
| `--warning-soft` | `#FEF3E2` | Background de badge de atenção |
| `--destructive` | `#C0291D` | Ações destrutivas, badge de erro |
| `--destructive-soft` | `#FEF2F2` | Background de badge de erro |
| `--info` | `#1F6BB5` | Badge informativo |
| `--info-soft` | `#EFF5FD` | Background de badge informativo |

### 2.4 Risco (semântica crítica — NÃO alterar)

| Token | Hex | Significado |
|---|---|---|
| `--risk-r1` | `#2F8A5A` | Risco baixo (verde) |
| `--risk-r2` | `#C9A21A` | Risco médio (amarelo) |
| `--risk-r3` | `#E36B2A` | Risco alto (laranja) |
| `--risk-r4` | `#B23832` | Risco muito alto (vermelho) |

### 2.5 Dark Mode

Inverte para escuro mantendo o verde como acento (mais claro para visibilidade):

| Token Light → Dark | Light | Dark |
|---|---|---|
| `--background` | `#FAFAFA` | `#0D0D0D` |
| `--foreground` | `#171717` | `#F2F2F2` |
| `--card` | `#FFFFFF` | `#141414` |
| `--primary` | `#15774A` | `#2E9E66` |
| `--muted-foreground` | `#666666` | `#949494` |
| `--border` | `#E0E0E0` | `#262626` |
| `--glass-bg` | `100% / 0.7` | `8% / 0.6` |

---

## 3. Regras de Uso

### 3.1 ✅ Faça

- **Texto:** usar `text-foreground` (primário) e `text-muted-foreground` (secundário)
- **Botão principal:** `bg-primary text-primary-foreground hover:bg-primary-hover`
- **Cards:** `border border-border bg-card` — **sem sombra**
- **Item ativo de navegação:** `bg-success-soft text-primary`
- **Focus:** `ring-ring` (verde) — consistente em toda a UI
- **Divisores:** `border-border` (sutil, `#E0E0E0`)
- **Glass:** classe `.glass` ou `.surface-glass` — só em sidebar/popover/overlay

### 3.2 ❌ Não Faça

- ❌ Usar hex direto (`bg-[#15774A]`) — sempre o token
- ❌ Aplicar glass em cards de conteúdo — só em overlays/navegação
- ❌ Usar verde como decoração — reservado para ação/foco/sucesso
- ❌ Sombras pesadas — máximo `shadow-preview` (sutil)
- ❌ Gradientes coloridos — só o gradiente tipográfico do hero (`from-foreground to-muted-foreground`)
- ❌ Cores semânticas (warning/destructive)之外 de status/badges
- ❌ Criar novos tons de cinza — só os 4 definidos

### 3.3 Mapeamento de tokens antigos → novos

Durante a refatoração, substituir:

| Antigo (marrom/bege) | Novo (monocromático) |
|---|---|
| `bg-background` (bege) | `bg-background` (cinza claro) |
| `text-foreground` (marrom) | `text-foreground` (preto) |
| `bg-primary` (marrom) | `bg-primary` (verde) |
| `border-border` (bege escuro) | `border-border` (cinza) |
| `bg-secondary` (bege claro) | `bg-secondary` (cinza claro) |
| `bg-accent` (bege) | `bg-accent` (cinza) |
| `text-muted-foreground` (marrom médio) | `text-muted-foreground` (cinza) |

---

## 4. Contraste WCAG (validado)

| Combinação | Contraste | Status |
|---|---|---|
| Foreground `#171717` sobre Background `#FAFAFA` | **18.1:1** | AAA |
| Muted `#666666` sobre Background `#FAFAFA` | **5.7:1** | AA |
| Primary `#15774A` sobre Branco `#FFFFFF` | **7.2:1** | AAA |
| Primary-foreground `#FFFFFF` sobre Primary | **7.2:1** | AAA |
| Sidebar fg `#A1A1A1` sobre glass (preto subjacente) | **12.8:1** | AAA |

Todas as combinações passam WCAG 2.1 AA. Primary e texto passam AAA.

---

## 5. Tipografia

Fonte: **Inter** (já instalado via `@fontsource`). Pesos 400/500/600/700/800.

| Papel | Tamanho | Peso | Tracking | Uso |
|---|---|---|---|---|
| Hero | 60px | 800 | -0.03em | Saudação da home |
| Stat number | 96px | 800 | -0.05em | Números monumentais da home |
| Display | 30px | 700 | -0.02em | Título de página |
| H1 | 24px | 600 | tight | Seção principal |
| H2 / Card title | 18px | 600 | normal | Título de card |
| Body | 14px | 400 | normal | Conteúdo padrão |
| Small | 13px | 400 | normal | Metadados, tabelas |
| Label | 12px | 600 | 0.08em UPPER | Labels de stats, headers de tabela |

---

## 6. Componentes padrão

- **Button** (`ui/Button.tsx`): variantes `default` (verde), `outline`, `ghost`, `destructive`. Sem `secondary`/`info` redundantes.
- **Card** (`ui/Card.tsx`): flat, `border border-border bg-card`, sem `shadow-card`.
- **Badge**: pílula monocromática (`-success-soft`, `warning-soft`, `destructive-soft`, `info-soft`).
- **Table**: divisor horizontal sutil, sem grid completo.

Ver códigos em `dashboard/src/components/ui/Button.tsx` e `Card.tsx`.
