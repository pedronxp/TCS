---
name: TCS Console
description: Criar, revisar e validar páginas e rotas do TCS Console (web owner/staff) e do Portal do cliente, seguindo o design system real, a governança de rotas (route-manifest) e o padrão 2.0 Graphite aprovado em preview. Use ao criar telas novas, revisar aderência visual ou registrar rotas no dashboard.
---

# TCS Console — Padrão de desenvolvimento web

Você está trabalhando no ecossistema TCS (vistorias técnicas / defesa civil). O web tem 3 versões: **Console interno** (`dashboard/src/PrivateApp.tsx` — owner/developer/support/auditor), **Portal do cliente** (`dashboard/src/PortalApp.tsx` — individual/municipal) e **páginas públicas** (`dashboard/src/App.tsx`).

## Regras absolutas (violá-las invalida o trabalho)

1. **TUDO PERGUNTA ANTES** — nunca assumir defaults de produto; confirmar com Pedro.
2. **Nunca usar CPF** em tela, model ou banco.
3. Mapas: **OSM/Leaflet ou MapLibre** — nunca Google Maps.
4. Escrita em `formularios`/`atribuicoes` **somente via RPC** — nunca insert direto.
5. Salvar arquivos **sempre em UTF-8** (acentos corretos).
6. Novos pacotes: **perguntar antes** (preferir composição com o que já existe: recharts, cmdk, sonner, TanStack Table, Radix).

## Workflow — nova página no CONSOLE (`/app/*`)

Arquivos obrigatórios (o build **quebra** se faltar qualquer um):

1. **Página** — `dashboard/src/pages/NovaPage.tsx`
2. **Rota** — `dashboard/src/PrivateApp.tsx`: `<Route path="nova-rota" element={<ProtectedRoute requirePermission="X"><NovaPage /></ProtectedRoute>} />`
3. **Manifest** — `dashboard/design/route-manifest.mjs`:
```js
route({
  id: 'nova-rota', path: '/app/nova-rota', audience: ['owner'],
  permission: 'X', template: 'listing', penpot: '04 · Clientes',
  approvalStatus: 'approved-in-penpot',
  visualSource: 'Penpot/TCS — Web Dashboard/04 · Clientes',
  automatedVisualBaselines: null,
}),
```
   - `template` ∈ `public-page, authentication, dashboard, listing, context-detail, timeline, editor, settings, technical-operation, design-reference`
   - `states`: incluir `loading, empty, error, retry, success, permission-denied`
4. **Menu** — `dashboard/src/config/navigation.ts` (OWNER_NAVIGATION e/ou DEVELOPER_NAVIGATION): `{ to: '/app/nova-rota', label: '…', icon: <lucide>, permission: 'X' }`

Validar: `cd dashboard && npm run design:validate` (cruza router × manifest) → `npm run build`.

## Workflow — nova página no PORTAL (`/portal/*`)

1. Página em `dashboard/src/pages/portal/`
2. **2 rotas** em `PortalApp.tsx` (individual + municipal) com `<PortalRoute kind=… permission=…>`
3. **1 linha** em `portalNavigation.ts` (array `modules`) — cobre os dois perfis via `${root}/${path}`
4. **2 entries** no manifest com `portalRoute()` (estados extras: `trial, active, grace, past-due, cancel-at-period-end, canceled, expired, plan-locked`)
5. Guardas do `PortalRoute` redirecionam suave (nunca tela de "negado")

## Design system (produção — tokens vigentes)

- Fonte **Inter**; raio cards `--radius: 1.25rem`; ícones **lucide-react** com `aria-hidden`.
- Tokens semânticos: `success 142 71% 45%` (+`-soft`), `warning 38 90% 40%`, `info 210 70% 42%`, risco `--risk-r1..r4`.
- Padrão de página: `<div className="page-stack space-y-6">` → `PageHeader` (eyebrow uppercase + título + descrição + actions) → `AsyncBoundary` (loading/empty/error/retry, timeout 15s) → métricas em Card com tiles coloridos → Card com toolbar `bg-muted/30` → Table (`bg-muted/40` no header, hover `muted/40`).
- Números **sempre** `tabular-nums` + `toLocaleString('pt-BR')`; datas via `Intl` pt-BR.
- Animações: CSS + `motion-reduce:animate-none`; foco visível; aria-labels em todo ícone-botão.
- Dados: `useQuery` com queryKey única + RPC `get_internal_*` (console) ou `portal_get_*`/Edge Functions (portal), narrowing defensivo do retorno.
- Referência viva: `/app/referencia-ui` (StyleGuidePage).

## Padrão 2.0 "Graphite" (aprovado em preview — usar nas telas NOVAS)

- **Dark-first**: bg `#09090B`, cards `#111114`, bordas `rgba(255,255,255,.07)`, accent emerald `#10B981` com glow; tema claro como toggle.
- **KPI Tremor**: label / valor grande / delta pill ↑↓→ / nota / sparkline SVG com gradiente.
- **Bento grid** no dashboard; área chart com gradiente + glow nos pontos; **bar list** animada; donut com shadow.
- **Fila de decisões** (feed Linear-style): ícone tile + título + descrição + badge de ação + timestamp.
- Tabela premium: avatares gradiente, bulk action bar, badges soft-tinted com dot; **usar @tanstack/react-table** (já instalado).
- **⌘K global** via cmdk (já instalado): grupos Páginas/Clientes/Ações.
- Micro-interações: fade-up entre rotas, hover-lift em cards, glow no item ativo.
- Estados: skeleton shimmer, empty com glow + CTA, erro com retry e log anexado.

## Permissões existentes (InternalPermission)

`dashboard.executive.read · dashboard.technical.read · customer.read · commercial.read · protocol.read · token.manage · technical.write · technical.read · build.request · console.read · communication.manage · whatsapp.read · ia.read · support.read · staff.read · session.read · audit.read`

Portal (`PortalPermission`): `dashboard.read · inspection.read · map.read · appointment.read · document.read · report.read · usage.read · billing.read · support.read · profile.read · communication.read · whatsapp.read · team.read · invite.agent · settings.read`

## Documentação de apoio (ler quando necessário)

- `dashboard/docs/GUIA-NOVAS-ROTAS-E-PAGINAS.md` — passo a passo + template completo de página
- `dashboard/docs/MAPA-WEB-CONSOLE-PORTAL.md` — mapa das 3 versões + diferenças Console × Portal
- `dashboard/docs/MAPA-TELAS-COMPLETO.md` — todas as telas (mobile + web)
- Raiz do repo: `CONTEXT.md` (regras do ecossistema), `PDR.md` (roadmap + bugs conhecidos)

## Checklist final antes de entregar

- [ ] Rota registrada nos 3–4 lugares (router + manifest + menu [+ portal: 2 rotas])
- [ ] `npm run design:validate` passa
- [ ] Estados loading/empty/error/retry implementados com `AsyncBoundary`
- [ ] A11y: aria-labels, foco, contraste, `motion-reduce`
- [ ] UTF-8 sem mojibake; pt-BR em Intl/labels
- [ ] Teste `NovaPage.test.tsx` cobrindo render/empty/erro
