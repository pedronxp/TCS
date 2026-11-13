---
description: Gera preview HTML estático no padrão 2.0 Graphite antes de implementar no código real
agent: build
---

Gere um **preview estático navegável** (HTML/CSS/JS puro num único arquivo, zero dependências além de Google Fonts Inter) para: $ARGUMENTS

Regras do preview (padrão 2.0 Graphite aprovado — ver skill `tcs-console`):
- Dark-first: bg #09090B, cards #111114, bordas rgba(255,255,255,.07), accent emerald #10B981 com glow; toggle de tema claro/escuro
- Layout: sidebar com indicador glow na rota ativa, topbar com breadcrumbs, router por hash
- Componentes: KPI Tremor (valor + delta pill + sparkline SVG com gradiente), área chart com gradiente e glow nos pontos, bar list animada, donut com shadow, feed de decisões Linear-style, tabela premium com avatares gradiente e bulk bar, command palette ⌘K com grupos (Páginas/Clientes/Ações), toasts, skeleton shimmer, empty state com glow e CTA
- Conteúdo em pt-BR com dados realistas do TCS (vistorias, municípios Ubá/Cataguases/Astolfo Dutra, SLA, implantação, WhatsApp/IA)
- Micro-interações: fade-up entre rotas, hover-lift nos cards, `@media (prefers-reduced-motion)` respeitado

Salve em `preview-tcs/index.html`, sirva com `python -m http.server` numa porta livre e abra no navegador para eu validar ANTES de implementar no código real. Ao final, liste as decisões de design que eu preciso aprovar.
