# 04 · Mobile — React Native / Expo (TCS Design System)

> Validadado contra o repo em 2026-10-24: `constants/Colors.ts` (211 linhas, 6 paletas), `package.json` (Expo SDK ~57.0.23 · React 19.2.3 · RN 0.86.3 · expo-router ~57.0.21), `components/ui/` (17 componentes).
> Status: ✅ existe · 🔧 evoluir · ➕ criar · ⚠ drift real encontrado no repo.

## 1. Paridade de tokens (1 fonte de verdade → 2 saídas)

**Princípio**: Style Dictionary gera **CSS vars** (web) e **constants TS** (mobile) do mesmo `tokens.json`. Nenhuma paleta hand-written sobrevive à migração — `Colors.ts` vira *consumer* dos tokens gerados, mantendo a API `Colors.light|dark|orca|dracula|nord|gruvbox` intacta para não quebrar os ~6 temas e `TCSPalette` (alias legado já existente).

**Pipeline**: `design-tokens/tokens.json` → `style-dictionary build` → `dist/tcs.css` + `constants/tokens.ts` → `createTheme()` injeta em `Colors`. CI compara hash das duas saídas (drift = build falha).

### Tabela de migração — drifts reais do `Colors.ts`

| # | Token (hoje) | Valor atual no repo | Alvo canônico (SD) | Impacto |
|---|---|---|---|---|
| 1 | `success` (idêntico nos 6 temas) | `#22C55E` | `#059669` | Botões/chips de sucesso, `riscoR1` (alias), Orca `primary` |
| 2 | `dark.background` | `#171717` | `#09090B` | Superfícies dark nativas (zinc-950, paridade web) |
| 3 | `warning` ⚠ duplicado | light `#C77A00` / dark `#F59E0B` | base `#F59E0B` + variante deep `#C77A00` documentada | Chip R2, banner offline, billing |
| 4 | `danger` ⚠ duplicado | light `#C0291D` / dark `#DC2626` | base `#DC2626` + variante deep `#C0291D` | Erros, chip R4 (alias atual) |
| 5 | `riscoR1/R2/R4` ⚠ aliases | R1=success, R2=warning, R4=danger (só R3 é dedicado `#D9531F`) | Tokens dedicados `risk.r1..r4` (mesmos valores do web) | Desacopla risco de semântica de UI; web já tem chips dedicados |
| 6 | `focusRing` ⚠ neutro | `#EDEDED` (accent light) | esmeralda `#059669` | Foco visível a11y (§5) |
| 7 | Temas extras (orca/dracula/nord/gruvbox) | hardcoded fora do SD | Congelar como estão; não-portar ao web | Escopo do SD = light/dark + risco |

## 2. Tipografia RN

**Gap real**: `package.json` não tem `@expo-google-fonts/*` — Space Grotesk e IBM Plex Mono **não carregam hoje** (fallback sistema). Instalar via `npx expo install @expo-google-fonts/space-grotesk @expo-google-fonts/ibm-plex-mono`, carregar no `_layout` raiz com `useFonts` + `SplashScreen.preventAutoHideAsync` até prontidão.

| Token | Size | LH nominal | LH pt-BR (+10%) | Pesos | Uso |
|---|---|---|---|---|---|
| `display` | 17 | 24 | 26 | 700 | Título de wizard, KPI |
| `body` | 15 | 21 | 23 | 400/500 | Perguntas, listas |
| `label` | 13 | 18 | 20 | 500/600 | Chips, botões, deltas |
| `caption` | 11 | 15 | 16 | 400 | GPS, timestamps, contador N/18 |

- **Fontes**: títulos Space Grotesk (600/700); **dados numéricos** IBM Plex Mono 400/500 (métricas, contadores, coordenadas — iguala laudo/relatório web).
- **lineHeight pt-BR +10%**: aplicado em parágrafos e wizard (texto corrido acentuado corta ascenders no LH nominal); chips/botões mono-line usam o nominal.
- **Dynamic Type**: `allowFontScaling` **true** (default, não desligar); `maxFontSizeMultiplier` 1.3 em chip/badge/botão, 1.2 em CTA fixo, livre no wizard. `lineHeight` sempre derivado (`round(size × ratio)`), nunca literal, para escalar junto.
- Implementar como hook `useTypography()` + `Text` wrapper (`components/ui/` já tem `Screen`/`SectionHeader` como ponto de aplicação).

## 3. Componentes

Inventário real de `components/ui` (17): AppHeader, Badge, Button, Card, ConfirmSheet, EmptyState, ErrorState, FlowProgress, FormField, ListRow, LoadingState, MetricCard, ModuleCard, OptionSheet, Screen, SectionHeader, StateBanner.

| Componente | Status | Especificação 2.0 |
|---|---|---|
| Button | 🔧 | Variantes **primary/ghost/destructive**; h-48 mobile; radius 12; peso 600; **press-scale 0.97**; `a11yRole="button"` + `disabled` via `accessibilityState` |
| Chip risco R1-R4 | ➕ | Mesmos tokens `risk.r1..r4` do web (tabela §1); pill h-28, dot 8px; `maxFontSizeMultiplier 1.3`; seleção = haptic none |
| MetricCard | 🔧 → 2.0 | KPI Tremor: `label / value / delta / sparkline`; value em **IBM Plex Mono**; delta ↑/↓ com cor semântica; sparkline SVG (`react-native-svg 15.15.4` ✅) |
| ConnectivityBanner | ➕ (de StateBanner) | **Âmbar** (`warning`), nunca bloqueia navegação, sem botão fechar; netinfo `12.0.1` ✅ |
| BillingBanner | ➕ (de StateBanner) | Variante billing: aviso de cobrança/assinatura, dismissível |
| PhotoTile | ➕ | JPEG **72% / 1280px** via `expo-image-manipulator` ✅; grid 2-col; GPS chip (precisão ±m); badge contagem "3/6"; press → fullscreen |
| Stepper (N/M) | 🔧 FlowProgress | "pergunta **N/18**"; barra fina 4px; mono para N/M; usado em wizard |
| SignaturePad | ➕ | `react-native-svg` ✅ + `PanResponder` (nativo, sem gesture-handler no repo); traço 2.5px; clear + confirm |
| EmptyState | 🔧 | Mascote **Coruja (Vigi)** — SVG estático (ou Lottie futuro) + título + CTA único |
| Skeleton | ➕ | **Shimmer** (reanimated, §6); radius 12; respeita `risk.surface` |
| LoadingState / ErrorState / ConfirmSheet / OptionSheet / FormField / AppHeader / Screen / Card / ListRow / SectionHeader / ModuleCard / Badge | ✅ manter | Auditar tokens pós-SD + a11y (§5) |

## 4. Navegação (expo-router ~57.0.21 ✅)

- **Stacks aninhadas obrigatórias** — regra de arquitetura: cada domínio ganha `_layout` próprio: `app/(panel)/admin/_layout`, `app/(panel)/inspecoes/_layout`, `laudos/_layout`, `mapas/_layout`, `billing/_layout`, `config/_layout`. **40 telas numa stack única = risco de memória real** (crash em Android low-end); alvo ≤8 telas vivas por stack.
- **Safe-area**: `react-native-safe-area-context ~5.7.0` ✅; `Screen` aplica insets; CTAs bottom-fixed sempre `insets.bottom` (não `Platform.select` hardcoded).
- **Haptics** (`expo-haptics ~57.0.3` ✅):

| Evento | API | Intensidade |
|---|---|---|
| Foto capturada | `impactAsync` | Light |
| Assinatura confirmada | `impactAsync` | Medium |
| R4 detectado | `notificationAsync` | Warning |
| Sync concluído | `notificationAsync` | Success |

- **Listas**: `@shopify/flash-list` ⚠ ausente — instalar (`npx expo install @shopify/flash-list`); inspeções, protocolos e checklist saem de `FlatList`.
- Offline: `expo-sqlite ~57.0.3` ✅ + `expo-background-fetch`/`task-manager` ✅ já suportam "respostas locais · sync automático".

## 5. Acessibilidade

- `accessibilityLabel` + `accessibilityRole` (RN 0.86 aceita `a11yRole`) em **todo** componente de `ui`; `accessibilityState` (disabled/selected); leitura VoiceOver/TalkBack em ordem label → valor → delta.
- **Alvo 44pt** em todo interativo; ícones-tap usam `hitSlop` mínimo 12.
- **Luz do sol** (regra de campo): telas de **wizard, foto e mapa** forçam tema **claro** (ou high-contrast) — dark puro falha em sol. Hook `useFieldTheme()` por rota; demais telas seguem preferência do usuário.
- **Foco esmeralda** (`#059669`, tabela §1 #6): outline 2px + offset 2 em interativos focados (react-native-web herdará via CSS); substitui o `focusRing #EDEDED` atual.
- Contraste: `foreground` sobre `success` claro exigirá revisão pós `#059669` (verificar AA 4.5:1 em chips R1).

## 6. Motion

⚠ **Gap real**: `react-native-reanimated` NÃO está no `package.json`. Instalar versão compatível com SDK 57 (`npx expo install react-native-reanimated`) antes de implementar; enquanto ausente, usar `Animated` do RN.

| Preset | Duração | Curva | Uso |
|---|---|---|---|
| fade-up | 250ms | ease-out; translateY 8→0 + opacity | Entrada de tela/card |
| press-scale | 150ms | ease-out; scale 1→0.97 | Button, PhotoTile, Chip |
| shimmer | 1200ms loop | linear; translateX -100%→100% | Skeleton |

- **Reduce Motion**: `AccessibilityInfo.isReduceMotionEnabled()` + listener `reduceMotionChanged`; ativo → fade-up vira crossfade pura, shimmer vira pulso de opacidade, press-scale mantém (não é movimento de tela).

## 7. Ícones

- Hoje: `@expo/vector-icons ^15.1.1` (**Feather**). Alvo: **lucide-react-native** — paridade com os **155 ícones já mapeados no web**.
- Plano: (1) `npx expo install lucide-react-native`; (2) migração 1:1 Feather→lucide (nomes quase idênticos; script de lint proíbe imports Feather); (3) remover `@expo/vector-icons` quando zero imports; (4) **a11y**: decorativos `importantForAccessibility="no"` + `accessibilityElementsHidden`; botão ícone+texto vira **label única** (`accessibilityLabel` no container).

## 8. Telas críticas (micro-spec)

### 8.1 Wizard vistoria (offline-first)
- Header: `AppHeader` + `FlowProgress` "**pergunta N/18**" (Stepper §3).
- Corpo: pergunta `body` 15/23 pt-BR; **chips R1-R4** (tokens `risk.*`); `PhotoTile` grid 2-col com contagem máx "3/6"; GPS chip `caption` mono "±8 m" (`expo-location ~57.0.18` ✅).
- Rodapé informativo: "3 respostas locais · sync automático" (caption, `muted`) — nunca modal, nunca bloqueia.
- CTA "**Próxima pergunta**" bottom-fixed h-48, safe-area, press-scale, haptic none (haptics só nos 4 eventos §4).

### 8.2 Laudo
- Badge **R3** com ícone `siren` (lucide), fundo `risk.r3` `#D9531F` + `riscoR3Text`.
- Métricas em **IBM Plex Mono** (label/delta/sparkline = MetricCard 2.0).
- Assinatura: `SignaturePad` + haptic Medium no confirm.
- Share: PDF via `expo-print` ✅ + `expo-sharing` ✅; WhatsApp via `expo-linking` ✅ (`wa.me/?text=`).

### 8.3 Mapa
- `react-native-maps 1.27.2` ✅ (nativo). **Regra em revisão** nativo vs OSM — decisão pendente; enquanto isso, nativo permanece.
- Pins R1-R4 (`risk.*`) com **callout**: endereço · risco · N fotos.
- Legenda fixa (bottom-sheet `ConfirmSheet` pattern); **fallback lista** (`ListRow`) quando mapa indisponível (emulador sem Play Services, mapa falha ao carregar, permissão negada).
- Modo campo: tema claro forçado (§5); re-render de pin ≤16ms via `Marker` tracking.

---

*Próximo passo: build do Style Dictionary + CI de paridade (§1) antes de qualquer novo componente; componentes novos (Chip, PhotoTile, SignaturePad, Skeleton, banners) entram já consumindo `constants/tokens.ts`.*
