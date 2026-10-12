import { useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, CreditCard, Download, FilterX, MoreHorizontal, Phone, Plus, Search, Smartphone, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { OrganizationFormDialog } from '@/components/customers/OrganizationFormDialog';
import { IndividualClientDialog } from '@/components/customers/IndividualClientDialog';
import { BrazilMunicipalityPicker, BrazilStateSelect } from '@/components/BrazilMunicipalityPicker';
import { PageHeader } from '@/components/domain/PageHeader';
import { StatusBadge } from '@/components/domain/Badges';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomers } from '@/hooks/useCustomers';
import type { CustomerRecord } from '@/types/domain';
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

const activityPresets = [
  { value: 'all', label: 'Qualquer data' },
  { value: '7', label: 'Ativos 7 dias' },
  { value: '30', label: 'Ativos 30 dias' },
] as const;

function activityFromFor(preset: string) {
  if (preset === 'all') return '';
  const days = Number(preset);
  if (!Number.isInteger(days) || days <= 0) return '';
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function exportCustomersCsv(items: CustomerRecord[]) {
  const header = ['Cliente', 'Tipo', 'Municipio', 'UF', 'Plano', 'Status', 'Usuarios ativos', 'Ultima atividade'];
  const rows = items.map((customer) => [
    customer.display_name,
    customer.kind === 'organization' ? 'Organizacao' : 'Individual',
    customer.municipality_name ?? '',
    customer.state_code ?? '',
    customer.plan_name ?? '',
    customer.status,
    String(customer.active_users),
    customer.last_activity_at ?? '',
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `clientes-tcs-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const rawStatus = params.get('status') ?? 'all';
  const status = ['all', 'active', 'onboarding', 'pilot', 'suspended', 'archived'].includes(rawStatus) ? rawStatus : 'all';
  const municipio = params.get('municipio') ?? '';
  const uf = params.get('uf') ?? '';
  const activityPreset = params.get('atividade') ?? 'all';
  const rawPage = Number(params.get('page') ?? '0');
  const page = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
  const navigate = useNavigate();
  const { can } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const activityFrom = activityFromFor(activityPreset);
  const activityTo = '';
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
  const activeFilterCount =
    Number(Boolean(uf)) + Number(Boolean(municipio)) + Number(activityPreset !== 'all') + Number(Boolean(search)) + Number(status !== 'all');

  const updateParams = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(params);
    mutate(next);
    next.delete('page');
    setParams(next, { replace });
  };
  const setStatusFilter = (nextStatus: string) => updateParams((next) => {
    if (nextStatus === 'all') next.delete('status');
    else next.set('status', nextStatus);
  });
  const setSearchFilter = (value: string) => updateParams((next) => {
    if (value) next.set('q', value);
    else next.delete('q');
  }, true);
  const setUfFilter = (value: string) => updateParams((next) => {
    if (value) next.set('uf', value);
    else next.delete('uf');
    next.delete('municipio');
  });
  const setMunicipioFilter = (value: string) => updateParams((next) => {
    if (value) next.set('municipio', value);
    else next.delete('municipio');
  });
  const setActivityPresetFilter = (value: string) => updateParams((next) => {
    if (value === 'all') next.delete('atividade');
    else next.set('atividade', value);
  });
  const clearFilters = () => updateParams((next) => {
    ['q', 'status', 'uf', 'municipio', 'atividade'].forEach((key) => next.delete(key));
  });
  const setPageFilter = (nextPage: number) => {
    const next = new URLSearchParams(params);
    if (nextPage > 0) next.set('page', String(nextPage));
    else next.delete('page');
    setParams(next);
  };
  const openCreate = (kind: 'municipal' | 'individual') => updateParams((next) => next.set('novo', kind));
  const kpiHref = (filterStatus: string) => {
    const next = new URLSearchParams(params);
    if (filterStatus === 'all') next.delete('status');
    else next.set('status', filterStatus);
    next.delete('page');
    return `/app/clientes?${next.toString()}`;
  };

  const visibleItems = query.data?.items ?? [];
  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((customer) => selected.has(customer.customer_id));
  const toggleSelectAllVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleItems.forEach((customer) => next.delete(customer.customer_id));
      else visibleItems.forEach((customer) => next.add(customer.customer_id));
      return next;
    });
  };
  const toggleSelect = (customerId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };
  const selectedItems = visibleItems.filter((customer) => selected.has(customer.customer_id));

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Carteira de clientes"
        title="Clientes"
        description="Filtre a carteira inteira, gerencie acessos da equipe, ajuste assinatura e exporte o que precisar — tudo daqui."
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

      <CustomerOverview
        totals={totals}
        activePercent={activePercent}
        activeStatus={status}
        kpiHref={kpiHref}
      />

      <Card className="bg-card/80 shadow-none">
        <CardContent className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1 xl:max-w-[420px]">
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
                <Button
                  key={filter.value}
                  variant="outline"
                  size="sm"
                  aria-pressed={status === filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    'h-8 rounded-full px-3 text-[11px] font-semibold',
                    status === filter.value
                      ? 'border-success bg-success-soft text-success-foreground hover:bg-success-soft'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[150px]">
              <label htmlFor="clientes-filtro-uf" className="sr-only">Filtrar por UF</label>
              <BrazilStateSelect id="clientes-filtro-uf" value={uf} onValueChange={setUfFilter} includeAll />
            </div>
            {uf && (
              <div className="min-w-[190px]">
                <label htmlFor="clientes-filtro-municipio" className="sr-only">Filtrar por município</label>
                <BrazilMunicipalityPicker id="clientes-filtro-municipio" uf={uf} value={municipio} onValueChange={setMunicipioFilter} includeAll allValue="" allLabel="Todos os municípios" placeholder="Todos os municípios" />
              </div>
            )}
            <div className="flex items-center gap-1.5">
              {activityPresets.map((preset) => (
                <Button
                  key={preset.value}
                  variant="outline"
                  size="sm"
                  aria-pressed={activityPreset === preset.value}
                  onClick={() => setActivityPresetFilter(preset.value)}
                  className={cn(
                    'h-8 px-2.5 text-[11px] font-semibold',
                    activityPreset === preset.value
                      ? 'border-success bg-success-soft text-success-foreground hover:bg-success-soft'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px]" onClick={clearFilters}>
                <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
                Limpar filtros ({activeFilterCount})
              </Button>
            )}
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
              {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-success-soft/60 px-6 py-2.5">
                  <p className="text-xs font-semibold text-success-foreground">{selected.size} selecionado(s)</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-[11px]"
                    onClick={() => {
                      exportCustomersCsv(selectedItems);
                      toast.success(`Exportados ${selectedItems.length} cliente(s) para CSV.`);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Exportar CSV
                  </Button>
                  <Button variant="ghost" size="sm" className="ml-auto h-7 text-[11px]" onClick={() => setSelected(new Set())}>
                    Limpar seleção
                  </Button>
                </div>
              )}
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-6">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAllVisible}
                        aria-label={allVisibleSelected ? 'Desmarcar clientes da página' : 'Marcar clientes da página'}
                      />
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-center">Usuários</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleItems.map((customer) => (
                    <TableRow key={customer.customer_id}>
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selected.has(customer.customer_id)}
                          onCheckedChange={() => toggleSelect(customer.customer_id)}
                          aria-label={`Selecionar ${customer.display_name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                              customer.kind === 'organization' ? 'bg-info-soft text-info' : 'bg-success-soft text-success',
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
                      <TableCell className="pr-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ações de ${customer.display_name}`}>
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onSelect={() => navigate(customerDetailPath(customer.customer_id))}>
                              Abrir cadastro
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => navigate(`${customerDetailPath(customer.customer_id)}/assinatura`)}>
                              <CreditCard className="h-4 w-4" aria-hidden="true" />
                              Assinatura e plano
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => navigate(`${customerDetailPath(customer.customer_id)}/sessoes`)}>
                              <Smartphone className="h-4 w-4" aria-hidden="true" />
                              Sessões do cliente
                            </DropdownMenuItem>
                            {customer.kind === 'organization' && (
                              <DropdownMenuItem onSelect={() => navigate(`${customerDetailPath(customer.customer_id)}/equipe`)}>
                                <Users className="h-4 w-4" aria-hidden="true" />
                                Equipe e acessos
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => {
                                void navigator.clipboard?.writeText(customer.customer_id);
                                toast.success('Identificador copiado.');
                              }}
                            >
                              <Copy className="h-4 w-4" aria-hidden="true" />
                              Copiar identificador
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
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
        onClose={() => updateParams((next) => next.delete('novo'), true)}
        onSaved={(customerId) => navigate(customerDetailPath(customerId))}
      />
      <IndividualClientDialog
        open={creatingIndividual}
        onClose={() => updateParams((next) => next.delete('novo'), true)}
        onSaved={(customerId) => navigate(customerDetailPath(customerId))}
      />
    </div>
  );
}

function CustomerOverview({
  totals,
  activePercent,
  activeStatus,
  kpiHref,
}: {
  totals: Record<'all' | 'onboarding' | 'pilot' | 'active' | 'suspended', number>;
  activePercent: number;
  activeStatus: string;
  kpiHref: (status: string) => string;
}) {
  const items = [
    { label: 'Total da base', value: totals.all, detail: 'dados persistidos', icon: Users, tone: 'bg-muted text-muted-foreground', filter: 'all' },
    { label: 'Em onboarding', value: totals.onboarding, detail: `${totals.pilot} em piloto`, icon: Plus, tone: 'bg-warning-soft text-warning', filter: 'onboarding' },
    { label: 'Operação ativa', value: totals.active, detail: `${activePercent}% da base`, icon: Phone, tone: 'bg-success-soft text-success', filter: 'active' },
    { label: 'Exigem atenção', value: totals.suspended, detail: 'requer revisão', icon: X, tone: 'bg-destructive-soft text-destructive', filter: 'suspended' },
  ];

  return (
    <section aria-label="Visão geral da carteira" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        const isFiltering = activeStatus === item.filter;
        return (
          <Link
            key={item.label}
            to={kpiHref(item.filter)}
            aria-current={isFiltering ? 'true' : undefined}
            title={isFiltering ? 'Filtro aplicado — clique para manter ou trocar' : `Filtrar carteira por ${item.label.toLowerCase()}`}
            className={cn(
              'min-w-0 rounded-2xl border bg-card p-5 shadow-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none hover:-translate-y-0.5 hover:shadow-md',
              isFiltering ? 'border-success/60' : 'border-border/75 hover:border-foreground/15',
            )}
          >
            <span className={cn('grid h-10 w-10 place-items-center rounded-xl', item.tone)}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-4 text-3xl font-bold tabular-nums tracking-[-0.04em]">{item.value.toLocaleString('pt-BR')}</p>
            <p className="mt-1 text-xs font-semibold text-foreground">{item.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
          </Link>
        );
      })}
    </section>
  );
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
      </CardContent>
    </Card>
  );
}
