# 02 · Pesquisa UI/UX — Design System TCS "Graphite Esmeralda"

> Escopo: console web (staff/owner) + portal do cliente. Identidade decidida: dark-first Graphite #09090B/#111114 + esmeralda #10B981; Space Grotesk + Inter + IBM Plex Mono.
> Fontes: specs locais Linear/Vercel/Supabase (`.agents/skills/design-md`); `dashboard/src/index.css`; `dashboard/package.json`; `tailwind.config.js`; docs Tailwind v4 (`@theme`); artigos OKLCH (Evil Martians, Design Systems Collective, Carmen Ansio); Vercel "shadcn vs Radix"; WCAG 2.2 (WAI/WebAIM).
> Estado atual do repo: Tailwind **v3.4.13** (config JS), tokens HSL tripletos, 6 temas (`data-theme`: light/dark/orca/dracula/nord/gruvbox) + fallback `prefers-color-scheme`; só `@fontsource/inter` instalado; `axe-core`+`vitest-axe` já em devDeps (sem gate); easings de motion já definidos; raios já estão 8/12/16/20.

---

## 1. Stack — ADOTAR / ADAPTAR / REJEITAR

| Decisão | Item | Motivo / condição |
|---|---|---|
| **ADOTAR** | **Tailwind CSS v4** (`@import "tailwindcss"` + `@theme`, CSS-first) | Tokens viram CSS vars nativas; oklch de primeira classe; `@custom-variant` para os 6 `data-theme` sem config JS. Migrar do v3 num PR dedicado, com snapshots Playwright por tema como rede de segurança. |
| ADOTAR | Radix **Primitives** (não Radix Themes) | Já instalado; comportamento + a11y sem opinião de estilo. |
| ADOTAR | Padrão shadcn **"código no repo"** | Radix + CVA + `tailwind-merge` já presentes. Adotar a convenção (variants, `cn()`), não o CLI/registry — fonte: Vercel recomenda exatamente isso para design systems customizados. |
| ADOTAR | TanStack Table + Query | Já instalados; tabela operacional densa (pinning, sort, virtualização) + cache. |
| ADOTAR | recharts (manter) | Já instalado e tokenizável; thematizar cores via CSS vars. |
| ADOTAR | sonner, cmdk, vaul, lucide-react | Toasts, paleta de comandos, drawer mobile, ícones — manter, todos aceitam tokens. |
| ADOTAR | Catálogo de componentes — Storybook 8 ou Ladle | Visor com 6 temas × 2 densidades; serve de contrato visual para o `design:validate` e para o handoff Penpot. |
| ADOTAR | `axe-core` + `vitest-axe` **como gate de CI** | Já estão em devDeps — falta virar bloqueio encadeado ao `design:validate`. |
| ADOTAR | `@fontsource` self-host p/ as 3 famílias | Sem CDN (LGPD, latência, offline). |
| **ADAPTAR** | `motion` (Framer) | Apenas portal/microinterações pontuais; console usa transições CSS + tokens (JS de animação em UI operacional = jank e custo). |
| ADAPTAR | OKLCH | Primitivos em oklch já na migração; semânticos migram tema a tema, cada um coberto por snapshot visual. |
| ADAPTAR | `tailwindcss-animate` | Na migração v4, substituir por `tw-animate-css` ou utilitários próprios. |
| ADAPTAR | Geist Sans/Mono (OFL) | Substitutas documentadas de Space Grotesk / Plex Mono (specs Linear e Vercel as citam como análogas) — sem instalar por padrão. |
| **REJEITAR** | **Tremor** | Duplica recharts, impõe tema próprio; conflita com Graphite. |
| REJEITAR | Style Dictionary | Build step redundante com `@theme`; export Penpot sai de um script CSS→JSON simples (o repo já tem `validate-penpot-handoff`). |
| REJEITAR | Radix Themes, MUI, Chakra, Ant Design | Styling empacotada conflita com tokens TCS; duplicam Radix. |
| REJEITAR | Google Fonts CDN | Quebra offline, request terceiro; manter self-host via fontsource. |
| REJEITAR | Gradientes atmosféricos, spotlight, glass pesado | As três specs rejeitam explicitamente (Linear: "no atmospheric gradients"); contexto operacional pede calma visual. |

## 2. Cor

### 2.1 Oklch — recomendação e por quê
**Decisão: primitivos em Oklch; semânticos migram de HSL para Oklch tema a tema.**
1. **L perceptual**: R1–R4 atravessam verde→âmbar→laranja→vermelho. Em HSL, `L 50%` num amarelo "grita" e num vermelho escurece — mentira perceptual que quebra a calibragem de risco. Em Oklch, mesmo L = mesmo brilho aparente: os 4 níveis de risco "pesam" igual.
2. **Croma explícito**: dark pede croma menor (≈ .10–.15) — evita neon sobre #09090B; HSL esconde isso, Oklch expõe.
3. **Faixa de L mais estreita no dark** (≈ .10–.93): padrão documentado para escalas dark-first.
4. Interop: `color-mix(in oklch, var(--risk-r3) 60%, transparent)` gera hover/soft a partir de 1 token.
5. Tailwind v4 usa Oklch nativamente; suporte Baseline 2023 (Chrome 111+, Safari 15.4+, Firefox 113+) — suficiente para console interno e portal.

### 2.2 Arquitetura em 3 camadas
```
Camada 1 — PRIMITIVOS (estáticos, @theme, oklch)
  graphite-950…50 · emerald-900…50 · amber · orange · red · blue
  (+ escalas equivalentes para orca/dracula/nord/gruvbox)
Camada 2 — SEMÂNTICOS (por tema, :root[data-theme=…])
  --background --surface-1..4 --foreground --muted-foreground
  --border --ring --success/--warning/--destructive/--info (+ -soft)
  --risk-r1..r4 (+ -soft, + -foreground)
Camada 3 — COMPONENTE (neutros em tema; referem-se à camada 2)
  --control-h --row-h --table-header-bg --focus-ring-w …
```
**Regra de governança:** componente nunca consome primitivo direto — checar por grep no `design:validate`.

### 2.3 Contraste por papel (WCAG 2.2)
Alvo TCS: **AAA (7:1) para texto principal** (serviço público de defesa civil), AA 4.5:1 para qualquer texto, 3:1 para UI/gráficos (SC 1.4.11).

| Papel | Mínimo | Alvo | Estado Graphite dark |
|---|---|---|---|
| `--foreground` | 4.5:1 | **AAA** | `0 0% 98%` ≈ 18.9:1 ✓ |
| `--muted-foreground` | 4.5:1 | AAA | atual `240 5% 60%` ≈ 6.5:1 → **subir p/ 65%** (≈8:1) |
| Hairline decorativo | — | ≥1.5:1 | `240 4% 14%` — divisória existe sem chamar atenção |
| Borda de input interativa | 3:1 | 3:1 | via lift de superfície + ring; no hover sobe p/ `hairline-2` |
| Ring de foco | 3:1 | ≥3:1 | esmeralda `142 71% 45%` ≈ 8.5:1 ✓ |
| Texto sobre `risk-*-soft` | 4.5:1 | 7:1 | tokens `risk-*-foreground` |
| Marcador R em mapa/gráfico | 3:1 | 3:1 | ver 2.6 |

Nota: APCA critica WCAG 2.x para claro-sobre-escuro; mirar AAA 7:1 dá a margem de segurança sem depender de troca de fórmula.

### 2.4 Como validar nos 6 temas
1. **Script de CI** `scripts/validate-contrast.mjs`: parse das vars direto do `index.css` (fonte única de verdade, sem `tokens.json` paralelo) → rgb → ratio WCAG (+ APCA opcional) → matriz tema×papel. **Falha <AA bloqueia merge**; AAA é alvo, não gate (exceto `--foreground`).
2. Encadear no `design:validate` (já roda em `test` e `build`).
3. `vitest-axe` com `data-theme` setado por caso de teste — 6 temas + fallback automático (`prefers-color-scheme` sem atributo) nas páginas-chave.
4. `test:visual` (Playwright, já existe): 1 rota sentinela × 6 temas com snapshots baselined.

### 2.5 Escala de superfícies dark (Graphite) com hairlines
Elevação no dark = **degrau de superfície + hairline**, não sombra (padrão Linear).

| Nível | Token | HSL | hex ≈ | Uso |
|---|---|---|---|---|
| 0 | `--background` | 240 11% 4% | #09090B | canvas da app |
| 1 | `--surface-1` | 240 5% 7% | #111114 | card, tabela |
| 2 | `--surface-2` | 240 4% 9% | #16161A | hover, linha ativa |
| 3 | `--surface-3` | 240 5% 12% | #1D1E21 | popover, dropdown |
| 4 | `--surface-4` | 240 4% 15% | #252528 | modal, chrome de overlay |
| hairline-1 | `--border` | 240 4% 14% | #222225 | divisória, contorno de card |
| hairline-2 | (input/hover) | 240 4% 21% | #333337 | borda forte de campo |
| hairline-3 | (interativo) | 240 4% 28% | #444448 | borda de foco/hover-ativo |

- Degraus de ~3 pontos de L: 4→7→9→12→15. Detalhe Linear: `inset 0 1px 0 rgb(255 255 255 / .04)` no topo de painéis elevados (edge "renderizado").
- Light: mecânica invertida — canvas #F6F6F7, card #FFF, hairlines #E4E4E7 → #D4D4D8.

### 2.6 Risco R1–R4 calibrado para dark
**Lacuna encontrada:** as vars de risco são definidas só no `:root` light e **herdadas por todos os temas dark** — precisam de calibragem por tema. Valores Graphite dark (ícone/texto sobre canvas; alvo ≥4.5:1 AA, 7:1 quando rótulo textual):

| Risco | Light (hoje) | Dark calibrado | Contraste s/ #09090B | Soft bg dark |
|---|---|---|---|---|
| R1 baixo | `145 55% 36%` | `145 60% 55%` | ≈10:1 AAA | `145 45% 14%` |
| R2 médio | `46 88% 42%` | `46 90% 58%` | ≈12:1 AAA | `46 45% 14%` |
| R3 alto | `25 85% 50%` | `24 88% 60%` | ≈10:1 AAA | `24 45% 14%` |
| R4 crítico | `2 68% 47%` | `2 78% 64%` | ≈6:1 AA (texto pequeno sobre soft usa `risk-r4-foreground` claro) | `2 45% 15%` |

- **Nunca diferenciar risco só por cor**: sempre rótulo ("R4 — Crítico") ou ícone + texto (daltonismo ~8% dos homens).
- Mapa (maplibre): preenchimento soft + contorno forte do token; validar 3:1 contra a superfície.
- Vermelho é semântica **exclusiva** de R4/destructive — zero vermelho decorativo no console.

## 3. Tipografia

### 3.1 Famílias e licenças — as 4 fontes são SIL OFL 1.1 ✓

| Família | Papel | Licença | Verificação |
|---|---|---|---|
| Space Grotesk | Display/títulos | **SIL OFL 1.1** (Florian Karsten) | conferir LICENSE em `@fontsource/space-grotesk` |
| Inter | Texto/UI/dados | **SIL OFL 1.1** (Rasmus Andersson) | já em uso via `@fontsource/inter` |
| IBM Plex Mono | Mono (protocolos, IDs, headers técnicos) | **SIL OFL 1.1** (IBM — Plex re-licenciado OFL) | conferir LICENSE do pacote |
| Geist Sans/Mono | Substituta documentada (fallback de design) | **SIL OFL 1.1** (Vercel) | não instalar por padrão |

Conclusão: todas OFL → uso comercial e self-host permitidos, sem custo de licença.

### 3.2 Escala — Console (denso)
| Token | px/lh | peso | fonte | tracking |
|---|---|---|---|---|
| display-lg | 28/32 | 600 | Space Grotesk | -0.56px |
| display-md | 24/30 | 600 | Space Grotesk | -0.48px |
| heading-lg | 20/28 | 600 | Space Grotesk | -0.20px |
| heading-md | 16/24 | 600 | Inter | 0 |
| heading-sm | 14/20 | 500 | Inter | 0 |
| body-md | 14/20 | 400 | Inter | 0 |
| body-sm | 13/18 | 400 | Inter | 0 |
| caption | 12/16 | 400 | Inter | 0 |
| micro | 11/14 | 500 | Inter | +0.2px (uppercase opcional) |
| eyebrow | 12/16 | 500 | Inter | +0.4px, uppercase |
| mono-md | 13/18 | 400 | IBM Plex Mono | 0 |
| mono-sm | 12/16 | 400 | IBM Plex Mono | 0 |
| data | 13/16 | 400 | Inter `tabular-nums` | 0 |

### 3.3 Escala — Portal (arejado)
| Token | px/lh | peso | tracking |
|---|---|---|---|
| display-xl | 48/52 | 600 | -1.44px |
| display-lg | 36/40 | 600 | -0.72px |
| display-md | 28/34 | 600 | -0.56px |
| heading-lg | 20/28 | 600 | -0.2px |
| body-lg | 18/28 | 400 | 0 |
| body-md | 16/24 | 400 | 0 |
| body-sm | 14/20 | 400 | 0 |
| caption | 12/16 | 400 | 0 |

Regra de tracking (padrão convergente Linear/Vercel/Supabase): **negativo ≈ -2% do tamanho em ≥28px; 0 entre 14–24px; positivo +0.2~0.4px em micro-labels uppercase**. Sentence case sempre; ALL CAPS só em micro/eyebrow.

### 3.4 Carregamento variable via @fontsource + fallbacks
```css
@import '@fontsource-variable/inter';           /* 1 arquivo, wght 100–900 */
@import '@fontsource-variable/space-grotesk';   /* wght 300–700 */
@import '@fontsource/ibm-plex-mono/400.css';    /* Plex Mono NÃO tem versão variable */
@import '@fontsource/ibm-plex-mono/500.css';

:root {
  --font-sans: 'Inter Variable', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-display: 'Space Grotesk Variable', 'Inter', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
}
/* fallback métrico anti-CLS (font-display: swap já é padrão fontsource) */
@font-face {
  font-family: 'Inter Fallback'; src: local('Arial');
  size-adjust: 107%; ascent-override: 90%; descent-override: 22%; line-gap-override: 0%;
}
```
- Subsets `latin` (fontsource já fatia); nenhum peso <400 no console (densidade lê pior); 600 substitui 700 nos títulos (Inter 600 ≈ Linear 600).

## 4. Espaço, raio, sombra, motion

### 4.1 Espaço — grid 4pt
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64` px (0.25–4rem). Console: padding interno de card 20–24; portal: 32. Sub-4px proibido em layout (só ícone/decoração).

### 4.2 Raio — 8/12/16/20 (+ pill)
sm **8** (input, botão, chip) · md **12** (card) · lg **16** (painel, modal) · xl **20** (hero, empty state) · full **9999** (status pill). O `tailwind.config.js` já está 8/12/16/20/24 — **travar por governance**; `--radius: 1.25rem` segue como base shadcn.

### 4.3 Sombras — só difusas
- Dark: **sem drop-shadow pesada**. Popover/modal = degrau de superfície + hairline + glow difuso `0 8px 24px -8px rgb(0 0 0 / .55)` + edge inset (2.5).
- Light: stack sutil (padrão Vercel): `0 1px 2px rgb(0 0 0 / .05), 0 2px 4px rgb(0 0 0 / .06)` + hairline.
- Proibido: sombra dura/offset (`shadow-[2px_2px_0…]`), glow colorido decorativo.

### 4.4 Motion tokens
```css
:root {
  --motion-fast: 150ms;   /* hover, foco, toggle, checkbox */
  --motion-base: 250ms;  /* dropdown, tooltip, accordion, toast */
  --motion-slow: 400ms;  /* drawer, modal, troca de painel */
  --motion-ease-out: cubic-bezier(0.16, 1, 0.3, 1);     /* entradas — já existe no repo */
  --motion-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1); /* estado↔estado — já existe */
  --motion-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1); /* drawers — já existe */
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
```
- Usar `motion-reduce:*` do Tailwind para exceções (SC 2.3.3). Nunca animar mudança de estado de risco abaixo de 150ms (leitura de emergência); transição de cor >400ms proibida (estado lento = ruído).

## 5. Acessibilidade
- **Foco esmeralda visível**: `:focus-visible` com `box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring)` (offset 2px) — nunca `outline: none` sem substituto. Esmeralda sobre graphite ≈ 8.5:1 ✓.
- Radix entrega roles/aria/teclado; completar com `aria-live` nos toasts (sonner), labels sempre vinculados (react-hook-form), skip-link no console.
- **axe no CI**: `vitest-axe` por página-chave × 6 temas; falha quebra o build (encadeado ao `design:validate`).
- **Gráficos (recharts)**: séries ≥3:1 contra o fundo do plot; nunca codificar só por cor — 2ª série com `strokeDasharray`, rótulos diretos nas extremidades, eixos em AAA; R1–R4 em gráficos usam os tokens calibrados (2.6).
- Tema inicial respeita `prefers-color-scheme` + persistência; `color-scheme` por tema já correto no `index.css`.
- WCAG 2.2: alvo de toque ≥24px (SC 2.5.8 AA); padrão 44px no portal mobile (2.5.5 AAA como meta).

## 6. Densidade
### Alturas padrão
| Controle | Console web | Portal/mobile |
|---|---|---|
| Input/select | **38px** | **44px** |
| Botão md / sm | 36 / 32px | 44 / 36px |
| Linha de tabela | **40px** | 48px (card-list) |
| Item de sidebar | 36px | 48px |
| Célula (py) | 8px | 12px |

### Modo confortável/compacto
`data-density="compact|comfortable"` no root; CSS vars fazem o trabalho:
```css
:root[data-density="compact"]     { --row-h: 32px; --control-h: 32px; }
:root[data-density="comfortable"]  { --row-h: 44px; --control-h: 38px; }
```
Default console = confortável; usuário alterna e persiste no perfil. Portal mobile **nunca** compacto (toque). Catálogo Storybook documenta os dois modos.

## 7. Os 8 aprendizados das specs — e como aplicar no TCS
1. **Escada de superfícies + hairline substitui sombra no dark** (Linear: canvas #010102 → 4 degraus, hairlines #23252a→#3e3e44, "resists drop shadows on dark"). → *Aplicar*: ladder L 4→7→9→12→15% com 3 hairlines (2.5); modal/popover sobe 1 degrau + glow difuso + edge inset.
2. **Um acento, escasso** (Linear: lavanda só em marca, foco e CTA; "no second chromatic color"). → *Aplicar*: esmeralda apenas em foco, linha ativa, CTA primário e estados positivos; primary neutro invertido permanece; zero acento decorativo.
3. **Display com tracking negativo, eyebrow positivo** (Linear -3px@80px ≈ -4%; eyebrow +0.4px). → *Aplicar*: Space Grotesk ≥28px com -2%; micro-labels uppercase com +0.2~0.4px (3.2/3.3).
4. **Mono para rótulos técnicos de tabela** (Vercel: header `caption-mono` uppercase). → *Aplicar*: headers de tabelas de vistoria em IBM Plex Mono 11px uppercase +0.4px em muted; protocolos/CEPs/IDs em mono tabular.
5. **Cinza fino, cada divisória com seu degrau** (Vercel: escala de 200 passos; hairline vs hairline-strong). → *Aplicar*: 10 degraus graphite-950→50 como primitivos; border/input/hover/disabled cada um com degrau próprio (hairline-1/2/3).
6. **On-primary quase-preto em botão de cor** (Supabase: texto #171717 sobre esmeralda — "lit surface", AAA). → *Aplicar*: CTA esmeralda usa `--primary-foreground: 160 84% 6%` (já correto no dark) em **todos** os temas; nunca branco sobre esmeralda.
7. **Destaque por inversão dark, não por cor** (Supabase: tier featured inverte p/ #1c1c1c em vez de ficar verde). → *Aplicar*: card destacado/estado crítico de layout = inversão de superfície + ring esmeralda; vermelho fica exclusivo de R4/destructive.
8. **Profundidade vem do produto, não de decoração** (as três: screenshots/mockups como herói; Linear: "no atmospheric gradients, no spotlight"). → *Aplicar*: dados reais de vistoria como herói do console; empty states com amostra de dados, não ilustração; o whitespace do canvas graphite É o design.

## 8. Síntese
Graphite Esmeralda = **Linear** (superfícies + hairline, acento escasso) × **Supabase** (esmeralda "lit" com texto escuro, destaque por inversão) × **Vercel** (cinza fino, mono técnico, alturas de input em degraus). Oklch nos primitivos, 3 camadas de token, AAA em texto principal, contraste validado por script nos 6 temas, densidade dupla console/portal, motion 150/250/400ms com redução obrigatória.

---
*Fontes: DESIGN.md Linear/Vercel/Supabase (biblioteca local `design-md`); tailwindcss.com/docs/theme + blog v4.0; evilmartians.com/chronicles/oklch-in-css; designsystemscollective.com (OKLCH dark mode); carmenansio.com (oklch + color-mix); vercel.com/i/shadcn-vs-radix; w3.org WAI WCAG 2.2 (SC 1.4.3, 1.4.6, 1.4.11, 2.3.3, 2.5.8); webaim.org/articles/contrast.*
