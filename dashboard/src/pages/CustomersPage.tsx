import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Filter, Plus, Rocket, Search, UsersRound, X } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { OrganizationFormDialog } from '@/components/customers/OrganizationFormDialog';
import { IndividualClientDialog } from '@/components/customers/IndividualClientDialog';
import { BrazilMunicipalityPicker, BrazilStateSelect } from '@/components/BrazilMunicipalityPicker';
import { PageHeader } from '@/components/domain/PageHeader';
import { StatusBadge } from '@/components/domain/Badges';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomers } from '@/hooks/useCustomers';
import { customerDetailPath } from '@/lib/customerRoutes';
import { cn } from '@/lib/utils';

function formatActivity(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const elapsed = Date.now() - date.getTime();
  if (elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000) {
    return `Hoje, ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)}`;
  }
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const statusFilters = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'suspended', label: 'Suspensos' },
] as const;

export function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const rawStatus = params.get('status') ?? 'all';
  const status = ['all', 'active', 'onboarding', 'pilot', 'suspended', 'archived'].includes(rawStatus) ? rawStatus : 'all';
  const municipio = params.get('municipio') ?? '';
  const uf = params.get('uf') ?? '';
  const activityFrom = params.get('atividade_de') ?? '';
  const activityTo = params.get('atividade_ate') ?? '';
  const rawPage = Number(params.get('page') ?? '0');
  const page = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
  const navigate = useNavigate();
  const { can } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = useCustomers({ search, status: status === 'all' ? '' : status, municipio, uf, activityFrom, activityTo, page });
  const totalQuery = useCustomers();
  const onboardingQuery = useCustomers({ status: 'onboarding' });
  const pilotQuery = useCustomers({ status: 'pilot' });
  const activeQuery = useCustomers({ status: 'active' });
  const suspendedQuery = useCustomers({ status: 'suspended' });
  const newCustomer = params.get('novo');
  const creatingOrganization = (newCustomer === '1' || newCustomer === 'municipal') && can('customer.write');
  const creatingIndividual = newCustomer === 'individual' && can('customer.write');
  const pageCount = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.limit)) : 1;

  const totals = {
    all: totalQuery.data?.total ?? 0,
    onboarding: onboardingQuery.data?.total ?? 0,
    pilot: pilotQuery.data?.total ?? 0,
    active: activeQuery.data?.total ?? 0,
    suspended: suspendedQuery.data?.total ?? 0,
  };
  const activePercent = totals.all > 0 ? Math.round((totals.active / totals.all) * 100) : 0;
  const activeAdvancedFilters = Number(Boolean(uf)) + Number(Boolean(municipio)) + Number(Boolean(activityFrom)) + Number(Boolean(activityTo));
  const setStatusFilter = (nextStatus: string) => {
    const next = new URLSearchParams(params);
    if (nextStatus === 'all') next.delete('status');
    else next.set('status', nextStatus);
    next.delete('page');
    setParams(next);
  };
  const setSearchFilter = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    next.delete('page');
    setParams(next, { replace: true });
  };
  const setPageFilter = (nextPage: number) => {
    const next = new URLSearchParams(params);
    if (nextPage > 0) next.set('page', String(nextPage));
    else next.delete('page');
    setParams(next);
  };
  const setAdvancedFilters = (nextFilters: { uf: string; municipio: string; activityFrom: string; activityTo: string }) => {
    const next = new URLSearchParams(params);
    const pairs: Array<[string, string]> = [['uf', nextFilters.uf], ['municipio', nextFilters.municipio], ['atividade_de', nextFilters.activityFrom], ['atividade_ate', nextFilters.activityTo]];
    for (const [key, value] of pairs) { if (value) next.set(key, value); else next.delete(key); }
    next.delete('page'); setParams(next); setFiltersOpen(false);
  };
  const openCreate = (kind: 'municipal' | 'individual') => {
    const next = new URLSearchParams(params);
    next.set('novo', kind);
    setParams(next);
  };
  const closeCreate = () => {
    const next = new URLSearchParams(params);
    next.delete('novo');
    setParams(next, { replace: true });
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Carteira de clientes"
        title="Clientes"
        description="Encontre uma conta, entenda o momento operacional e intervenha antes que a implantação ou o acesso pare."
        actions={can('customer.write') ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus />
                Novo cliente
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openCreate('municipal')}>Organização municipal</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openCreate('individual')}>Conta individual</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : undefined}
      />

      <CustomerOverview totals={totals} activePercent={activePercent} />

      <Card className="bg-card/80 shadow-none">
        <CardContent className="flex flex-col gap-3 p-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1 xl:max-w-[460px]">
            <span className="sr-only">Buscar clientes</span>
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="Nome, município, contato ou identificador"
              className="h-11 border-0 bg-background pl-10"
            />
            {search && (
              <Button type="button" variant="ghost" size="icon" onClick={() => setSearchFilter('')} className="absolute right-2 top-1.5 h-8 w-8 text-muted-foreground" aria-label="Limpar busca">
                <X className="h-4 w-4" />
              </Button>
            )}
          </label>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={status === filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  'h-8 rounded-full border px-3 text-[11px] font-semibold transition-colors',
                  status === filter.value
                    ? 'border-success bg-success-soft text-success-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary',
                )}
              >
                {filter.label}
              </button>
            ))}
            <Button variant="outline" className={cn('ml-auto h-11', activeAdvancedFilters > 0 && 'border-primary')} onClick={() => setFiltersOpen(true)}>
              <Filter />
              {activeAdvancedFilters > 0 ? `Filtros (${activeAdvancedFilters})` : 'Filtros'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AsyncBoundary
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={Boolean(query.data && !query.data.items.length)}
        emptyTitle="Nenhum cliente encontrado"
        emptyDescription="Ajuste os filtros ou crie o primeiro cliente para iniciar a implantação."
      >
        {query.data && query.data.items.length > 0 ? (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <Card className="min-w-0 overflow-hidden shadow-none">
              <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
                <h2 className="stat-label">Carteira completa</h2>
                <p className="text-xs font-medium text-muted-foreground">
                  {query.data.total.toLocaleString('pt-BR')} clientes
                </p>
              </div>
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-center">Usuários</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.items.map((customer) => (
                    <TableRow key={customer.customer_id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white',
                              avatarGradient(customer.display_name),
                            )}
                          >
                            {customer.display_name.trim().charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <Link
                              className="block truncate text-[13px] font-semibold transition-colors hover:text-primary"
                              to={customerDetailPath(customer.customer_id)}
                            >
                              {customer.display_name}
                            </Link>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {customer.state_code || customer.municipality_name || (customer.kind === 'organization' ? 'Organização' : 'Conta individual')}
                              {customer.kind === 'organization' && customer.state_code ? ' · Organização' : ''}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px]">
                        <span className="inline-flex rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
                          {customer.plan_name || 'Sem plano'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[13px] font-semibold tabular-nums">{customer.active_users}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{formatActivity(customer.last_activity_at)}</TableCell>
                      <TableCell><StatusBadge value={customer.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between gap-4 border-t px-6 py-4">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {query.data.offset + 1}–{Math.min(query.data.offset + query.data.items.length, query.data.total)} de {query.data.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    disabled={query.isFetching || page <= 0}
                    onClick={() => setPageFilter(Math.max(0, page - 1))}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    disabled={query.isFetching || page + 1 >= pageCount}
                    onClick={() => setPageFilter(Math.min(pageCount - 1, page + 1))}
                    aria-label="Próxima página"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </Card>
            <div className="grid gap-5">
              <StatusDonut totals={totals} />
              <OnboardingRadar totals={totals} />
            </div>
          </div>
        ) : null}
      </AsyncBoundary>

      <OrganizationFormDialog
        open={creatingOrganization}
        onClose={closeCreate}
        onSaved={(customerId) => navigate(customerDetailPath(customerId))}
      />
      <IndividualClientDialog
        open={creatingIndividual}
        onClose={closeCreate}
        onSaved={(customerId) => navigate(customerDetailPath(customerId))}
      />
      <CustomerFiltersDialog open={filtersOpen} uf={uf} municipio={municipio} activityFrom={activityFrom} activityTo={activityTo} onClose={() => setFiltersOpen(false)} onApply={setAdvancedFilters} />
    </div>
  );
}

function CustomerFiltersDialog({ open, uf: initialUf, municipio: initialMunicipio, activityFrom: initialActivityFrom, activityTo: initialActivityTo, onClose, onApply }: {
  open: boolean; uf: string; municipio: string; activityFrom: string; activityTo: string;
  onClose: () => void; onApply: (filters: { uf: string; municipio: string; activityFrom: string; activityTo: string }) => void;
}) {
  const [uf, setUf] = useState(initialUf);
  const [municipio, setMunicipio] = useState(initialMunicipio);
  const [activityFrom, setActivityFrom] = useState(initialActivityFrom);
  const [activityTo, setActivityTo] = useState(initialActivityTo);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setUf(initialUf); setMunicipio(initialMunicipio); setActivityFrom(initialActivityFrom); setActivityTo(initialActivityTo); setError(null); } }, [open, initialUf, initialMunicipio, initialActivityFrom, initialActivityTo]);
  const apply = () => {
    if (activityFrom && activityTo && activityFrom > activityTo) { setError('A data inicial deve ser anterior ou igual à data final.'); return; }
    onApply({ uf, municipio, activityFrom, activityTo });
  };
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Filtrar carteira</DialogTitle><DialogDescription>Restrinja por município e pelo intervalo da última atividade registrada.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label className="text-sm font-medium">UF</label><BrazilStateSelect value={uf} onValueChange={(value) => { setUf(value); setMunicipio(''); }} includeAll /></div><div className="space-y-2"><label className="text-sm font-medium">Município</label><BrazilMunicipalityPicker uf={uf} value={municipio} onValueChange={setMunicipio} includeAll allValue="" allLabel="Todos os municípios" placeholder="Todos os municípios" /></div><div className="space-y-2"><label className="text-sm font-medium" htmlFor="customer-activity-from">Atividade a partir de</label><Input id="customer-activity-from" type="date" value={activityFrom} onChange={(event) => setActivityFrom(event.target.value)} /></div><div className="space-y-2"><label className="text-sm font-medium" htmlFor="customer-activity-to">Atividade até</label><Input id="customer-activity-to" type="date" value={activityTo} onChange={(event) => setActivityTo(event.target.value)} /></div></div>{error && <p className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="ghost" onClick={() => { setUf(''); setMunicipio(''); setActivityFrom(''); setActivityTo(''); }}>Limpar</Button><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={apply}>Aplicar filtros</Button></DialogFooter></DialogContent></Dialog>;
}

function CustomerOverview({
  totals,
  activePercent,
}: {
  totals: Record<'all' | 'onboarding' | 'pilot' | 'active' | 'suspended', number>;
  activePercent: number;
}) {
  const items = [
    { label: 'Total da base', value: totals.all, detail: 'dados persistidos', icon: UsersRound, tone: 'bg-muted text-muted-foreground' },
    { label: 'Em onboarding', value: totals.onboarding, detail: `${totals.pilot} em piloto`, icon: Rocket, tone: 'bg-warning-soft text-warning' },
    { label: 'Operação ativa', value: totals.active, detail: `${activePercent}% da base`, icon: CheckCircle2, tone: 'bg-success-soft text-success' },
    { label: 'Exigem atenção', value: totals.suspended, detail: 'requer revisão', icon: AlertTriangle, tone: 'bg-destructive-soft text-destructive' },
  ];

  return (
    <section aria-label="Visão geral da carteira" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article
            key={item.label}
            className="min-w-0 rounded-2xl border border-border/75 bg-card p-5 shadow-sm transition-all duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md"
          >
            <span className={cn('grid h-10 w-10 place-items-center rounded-xl', item.tone)}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-4 text-3xl font-bold tabular-nums tracking-[-0.04em]">{item.value.toLocaleString('pt-BR')}</p>
            <p className="mt-1 text-xs font-semibold text-foreground">{item.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
          </article>
        );
      })}
    </section>
  );
}

const AVATAR_GRADIENTS = [
  'from-amber-400 to-rose-500',
  'from-sky-400 to-indigo-500',
  'from-emerald-400 to-sky-500',
  'from-indigo-400 to-violet-500',
  'from-amber-300 to-rose-400',
  'from-violet-400 to-rose-500',
] as const;

function avatarGradient(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function StatusDonut({
  totals,
}: {
  totals: Record<'all' | 'onboarding' | 'pilot' | 'active' | 'suspended', number>;
}) {
  const parts = [
    { label: 'Operação ativa', value: totals.active, color: 'hsl(var(--success))' },
    { label: 'Em onboarding', value: totals.onboarding, color: 'hsl(var(--warning))' },
    { label: 'Em piloto', value: totals.pilot, color: 'hsl(var(--info))' },
    { label: 'Exigem atenção', value: totals.suspended, color: 'hsl(var(--destructive))' },
  ].filter((part) => part.value > 0);
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const circumference = 2 * Math.PI * 38;

  return (
    <Card className="shadow-none">
      <CardContent className="p-6">
        <p className="stat-label">Análise por status</p>
        {total === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhum cliente no filtro atual.</p>
        ) : (
          <div className="mt-5 flex items-center gap-5">
            <svg width="112" height="112" viewBox="0 0 120 120" role="img" aria-label={`Distribuição da carteira por status: ${parts.map((part) => `${part.label} ${part.value}`).join(', ')}`}>
              {(() => {
                let consumed = 0;
                return parts.map((part) => {
                  const length = (part.value / total) * circumference;
                  const offset = -(consumed / total) * circumference;
                  consumed += part.value;
                  return (
                    <circle
                      key={part.label}
                      r="38"
                      cx="60"
                      cy="60"
                      fill="none"
                      stroke={part.color}
                      strokeWidth="11"
                      strokeDasharray={`${length} ${circumference - length}`}
                      strokeDashoffset={offset}
                      strokeLinecap="butt"
                      transform="rotate(-90 60 60)"
                    />
                  );
                });
              })()}
              <text x="60" y="57" textAnchor="middle" fontSize="1.3rem" fontWeight="700" fill="hsl(var(--foreground))">{total.toLocaleString('pt-BR')}</text>
              <text x="60" y="73" textAnchor="middle" fontSize=".55rem" fill="hsl(var(--muted-foreground))" letterSpacing="1">CLIENTES</text>
            </svg>
            <ul className="min-w-0 flex-1 space-y-2.5">
              {parts.map((part) => (
                <li key={part.label} className="flex items-center gap-2.5 text-xs">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: part.color }} />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{part.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">{part.value.toLocaleString('pt-BR')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OnboardingRadar({
  totals,
}: {
  totals: Record<'all' | 'onboarding' | 'pilot' | 'active' | 'suspended', number>;
}) {
  const journeyTotal = totals.onboarding + totals.pilot;
  const max = Math.max(totals.onboarding, totals.pilot, totals.active, totals.suspended, 1);
  const stages = [
    { label: 'Em onboarding', value: totals.onboarding, tone: 'bg-warning' },
    { label: 'Em piloto', value: totals.pilot, tone: 'bg-info' },
    { label: 'Operação ativa', value: totals.active, tone: 'bg-success' },
    { label: 'Exigem atenção', value: totals.suspended, tone: 'bg-destructive' },
  ];

  return (
    <Card className="bg-muted/60 shadow-none">
      <CardContent className="p-6">
        <p className="stat-label">Radar de implantação</p>
        <strong className="mt-4 block text-2xl font-bold tracking-tight">{journeyTotal.toLocaleString('pt-BR')} clientes</strong>
        <p className="mt-1 text-xs text-muted-foreground">em jornada de ativação</p>
        <ul className="mt-10 space-y-7">
          {stages.map((stage) => (
            <li key={stage.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{stage.label}</span>
                <span className="font-bold tabular-nums text-foreground">{stage.value.toLocaleString('pt-BR')}</span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', stage.tone)}
                  style={{ width: `${Math.max(stage.value > 0 ? 8 : 0, Math.round((stage.value / max) * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <Link
          to="/app/clientes?status=onboarding"
          className="mt-9 inline-flex border-t border-border pt-6 text-xs font-semibold text-primary transition-opacity duration-150 hover:opacity-70 motion-reduce:transition-none"
        >
          Abrir visão de onboarding →
        </Link>
      </CardContent>
    </Card>
  );
}
