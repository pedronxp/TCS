# MAPA WEB COMPLETO — TCS Dashboard (Console · Portal · Público)

> Fonte: código real em `TCS/dashboard/` · Complementa o `GUIA-NOVAS-ROTAS-E-PAGINAS.md`
> Escopo pedido: **somente web** — console (owner e demais perfis) + portal dos clientes + páginas públicas.

---

## 1. Como as 3 versões web se montam (`src/App.tsx`)

```
BrowserRouter
├── /auth/callback                       → AuthCallbackPage (com ErrorBoundary)
├── PublicLayout
│   ├── /                               → CommercialPage (landing comercial)
│   └── /planos                         → PlansCatalogPage (catálogo público)
├── PrivateAppShell  (/login, /app/*)    → CONSOLE INTERNO (owner/developer/support/auditor)
└── PortalApp (fallback /*)             → PORTAL CLIENTE + auth pública
    ├── /entrar · /criar-conta · /recuperar-senha · /redefinir-senha
    ├── /convite/:token (aceite de convite municipal)
    ├── /checkout/retorno · /ciencia/:token (ciência eletrônica por link)
    ├── /portal/individual/*            → portal de pessoa/conta individual
    ├── /portal/municipal/*             → portal de organização/município
    └── * → redirect /entrar
```

- `PrivateApp` e `PortalApp` são `lazy` (code-split) — cada versão carrega só o seu bundle (arquivos `PrivateApp-*.js` e `PortalApp-*.js` no dist).
- Providers próprios por versão: Console usa `AuthProvider`+`QueryClient(staleTime 30s)`; Portal usa `PortalAuthProvider`+`QueryClient(staleTime 20s, refetchOnWindowFocus)`. Ambos com `Toaster` (sonner, top-right, richColors).

---

## 2. CONSOLE INTERNO — `/app/*` (owner, developer, support, auditor)

### 2.1 Menu por perfil (`src/config/navigation.ts`)
Grupos OWNER: **Principal** (Visão executiva · Clientes · Suporte) · **Negócio** (Indicadores · Planos · Assinaturas · Faturas · Analytics · Protocolos) · **Comunicação** (Avisos · Mensagens · Comunicados) · **WhatsApp & IA** (WhatsApp Bot · IA & Automação) · **Formulários** · **Administração** (Staff · Tokens · Sessões · Dispositivos · Auditoria).
Grupos DEVELOPER: dashboard vira **"Saúde técnica"** + grupo **Desenvolvimento** (Versões · Builds · Formulários · Regras de risco · Sincronização · Armazenamento · Logs e erros).
Itens sem permissão somem; grupos colapsáveis persistem por label no localStorage.

### 2.2 Rotas do console (`src/PrivateApp.tsx`) — as que o menu não mostra
- `clientes/organizacoes/:recordId/:section?` e `clientes/contas/:recordId/:section?` — detalhe por tipo
- `protocolos/:inspectionId/{laudo|relatorio|termo|fotos}` — workspace de documentos da vistoria
- `desenvolvimento/versoes|builds|regras-risco|sincronizacao|armazenamento|logs` (developer)
- `referencia-ui` — **Style Guide vivo** (Foundations · Motion · Components)
- Redirecionamentos legados preservados (`clientes/:id` → novo formato)

### 2.3 A vistoria no console (lado owner/staff)
```
/app/protocolos          → ProtocolsPage (registro, pesquisa por série municipal)
/app/protocolos/:id      → ProtocolInspectionPage (detalhe da vistoria)
/app/protocolos/:id/laudo|relatorio|termo|fotos → ProtocolDocumentWorkspacePage (editor/workspace de documento)
```
Permissão: `protocol.read` · Audiência: owner, developer, support, auditor · Templates manifest: `listing` → `context-detail` → `editor`.

---

## 3. PORTAL DO CLIENTE — `/portal/*` (individual + municipal)

### 3.1 Navegação (`src/config/portalNavigation.ts`)
Grupos: **Operação** (Visão geral · Vistorias · Mapa · Agenda · Documentos · Ciências · Relatórios · Comunicados · WhatsApp) · **Gestão** (Equipe · Convites · Consumo · Assinatura · Configurações) · **Conta e suporte** (Suporte · Mensagens · Perfil).

| Seção | Individual | Municipal | Permissão (PortalPermission) |
|---|---|---|---|
| Visão geral (dashboard) | ✅ | ✅ | `dashboard.read` |
| Vistorias (+ `:inspectionId`) | ✅ | ✅ | `inspection.read` |
| Mapa (lazy + Suspense) | ✅ | ✅ | `map.read` |
| Agenda | ✅ | ✅ | `appointment.read` |
| Documentos / Ciências | ✅ / ✅ | ✅ / ✅ | `document.read` |
| Relatórios | ✅ | ✅ | `report.read` |
| Consumo | ✅ | ✅ | `usage.read` |
| Assinatura (billing) | ✅ | ✅ | `billing.read` |
| Suporte / Mensagens / Perfil | ✅ | ✅ | `support.read` / `profile.read` / `profile.read` |
| Comunicados | — | ✅ | `communication.read` |
| WhatsApp | — | ✅ | `whatsapp.read` |
| Equipe (+ `:memberId`) · Convites | — | ✅ | `team.read` / `invite.agent` |
| Configurações | — | ✅ | `settings.read` |

Módulos genéricos (vistorias/documentos/consumo) usam `PortalModulePage section="..."` — uma página, N seções.

### 3.2 Guardas do portal (`components/portal/PortalRoute.tsx`)
Ordem: loading (skeleton) → sem sessão → `/entrar?returnTo=` → sem acesso → `/entrar?status=sem-acesso` → accountKind errado → `portalHome(kind)` → vínculo inativo (municipal) → sem permissão → home do portal. **Sem tela de "permission denied" — sempre redirect suave.**

### 3.3 A vistoria no portal (lado cliente)
- Lista: `PortalModulePage section="vistorias"` → detalhe: `PortalInspectionPage`
- `PortalInspectionPage`: RPC `portal_get_inspection` (protocolo, status, risco R1-R4, score, endereço, agente, GPS) + documentos via **Edge Function `portal-inspection-document`** (URL assinada, modo `view`/`download`, com estado de erro explícito "Vistoria indisponível" quando fora do escopo)
- Padrão de estados local: skeleton dedicado (`InspectionSkeleton`), erro com `role="alert"`, botões com spinner próprio — **não usa AsyncBoundary** (padrão portal: estados inline por página)

---

## 4. PÚBLICO

`/` CommercialPage · `/planos` PlansCatalogPage (catálogo com preços) · `/entrar` `/criar-conta` (PortalAuthPage por `mode`) · `/convite/:token` InviteAcceptancePage (aceite municipal) · `/ciencia/:token` DocumentAcknowledgementLinkPage (ciência de documento por link — usado em laudos enviados) · `/checkout/retorno` CheckoutReturnPage.

---

## 5. Diferenças-chave Console × Portal (para criar página na versão certa)

| Aspecto | Console (`/app`) | Portal (`/portal`) |
|---|---|---|
| Shell | `ConsoleShell` + `AppSidebar` (colapsável, busca no menu) | `PortalShell` (nav própria, mobile bottom-bar com priorização) |
| Auth | `useAuth()` + `ProtectedRoute requirePermission` | `usePortalAuth()` + `PortalRoute kind permission` |
| Permissões | `InternalPermission` (types/internal) | `PortalPermission` (types/portal) |
| Dados | RPCs `get_internal_*` | RPCs `portal_get_*` + Edge Functions `portal-*` |
| Estados | `AsyncBoundary` (timeout 15s + retry) | Inline por página (skeleton/erro locais) |
| Manifest | `route()` (baselines obrigatórias) | `portalRoute()` (estados extras: trial/active/grace/past-due/cancel-at-period-end/canceled/expired/plan-locked) |
| Página nova — onde registra | `PrivateApp.tsx` + `navigation.ts` | `PortalApp.tsx` + `portalNavigation.ts` (2 shells: individual E municipal) |

**Regra prática para página nova no portal:** registre a rota **duas vezes** (individual + municipal), adicione o item em `modules` (uma linha cobre os dois perfis automaticamente via `${root}/${path}`), e declare **os 2 entries** no manifest (`portal-individual-...` e `portal-municipal-...`).

---

## 6. Checklist de qualidade web (aplicável às 3 versões)

1. Estados obrigatórios: `loading · empty · error · retry · success · permission-denied` (+ estados de assinatura no portal)
2. Breakpoints auditados: **1440 · 1024 · 768 · 390** (tabelas com `overflow-x-auto` + `min-w`)
3. Tokens semânticos (success/warning/info/-soft), `tabular-nums`, Intl pt-BR, `motion-reduce:animate-none`, aria-labels em ícones
4. Navegação via `Button asChild` + `Link` — nunca `href` cru
5. `npm run design:validate` antes de build — manifest × rotas é cruzado automaticamente
6. Referência viva: **`/app/referencia-ui`** (Style Guide) e `docs/GUIA-NOVAS-ROTAS-E-PAGINAS.md`
