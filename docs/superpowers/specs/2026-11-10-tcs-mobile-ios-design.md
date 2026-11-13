# TCS Mobile 2.0 — Design System iOS · Logomarca Lettermark

**Data:** 2026-11-10 · **Status:** aguardando aprovação de Pedro
**Onde:** canvas pen.dev (FigCraft) via MCP `pencil` · documento do canvas `dda501f6-8d63-4b92-ace1-2021d9c32add`
**Referências:** https://developer.apple.com/design/ (HIG) · skills `pen-dev` do próprio Pen · `docs/design-system/` v1

---

## 1. Intenção e porquê

Repaginar **todas as telas do app mobile (Expo)** seguindo o design system da Apple.
O usuário rejeitou a direção anterior (dark graphite + esmeralda) com três críticas:
**escuro demais**, **cores sem sentido**, **campos poluentes para a UX**. O novo sistema
é **iOS puro em tema claro**, com cor aplicada apenas onde carrega significado.

## 2. Decisões tomadas com o usuário (fechadas)

| # | Decisão | Origem |
|---|---|---|
| 1 | **Tema claro iOS** — branco e cinza-sistema; nada de dark-first | usuário ("cores escuras demais") |
| 2 | **Cor de ação única: azul bebê `#5AC8FA`** — botões, links, estados ativos | usuário ("use azul bebê") |
| 3 | **Cor só com significado** — cinzas do sistema na estrutura; risco R1–R4 é a única cor forte fora do tint; vermelho só destrutivo | usuário ("cores sem sentido") |
| 4 | **Campos limpos estilo iOS** — label acima, campo simples, sem ícone decorativo, validação discreta | usuário ("campos poluentes") |
| 5 | **Logomarca = lettermark "TCS"** em vidro (Liquid Glass) sobre tile azul profundo, **variante B extrudado**, aresta azul bebê; **sem animal** | usuário (escolheu B) |
| 6 | Criação no **FigCraft via MCP** (spawn de agentes permitido, com moderação) | usuário |

## 3. Tokens do sistema (fonte de verdade no canvas)

### Cor
- **Fundo da tela:** `#FFFFFF` · **Fundo agrupado:** `#F2F2F7` · **Card:** `#FFFFFF` (r 16)
- **Separador:** `rgba(60,60,67,0.29)` (hairline) · **Preenchimento de campo:** `#F2F2F7` com borda `#D6D9DE`
- **Label:** `#000000` · **Label secundária:** `rgba(60,60,67,0.60)` · **Terciária:** `rgba(60,60,67,0.30)`
- **Tint (ação):** `#5AC8FA` · **CTA preenchido: fundo `#5AC8FA` com texto `#0A2C55` semibold** (decisão do usuário — contraste ~7:1) · Links/estados ativos sobre branco: `#3D9BE9` quando precisar de contraste · Tint pressionado: `#3D9BE9`
- **Risco (semântico, iOS):** R1 `#34C759` · R2 `#F7CE46` · R3 `#FF9500` · R4 `#FF3B30` (fills suaves 12%)
- **Destrutivo:** `#FF3B30` · **Info:** `#0A84FF`

### Tipografia (Inter substituindo SF Pro; IBM Plex Mono em dados)
Large Title 34 bold −0.4 · Title 22 bold · Headline 17 semibold · Body 17 · Callout 16 ·
Subhead 15 · Footnote 13 · Caption1 12 · Caption2 11. Pesos só regular/medium/semibold/bold.
Números, protocolos, GPS, timers → IBM Plex Mono. Space Grotesk apenas no wordmark/tagline do lockup.

### Componentes (padrões HIG)
- **Nav bar** com Large Title (34) e botão de ação no canto direito
- **Tab bar nativa translúcida** (material ultrathin, 49px + safe area), 4 abas — **sem FAB central** (call minha: padrão iOS usa botão `+` no nav bar; o FAB anterior era anti-padrão)
- **Grouped inset lists**: cards brancos r 16 sobre `#F2F2F7`, separadores hairline internos
- **Segmented control**, **switches iOS (51×31)**, **search bar** (campo cinza r 10), **chips de filtro** discretos
- **Risco R1–R4**: chip pill com dot + label mono; flag lateral colorida em listas; gauge no resultado
- **Campos**: label 13 acima · campo h 50 r 14 · foco = borda `#5AC8FA` 1.5 · erro = texto 12 vermelho abaixo · sem ícones nos campos (exceto senha: olho)

## 4. Logomarca (fechado — variante B)

- Lettermark **"TCS"** Space Grotesk bold, branco com gradiente de vidro, sombra dura
  de extrusão (`#020B18`) sobre **tile azul profundo** `#1E63B0→#0A2C55`, halo superior
  e aresta azul bebê `#57B6F0` central
- **Usos**: app icon (240/120/60/29), splash, lockup horizontal (ícone + wordmark +
  tagline "DEFESA CIVIL DIGITAL"), cabeçalhos, notificação, watermark do laudo
- Reference no canvas: frame "Logomarca v3 · TCS Lettermark em Vidro"

## 5. Escopo — 18 telas (todas as telas do app)

| # | Tela | Rota real (Expo) |
|---|---|---|
| 01 | Splash (lettermark vertical + RiskBar + boot) | `app/onboarding.tsx` |
| 02 | Login (biometria, Google, e-mail/WhatsApp em breve) | `(auth)/login.tsx` |
| 03 | Criar conta (3 etapas, força de senha, termos) | `(auth)/register.tsx` |
| 04 | Verificar código OTP (6 caixas, reenvio) | `(auth)/verify-otp.tsx` |
| 05 | Recuperar senha (info card, link temporário) | `(auth)/forgot-password.tsx` |
| 06 | Planos (segmented mensal/anual, Municipal destacado) | `(auth)/planos.tsx` |
| 07 | Início (KPIs 2×2 com delta/sparkline, agenda do dia, alerta R4) | `(panel)/dashboard.tsx` |
| 08 | Agendamentos (search, filtros, lista por dia) | `(panel)/agendamentos/index.tsx` |
| 09 | Detalhe do agendamento (hero, infos, mini-mapa, checklist, CTA fixo) | `(panel)/agendamentos/[id].tsx` |
| 10 | Novo agendamento (endereço validado, tipo, data/hora chips) | novo formulário |
| 11 | Vistorias (KPIs, filtros com dot de risco, lista com tile R1–R4) | `(panel)/inspecoes/index.tsx` |
| 12 | Wizard de vistoria (pergunta N/18, opções grandes, GPS, fotos 2/6) | `inspecoes/wizard` |
| 13 | Resultado de risco (veredito R3, gauge, fatores, assinatura, laudo) | `inspecoes/resultado.tsx` |
| 14 | Mapa tático (pinos R1–R4, legenda, card do pino, controles) | `(panel)/mapas.tsx` |
| 15 | Avisos (prioridade primeiro, não lidos, categorias) | `(panel)/avisos/index.tsx` |
| 16 | Módulos (grade 2 col, perfil resumido, modo treinamento) | `(panel)/modulos.tsx` |
| 17 | Perfil (stats, toggles iOS, segurança, sair) | `(panel)/perfil.tsx` |
| 18 | Assinatura (plano, uso 6/10, faturas, gerenciar) | `(panel)/assinatura.tsx` |

Agrupamento no canvas: **Grupo A** (01–06 Entrada) · **Grupo B** (07–10 Painel) ·
**Grupo C** (11–14 Campo) · **Grupo D** (15–18 Conta) — containers horizontais com caption.

## 6. Não-goals / anti-goals

- Não dark-first; sem esmeralda em qualquer lugar; sem ícone decorativo em campo;
  sem FAB; sem mascote/animal no logo; sem badge/pill decorativo sem função;
  não repetir o erro de largura de texto (textGrowth fixed-width sempre que quebrar linha).

## 7. Como será feito (método)

1. Variáveis iOS criadas no canvas (uma vez, fonte única).
2. Containers dos 4 grupos com captions.
3. Telas construídas em lotes (2–3 por chamada `execute`), helpers compartilhados,
   `TakeScreenshot` por lote + varredura de problemas (`ctx.problems`) corrigida no ato.
4. `spawn_agents` permitido com **no máximo 1 agente por vez** (3 em paralelo derrubaram o Pen antes).
5. Cada tela verificada contra os anti-goals antes de avançar.

## 8. Resoluções do builder check (calls do builder — conferir ao ler)

- **Escopo**: "todas as telas" = a tabela de 18 da §5 (o app tem ~40 rotas; o resto segue outro ciclo)
- **Tab bar**: 4 abas Início/Vistorias/Avisos/Módulos (agente), com a aba correta em destaque por tela; Mapa e Perfil acessados via Módulos
- **Sem mascote em nenhum lugar** (EmptyState v1 usava a coruja — sai tudo)
- **Biometria (tela 02)**: feature futura — desenhada conforme spec, sem paridade com o código atual
- **Gauge do resultado (13)**: barra horizontal segmentada estilo RiskBar (schema .pen não tem arcos)
- **Assinatura (13)**: placeholder com fonte manuscrita Google (Caveat)
- **Fotos/mapas (09, 12, 14)**: placeholders com gradiente + mapa esquemático com pinos
- **Device**: 393×852 (iPhone 15 Pro) · status 59px · home 34px
- **Fills de risco suaves**: 12% do valor cheio sobre branco
- **Sparkline**: barras arredondadas 4px na cor do tint
- **Kerning do lettermark**: letter-spacing negativo ajustado por escala
- **Duas faixas de azul**: `#5AC8FA` (tint/CTA) e `#57B6F0` (aresta do logo) — cada uma no seu contexto

---

**Aprovação:** construir no canvas somente após ✅ do Pedro neste documento.
