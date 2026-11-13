# Design — Identidade Visual TCS (Graphite Esmeralda + Coruja Sentinela)

**Data:** 2026-10-17 · **Status:** Aprovado por Pedro (escolha em canvas pen.dev com 3 variações de UI e 3 de mascote)
**Canvas de referência:** `~/.pencil/documents/dda501f6-…/untitled.pen` (boards V1/V2/V3, mascotes, kit de ícones)

---

## Intenção

Fixar a identidade visual oficial do ecossistema TCS (Console web, Portal, app Expo e bot WhatsApp) sobre o padrão **2.0 "Graphite" já aprovado em preview**, eliminando a deriva de padrão apontada pelos 3 reviews (QA Design 84/100, UI/UX, Tech Lead 4,1/5).

## Decisões (feitas pelo dono, no canvas)

1. **Direção de UI oficial: V1 · Graphite Esmeralda** (dark-first).
2. **Mascote oficial: Coruja Sentinela** (vigilância 24h) — gerar paleta adaptada ao Graphite (plumagem zinco-escura + acentos esmeralda, capacete amarelo mantido).
3. Kit de ícones: **lucide** (o mesmo set já usado em lucide-react no web/mobile) — mapeamento dos 12 módulos no canvas.

## Tokens oficiais (fonte: `dashboard/src/index.css`, tema dark)

| Token | Valor |
|---|---|
| bg | `#09090B` |
| card | `#111114` |
| border | `rgba(255,255,255,.07)` |
| accent (esmeralda) | `#10B981` (+ glow `#10B98155`) |
| texto | `#F4F4F5` / secundário `#A1A1AA` |
| warning / risk | `#F59E0B` / `#EF4444` (versões `-soft` com alpha ~12%) |
| fonte | Inter (`@fontsource/inter`), números `tabular-nums` |
| raio | cards 1.25rem (`--radius`); scale 8/12/16/20 px |

## Padrões de composição (validados no board V1)

- Página: `page-stack` → `PageHeader` (eyebrow uppercase esmeralda + título + descrição + actions) → `AsyncBoundary` (timeout 15s) → KPI row → fila de decisões → tabela.
- **KPI Tremor (MetricTile 2.0):** label 12 · valor 28 bold · delta pill (↑↓→) com `-soft` · nota "vs semana anterior" · sparkline SVG 20px.
- **Fila de decisões (Linear-style):** tile de ícone 34px `accentSoft` + título 13/600 + descrição 12 muted + badge pill com dot + timestamp.
- **Tabela premium:** header `bg-muted/40` uppercase 11 tracking, avatar gradiente, badge de status com dot, valores `tabular-nums` pt-BR.
- Botão primário com glow esmeralda; ativo na sidebar com fundo `accentSoft` + texto claro.

## Mascote — uso previsto

App icon/splash, empty states com glow, onboarding do Portal, assinatura do bot WhatsApp, header do Console. Nome de exibição sugerido: **"Coruja"** (confirmar apelido com Pedro).

## Sistema de design por superfície (definido 17/10/2026, canvas pen.dev)

Cada superfície tem linguagem própria — nada de template repetido:

| Superfície | Linguagem | Tipografia | Elemento dominante por tela |
|---|---|---|---|
| **Console** (instrumento) | Technical Phosphor: rail fino de ícones, barra de comando com breadcrumb mono, hairlines, glow só com papel de sinal | Space Grotesk (títulos) · Inter (corpo) · IBM Plex Mono (dados, IDs, SLAs, timestamps) | 1 centro de atenção por tela |
| **Portal** (ceramic tátil) | Ceramic Console claro: controles elevados com sombra difusa, wells rebaixados, chips de plano | Hanken Grotesk (títulos) · Inter · IBM Plex Mono (dados) | banner de cobrança / mapa / documento |
| **App Expo** (campo) | Graphite escuro com banner offline âmbar, quick actions grandes | Inter + mono | tarefa atual |
| **Públicas** | Documento centrado sobre glow radial | Space Grotesk | o documento + ação única |

### Inventário de telas no canvas (14 composições)

**Console:** Login (coruja + Turnstile) · Dashboard instrumento de comando (fila "Atenção agora" com SLA mono) · Clientes (tabela densa + chips filtro + bulk bar) · Cliente Detalhe (dossiê: gauge R3, fotos IMG_00xx, QE, instrumentos) · Assinaturas (pipeline trial→ativa→grace→past due + comprovantes PIX) · WhatsApp (inbox 3 zonas: lista/thread/contexto) · Auditoria (log mono denso, sensitive.access em âmbar) · Formulários (editor 3 painéis, templates globais, chips R1-R4) · Analytics (hero 1.284, QE donut 78%, ranking, p50/p95)

**Portal:** Dashboard (saudação, banner fatura, widgets) · Mapa full-bleed (ruas/rio/pinos R1-R4, painel flutuante) · Cobrança (fatura-documento, stepper 4 estados, upload com hash)

**Mobile Expo:** Dashboard vistoriador (banner offline) · Vistoria wizard (fotos, GPS 4m, sync pendente) · Laudo (badge R3, assinatura, PDF/WhatsApp)

**Pública:** Ciência de Documento (código de 6 dígitos, hash, MP 2.200-2/2001)

### Brand
- Símbolo: escudo hexagonal + face de coruja (SVG gerado) · App icon: gradiente #047857→#10B981, raio 24 · Sidebar: 32px
- Biblioteca de ícones: 155 lucide mapeados (renames do set atual: funnel, circle-question-mark, lock-open, ellipsis, send-horizontal, text-align-start, chart-column, house)

**Exports:** PNGs 2x em `~/.pencil/documents/dda501f6-…/exports/`

## Metas

- Toda tela nova nasce 2.0 usando as primitivas nomeadas (MetricTile, DataTable premium) — ver P2 do diagnóstico consolidado.
- Extender governança por teste: contraste AA dos pares `*/*-foreground` nos 6 temas + paridade de hex mobile (`constants/Colors.ts`) × HSL web no CI.

## Não-metas / anti-metas

- Não substituir o lucide por outro set; não introduzir paleta nova fora dos tokens.
- Não aplicar o padrão a telas legadas sem passar pelo plano de migração (PageHeader etc.).
- SEM padrão Gov Brasil (regra do projeto); nunca Google Maps no web.

## Pendências de produto (decisão do Pedro)

- [ ] CPF no Termo de Interdição: formalizar exceção LGPD ou remover (bloqueador do fluxo).
- [ ] Regra de mapas no app nativo: atualizar CONTEXT.md ou reverter para OSM.
- [ ] Destino das 7 páginas órfãs do dashboard.
- [ ] Confirmar apelido/nome oficial da Coruja.
