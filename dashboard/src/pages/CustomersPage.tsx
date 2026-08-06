import { useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, Plus, Search } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { OrganizationFormDialog } from '@/components/customers/OrganizationFormDialog';
import { IndividualClientDialog } from '@/components/customers/IndividualClientDialog';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomers } from '@/hooks/useCustomers';
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
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => params.get('status') || 'all');
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useCustomers(search, status === 'all' ? '' : status, page);
  const totalQuery = useCustomers('', '', 0);
  const onboardingQuery = useCustomers('', 'onboarding', 0);
  const pilotQuery = useCustomers('', 'pilot', 0);
  const activeQuery = useCustomers('', 'active', 0);
  const suspendedQuery = useCustomers('', 'suspended', 0);
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

  const setStatusFilter = (nextStatus: string) => {
    setStatus(nextStatus);
    setPage(0);
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
        description="Organizações e contas individuais em uma visão comercial, operacional e técnica."
        actions={can('customer.write') ? (
          <>
            <Button variant="outline" onClick={() => openCreate('municipal')}>
              <Plus />
              Municipal
            </Button>
            <Button onClick={() => openCreate('individual')}>
              <Plus />
              Individual
            </Button>
          </>
        ) : undefined}
      />

      <CustomerOverview totals={totals} activePercent={activePercent} />

      <Card>
        <CardContent className="flex flex-col gap-3 p-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1 xl:max-w-[460px]">
            <span className="sr-only">Buscar clientes</span>
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Nome, município, contato ou identificador"
              className="h-11 border-0 bg-background pl-10"
            />
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
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary',
                )}
              >
                {filter.label}
              </button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('ml-auto h-11', ['pilot', 'archived'].includes(status) && 'border-primary')}
                >
                  <Filter />
                  {status === 'pilot' ? 'Piloto' : status === 'archived' ? 'Arquivados' : 'Filtros'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setStatusFilter('pilot')}>Piloto</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatusFilter('archived')}>Arquivados</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatusFilter('all')}>Limpar filtro</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_264px]">
            <Card className="min-w-0 overflow-hidden">
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
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-foreground">
                            {customer.display_name.trim().charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <Link
                              className="block truncate text-[13px] font-semibold hover:text-primary transition-colors"
                              to={`/app/clientes/${encodeURIComponent(customer.customer_id)}`}
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
                      <TableCell className="text-[13px] text-muted-foreground">{customer.plan_name || 'Sem plano'}</TableCell>
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
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    disabled={query.isFetching || page + 1 >= pageCount}
                    onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                    aria-label="Próxima página"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </Card>
            <OnboardingRadar totals={totals} onOpenOnboarding={() => setStatusFilter('onboarding')} />
          </div>
        ) : null}
      </AsyncBoundary>

      <OrganizationFormDialog
        open={creatingOrganization}
        onClose={closeCreate}
        onSaved={(customerId) => navigate(`/app/clientes/${encodeURIComponent(customerId)}`)}
      />
      <IndividualClientDialog
        open={creatingIndividual}
        onClose={closeCreate}
        onSaved={(customerId) => navigate(`/app/clientes/${encodeURIComponent(customerId)}`)}
      />
    </div>
  );
}

function CustomerOverview({
  totals,
  activePercent,
}: {
  totals: Record<'all' | 'onboarding' | 'pilot' | 'active' | 'suspended', number>;
  activePercent: number;
}) {
  const items = [
    { label: 'Total da base', value: totals.all, detail: 'dados persistidos' },
    { label: 'Em onboarding', value: totals.onboarding, detail: `${totals.pilot} em piloto` },
    { label: 'Operação ativa', value: totals.active, detail: `${activePercent}% da base` },
    { label: 'Exigem atenção', value: totals.suspended, detail: 'requer revisão' },
  ];

  return (
    <section aria-label="Visão geral da carteira" className="grid grid-cols-2 gap-x-8 gap-y-10 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <div className="stat-number mb-2">{item.value.toLocaleString('pt-BR')}</div>
          <div className="stat-label">{item.label}</div>
          <p className="mt-1.5 text-xs text-muted-foreground">{item.detail}</p>
        </div>
      ))}
    </section>
  );
}

function OnboardingRadar({
  totals,
  onOpenOnboarding,
}: {
  totals: Record<'all' | 'onboarding' | 'pilot' | 'active' | 'suspended', number>;
  onOpenOnboarding: () => void;
}) {
  const journeyTotal = totals.onboarding + totals.pilot;
  const max = Math.max(totals.onboarding, totals.pilot, totals.active, totals.suspended, 1);
  const stages = [
    { label: 'Em onboarding', value: totals.onboarding, tone: 'bg-foreground' },
    { label: 'Em piloto', value: totals.pilot, tone: 'bg-foreground' },
    { label: 'Operação ativa', value: totals.active, tone: 'bg-primary' },
    { label: 'Exigem atenção', value: totals.suspended, tone: 'bg-foreground' },
  ];

  return (
    <Card>
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
                  className={cn('h-full rounded-full transition-all duration-300 ease-out', stage.tone)}
                  style={{ width: `${Math.max(stage.value > 0 ? 8 : 0, Math.round((stage.value / max) * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <Link
          to="/app/clientes?status=onboarding"
          onClick={onOpenOnboarding}
          className="mt-9 inline-flex border-t border-border pt-6 text-xs font-semibold text-primary hover:opacity-70 transition-opacity"
        >
          Abrir visão de onboarding →
        </Link>
      </CardContent>
    </Card>
  );
}
