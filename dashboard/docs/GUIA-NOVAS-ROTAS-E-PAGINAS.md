# Guia oficial — Criar novas rotas e páginas no TCS Console (dashboard/)

> Base: código real em `TCS/dashboard/` · Stack: **Vite + React 18 + TypeScript + Tailwind + shadcn/Radix + React Query + React Router v7 + Supabase (RPC)** · Tema: light/dark com tokens semânticos · Idioma: pt-BR.
> Regra de ouro: **toda página nova deve parecer nativa do sistema** — este guia garante isso.

---

## 1. Os 4 arquivos que TODA nova rota exige

| # | Arquivo | O que fazer |
|---|---|---|
| 1 | `src/pages/NovaPage.tsx` | Criar o componente da página (use o template da seção 6) |
| 2 | `src/PrivateApp.tsx` | Registrar a rota com `ProtectedRoute` + permissão |
| 3 | `design/route-manifest.mjs` | **Obrigatório** — governança. O build (`npm run design:validate`) **falha** se a rota existir no router e faltar no manifest (e vice-versa) |
| 4 | `src/config/navigation.ts` | Item de menu em `OWNER_NAVIGATION` e/ou `DEVELOPER_NAVIGATION` |
| 5 | `supabase/` (só se tiver dados) | RPC `get_internal_*` retornando `{items, summary}` |

### 2. Registrando a rota (PrivateApp.tsx)

```tsx
// 1) import no topo, junto dos outros
import { OnboardingPage } from '@/pages/OnboardingPage';

// 2) dentro de <Route path="/app" element={<ProtectedConsole />}>...</Route>
<Route path="implantacao" element={<ProtectedRoute requirePermission="customer.read"><OnboardingPage /></ProtectedRoute>} />
```

- Rotas internas usam path **relativo** a `/app` (ex.: `implantacao` → URL `/app/implantacao`).
- `requirePermission` é `InternalPermission` — negações são **auditadas automaticamente** (`record_internal_access_denied`).
- Rotas dinâmicas: `path="implantacao/:recordId/:section?"` — registre a genérica **antes** de caminhos mais específicos quando houver conflito (veja a ordem de `clientes`).

### 3. Entrada no manifest de governança (design/route-manifest.mjs)

```js
route({
  id: 'onboarding-tracker',                      // único, sem duplicar
  path: '/app/implantacao',                      // absoluto, com /app
  audience: ['owner', 'developer'],              // quem usa
  permission: 'customer.read',
  template: 'listing',                           // um de routeTemplates (abaixo)
  penpot: '04 · Clientes',                       // referência visual (qualquer frame existente do módulo)
  approvalStatus: 'approved-in-penpot',           // gate visual Penpot (sem screenshots)
  visualSource: 'Penpot/TCS — Web Dashboard/04 · Clientes',
  automatedVisualBaselines: null,                 // null + approved-in-penpot = não exige baselines PNG
}),
```

**O validador exige** (`scripts/validate-route-manifest.mjs`):
- `id` único; `path` absoluto; `template` ∈ `routeTemplates` = `public-page, authentication, dashboard, listing, context-detail, timeline, editor, settings, technical-operation, design-reference`
- `audience` não vazio; `penpot` string; `states` array; `breakpoints` **[1440, 1024, 768, 390]**; `approvalStatus`
- Se `automatedVisualBaselines` for caminho, os PNGs precisam existir em `tests/visual/__screenshots__/...` — por isso novas telas usam `null` + `approved-in-penpot` + `visualSource: 'Penpot/...'`
- **Cruzamento**: todo `<Route path>` declarado precisa estar no manifest e todo path do manifest precisa estar declarado. Esqueça um dos dois → build quebra.

### 4. Item de menu (src/config/navigation.ts)

```ts
import { Rocket } from 'lucide-react';   // ícone lucide-react

// em OWNER_NAVIGATION, no grupo certo:
{ to: '/app/implantacao', label: 'Implantação', icon: Rocket, permission: 'customer.read' },
```

- A sidebar filtra por `permission` do perfil — item sem permissão simplesmente não aparece.
- Grupos colapsáveis guardam estado por `label` no localStorage — **não renomeie labels de grupo à toa**.
- Se for tela só de desenvolvedor, adicione em `DEVELOPER_NAVIGATION`.

### 5. Catálogo de permissões (InternalPermission) já usadas

`dashboard.executive.read` · `dashboard.technical.read` · `customer.read` · `commercial.read` · `protocol.read` · `token.manage` · `technical.write` · `technical.read` · `build.request` · `console.read` · `communication.manage` · `whatsapp.read` · `ia.read` · `support.read` · `staff.read` · `session.read` · `audit.read` · `notification.manage` (avisos usa `technical.write` no router hoje — manter consistência ao reusar)

> Precisa de uma permissão NOVA? Adicione em `src/types/internal.ts` e garanta que o perfil tenha no banco (`get_internal_staff_profile`).

---

## 6. TEMPLATE de página de listagem (copiar e renomear)

Padrão `DevicesPage`: header → métricas → card com filtros → tabela → estados assíncronos.

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, RefreshCw, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { PageHeader } from '@/components/domain/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

type ItemRow = { id: string; nome: string; status: string; atualizadoEm: string };
type Workspace = { items: ItemRow[]; summary: { total: number; pendentes: number } };

export function OnboardingPage() {
  const [busca, setBusca] = useState('');
  const query = useQuery({
    queryKey: ['internal-onboarding', busca],
    queryFn: () => loadOnboarding(busca),
    refetchInterval: 30_000,
  });

  return (
    <div className="page-stack space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Implantação"
        description="Acompanhe clientes em onboarding, etapa a etapa, sem depender de planilha."
        actions={<Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={cn(query.isFetching && 'animate-spin motion-reduce:animate-none')} />
          {query.isFetching ? 'Atualizando…' : 'Atualizar'}
        </Button>}
      />

      <AsyncBoundary
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        loadingLabel="Carregando implantações…"
        empty={query.data?.items.length === 0}
      >
        {query.data && <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo">
            <Metric label="Em implantação" value={query.data.summary.total} icon={Rocket} tone="success" />
            <Metric label="Pendências" value={query.data.summary.pendentes} icon={Rocket} tone="warning" />
          </section>

          <Card className="overflow-hidden shadow-none">
            <div className="flex flex-col gap-4 border-b bg-muted/30 p-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-base font-bold">Clientes em implantação</h2>
                <p className="mt-1 text-xs text-muted-foreground">Atualização automática a cada 30 segundos.</p>
              </div>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente" className="lg:w-[320px]" />
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-6">Cliente</TableHead><TableHead>Estado</TableHead><TableHead>Última atividade</TableHead><TableHead className="pr-6 text-right">Ação</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {query.data.items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/40">
                      <TableCell className="pl-6 font-semibold">{item.nome}</TableCell>
                      <TableCell><Badge variant={item.status === 'pendente' ? 'warning' : 'success'}>{item.status}</Badge></TableCell>
                      <TableCell className="text-sm">{item.atualizadoEm}</TableCell>
                      <TableCell className="pr-6 text-right"><Button asChild variant="outline" size="sm"><Link to={`/app/clientes/organizacoes/${item.id}`}>Abrir cliente<ArrowRight aria-hidden="true" /></Link></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>}
      </AsyncBoundary>
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone = 'default' }: { label: string; value: number; icon: typeof Rocket; tone?: 'default' | 'success' | 'warning' | 'info' }) {
  const iconClass = tone === 'success' ? 'bg-success-soft text-success' : tone === 'warning' ? 'bg-warning-soft text-warning' : tone === 'info' ? 'bg-info-soft text-info' : 'bg-primary/10 text-primary';
  return <Card className="shadow-none"><CardContent className="flex items-center gap-3 p-5">
    <span className={cn('grid h-10 w-10 place-items-center rounded-xl', iconClass)}><Icon className="h-5 w-5" /></span>
    <div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString('pt-BR')}</p></div>
  </CardContent></Card>;
}

async function loadOnboarding(busca: string): Promise<Workspace> {
  const { data, error } = await (supabase.rpc as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>)('get_internal_onboarding_workspace', {
    p_search: busca.trim() || null,
    p_limit: 200,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('onboarding_workspace_invalid');
  const root = data as Record<string, unknown>;
  const items = Array.isArray(root.items) ? root.items.filter((i): i is Record<string, unknown> => Boolean(i) && typeof i === 'object').map((i) => ({
    id: typeof i.id === 'string' ? i.id : crypto.randomUUID(),
    nome: typeof i.nome === 'string' ? i.nome : 'Sem nome',
    status: typeof i.status === 'string' ? i.status : 'desconhecido',
    atualizadoEm: typeof i.atualizado_em === 'string' ? i.atualizado_em : '—',
  })) : [];
  const summary = (root.summary && typeof root.summary === 'object' ? root.summary : {}) as Record<string, unknown>;
  return { items, summary: { total: typeof summary.total === 'number' ? summary.total : 0, pendentes: typeof summary.pendentes === 'number' ? summary.pendentes : 0 } };
}
```

---

## 7. Design tokens (o "mesmo design" em números)

| Token | Light | Uso |
|---|---|---|
| `--primary` | `0 0% 9%` (#171717) | texto forte, ícone ativo |
| `--success / -soft` | `142 71% 45%` / `142 50% 96%` | estados positivos (Badge success, tile verde) |
| `--warning / -soft` | `38 90% 40%` / `38 80% 95%` | atenção/pendências |
| `--info / -soft` | `210 70% 42%` / `210 60% 96%` | informativo |
| `--radius` | `1.25rem` | cards e diálogos |
| fonte | Inter (@fontsource/inter, 400–800) | global |

Regras de estilo vigentes (extraídas das páginas reais):
- Root: `<div className="page-stack space-y-6">`
- Título de card: `text-base font-bold` · subtítulo `text-xs text-muted-foreground`
- Cabeçalho de tabela: `bg-muted/40 hover:bg-muted/40` · células `hover:bg-muted/40`
- Números: **sempre** `tabular-nums` + `toLocaleString('pt-BR')`
- Ícones: `lucide-react`, `aria-hidden="true"`, spin com `motion-reduce:animate-none`
- Ações: `Button asChild` + `Link` para navegação; toasts via `sonner` (Toaster já está no provider)
- Foco visível e aria-labels em TODOS os controles iconográficos

## 8. Estados assíncronos — AsyncBoundary (obrigatório)

`<AsyncBoundary loading error empty onRetry loadingLabel emptyTitle emptyDescription>` entrega:
- **loading** com skeleton (e **timeout de 15s → falha explícita com retry** — nunca girar para sempre)
- **error** com mensagem + "Tentar novamente"
- **empty** com título/descrição customizáveis

Estados cobertos no manifest: `loading, empty, error, retry, success, permission-denied` (+ estados de plano no portal).

## 9. Testes e validação

```bash
cd dashboard
npm run design:validate   # governança: manifest × rotas × baselines
npm run build             # tsc -b + vite build (inclui design:validate)
npm test                  # vitest (+ design:validate antes)
```

- Convenção: `src/pages/NovaPage.test.tsx` — cubra: render com dados, empty, erro, e CTA de retry (veja `DevicesPage`/`SessionsPage` e vizinhos como referência).
- Encoding: salve **sempre em UTF-8** (acentos!). Arquivos mojibake (`Ã§`, `â€”`) já foram detectados em partes antigas do repo — não copie desses trechos.

## 10. Pegadinhas (learned the hard way)

1. Esqueceu o manifest → `npm run build` quebra no `design:validate` com mensagem exata do que falta.
2. `automatedVisualBaselines` com caminho inexistente → falha por breakpoint (use `null` + `approved-in-penpot`).
3. Permissão nova não tipada → erro de TS em `ProtectedRoute`.
4. Rota dinâmica genérica depois da específica → React Router v7 casa a errada.
5. `visualSource` DEVE começar com `Penpot/`.
6. Menu some? Permissão do perfil não contempla o item — cheque `get_internal_staff_profile`.

---

## 11. Backlog sugerido de novas rotas (pronto para executar)

| Rota proposta | Uso | Permissão | Template manifest |
|---|---|---|---|
| `/app/implantacao` | Tracker de onboarding (hoje só um card no dashboard) | `customer.read` | `listing` |
| `/app/notificacoes` | Central de notificações do console (sino 9+) | `console.read` | `listing` |
| `/app/configuracoes` | Configurações do console (branding, integrações) | `configuration.publish` | `settings` |
| `/app/comando` | Command palette global (⌘K) | `console.read` | `design-reference` |
| `/app/suporte/metricas` | Métricas de SLA (view extra do Suporte) | `support.read` | `dashboard` |

Cada uma = 4 edits (página, rota, manifest, menu) + RPC opcional — tudo documentado acima.
