import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCw,
  ServerCog,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { PageHeader } from '@/components/domain/PageHeader';
import { MetricCard } from '@/components/domain/MetricCard';
import { StatusBadge } from '@/components/domain/Badges';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { useAuth } from '@/contexts/AuthContext';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { supabase } from '@/lib/supabase';
import type { InternalPermission } from '@/types/internal';

export interface DashboardMetric {
  key: string;
  label: string;
  value: number;
}

export interface DashboardAttention {
  type: string;
  label: string;
  detail: string | null;
  status: string | null;
  customerId: string | null;
  dueAt: string | null;
}

export interface DashboardData {
  kind: 'executive' | 'technical';
  metrics: DashboardMetric[];
  attention: DashboardAttention[];
  release: { published: string; minimum: string; development: string } | null;
}

function parseDashboard(value: import('@/types/supabase').Json | null): DashboardData {
  const root = jsonObject(value);
  const kind = jsonString(root?.kind) === 'technical' ? 'technical' : 'executive';
  const metrics = jsonArray(root?.metrics)
    .map(jsonObject)
    .filter(Boolean)
    .map((item) => ({
      key: jsonString(item?.key) || 'metric',
      label: jsonString(item?.label) || 'Indicador',
      value: jsonNumber(item?.value) || 0,
    }));
  const attention = jsonArray(root?.attention)
    .map(jsonObject)
    .filter(Boolean)
    .map((item) => ({
      type: jsonString(item?.type) || 'event',
      label: jsonString(item?.label) || 'Evento',
      detail: jsonString(item?.detail),
      status: jsonString(item?.status),
      customerId: jsonString(item?.customer_id),
      dueAt: jsonString(item?.due_at),
    }));
  const rawRelease = jsonObject(root?.release);

  return {
    kind,
    metrics,
    attention,
    release: rawRelease
      ? {
          published: jsonString(rawRelease.published_version) || '—',
          minimum: jsonString(rawRelease.minimum_version) || '—',
          development: jsonString(rawRelease.development_version) || '—',
        }
      : null,
  };
}

export function DashboardHome() {
  const { profile, can } = useAuth();
  const query = useQuery({
    queryKey: ['internal-dashboard', profile?.role],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_internal_dashboard');
      if (error) throw error;
      return parseDashboard(data);
    },
  });

  return (
    <AsyncBoundary
      loading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      loadingLabel="Carregando visão geral…"
    >
      {query.data?.kind === 'technical' ? (
        <TechnicalDashboard data={query.data} displayName={profile?.displayName} />
      ) : query.data ? (
        <ExecutiveDashboard
          data={query.data}
          displayName={profile?.displayName}
          updatedAt={query.dataUpdatedAt}
          can={can}
        />
      ) : null}
    </AsyncBoundary>
  );
}

function ExecutiveDashboard({
  data,
  displayName,
  updatedAt,
  can,
}: {
  data: DashboardData;
  displayName?: string;
  updatedAt: number;
  can: (permission: InternalPermission) => boolean;
}) {
  const [attentionFilter, setAttentionFilter] = useState<'all' | 'renewal' | 'support'>('all');
  const firstName = displayName?.trim().split(/\s+/)[0] || 'equipe';
  const metric = (key: string) => data.metrics.find((item) => item.key === key)?.value ?? 0;
  const customers = metric('customers');
  const subscriptions = metric('subscriptions');
  const renewals = metric('renewals');
  const pastDue = metric('past_due');
  const support = metric('support');
  const slaBreaches = metric('sla');
  const onboarding = metric('onboarding');
  const subscriptionCoverage = customers > 0 ? Math.round((subscriptions / customers) * 100) : 0;
  const slaHealth = support > 0 ? Math.max(0, Math.round(((support - slaBreaches) / support) * 1000) / 10) : 100;
  const renewalQueue = data.attention.filter((item) => item.type === 'renewal').length;
  const filteredAttention = data.attention
    .filter((item) => attentionFilter === 'all' || item.type === attentionFilter)
    .slice(0, 4);

  const executiveMetrics = [
    {
      key: 'customers',
      mark: 'C',
      label: 'Clientes cadastrados',
      value: customers,
      detail: 'Base persistida',
      tone: 'info',
    },
    {
      key: 'subscriptions',
      mark: 'A',
      label: 'Assinaturas vigentes',
      value: subscriptions,
      detail: `${subscriptionCoverage}% da base`,
      tone: 'primary',
    },
    {
      key: 'renewals',
      mark: 'R',
      label: 'Renovações em 30 dias',
      value: renewals,
      detail: `${renewalQueue} na fila`,
      tone: 'success',
    },
    {
      key: 'past_due',
      mark: 'P',
      label: 'Assinaturas em risco',
      value: pastDue,
      detail: pastDue ? 'Requer ação' : 'Em dia',
      tone: 'warning',
    },
  ] as const;

  const quickActions = [
    can('customer.write') && { label: 'Cadastrar cliente', to: '/app/clientes?novo=1', mark: '+', tone: 'primary' },
    can('commercial.read') && { label: 'Ver assinaturas', to: '/app/assinaturas', mark: '↗', tone: 'info' },
    can('support.read') && { label: 'Abrir suporte', to: '/app/suporte', mark: '?', tone: 'info' },
  ].filter(Boolean) as Array<{ label: string; to: string; mark: string; tone: 'primary' | 'info' }>;

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.02em] text-info">Olá, {firstName}</p>
          <h1 className="mt-4 text-[28px] font-bold leading-[1.2] tracking-[-0.025em] sm:text-[32px]">
            Visão executiva do negócio
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Indicadores persistidos, prioridades e atalhos para agir.
          </p>
        </div>
        <p className="text-xs font-medium text-muted-foreground">{updatedLabel(updatedAt)}</p>
      </header>

      <section aria-label="Indicadores executivos" className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {executiveMetrics.map((item) => (
          <ExecutiveMetricCard
            key={item.key}
            mark={item.mark}
            label={item.label}
            value={item.value}
            detail={item.detail}
            tone={item.tone}
          />
        ))}
      </section>

      <div className="mt-9 grid gap-5 xl:grid-cols-[minmax(0,1fr)_344px]">
        <Card className="min-h-[514px] overflow-hidden">
          <CardHeader className="border-b px-6 py-[18px]">
            <div className="flex items-start justify-between gap-4">
              <div>
              <h2 className="text-xl font-bold">Requer atenção</h2>
                <CardDescription className="mt-1 text-[13px]">
                  Renovações, SLA e escalonamentos que precisam de ação.
                </CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 px-6">Filtrar</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setAttentionFilter('all')}>Todas</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setAttentionFilter('renewal')}>Renovações</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setAttentionFilter('support')}>Suporte</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="px-6 py-0">
            {filteredAttention.length ? (
              <div>
                {filteredAttention.map((item, index) => (
                  <article
                    key={`${item.type}-${item.label}-${index}`}
                    className="grid min-h-[88px] grid-cols-[36px_minmax(0,1fr)] items-center gap-x-4 border-b py-4 sm:grid-cols-[36px_minmax(0,1fr)_auto_auto]"
                  >
                    <AttentionInitial item={item} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{attentionDetail(item)}</p>
                    </div>
                    <div className="col-start-2 mt-2 flex items-center justify-between gap-3 sm:contents">
                      <StatusBadge value={item.status || item.type} />
                      {item.customerId ? (
                        <Link
                          to={`/app/clientes/${encodeURIComponent(item.customerId)}`}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Abrir →
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid min-h-[352px] place-items-center text-center">
                <div>
                  <p className="font-semibold">Nenhuma pendência neste filtro</p>
                  <p className="mt-1 text-sm text-muted-foreground">A operação está em dia para esta categoria.</p>
                </div>
              </div>
            )}
            <Link to="/app/clientes" className="inline-flex py-5 text-[13px] font-semibold text-info hover:underline">
              Ver todas as pendências →
            </Link>
          </CardContent>
        </Card>

        <div className="grid content-start gap-5">
          <Card className="border-info/20 bg-info-soft shadow-none">
            <CardContent className="p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.03em] text-info">Saúde da operação</p>
              <div className="mt-6 flex items-baseline gap-2">
                <strong className="text-[34px] leading-none">{formatPercent(slaHealth)}</strong>
                <span className="text-[13px] font-medium text-muted-foreground">dentro do SLA</span>
              </div>
              <dl className="mt-7 divide-y divide-info/15">
                <HealthRow label="Chamados abertos" value={support} />
                <HealthRow label="Onboardings ativos" value={onboarding} />
                <HealthRow label="Renovações em 30 dias" value={renewals} />
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="px-6 pb-3 pt-6">
            <h2 className="text-lg font-bold">Ações rápidas</h2>
              <CardDescription className="text-xs">Atalhos para tarefas frequentes.</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-5">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className="flex min-h-11 items-center gap-3 rounded-md text-[13px] font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={`grid h-7 w-7 place-items-center rounded-md ${
                    action.tone === 'primary' ? 'bg-secondary text-primary' : 'bg-info-soft text-info'
                  }`}>
                    {action.mark}
                  </span>
                  <span className="flex-1">{action.label}</span>
                  <span className="text-muted-foreground">→</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TechnicalDashboard({ data, displayName }: { data: DashboardData; displayName?: string }) {
  const firstName = displayName?.trim().split(/\s+/)[0] || 'equipe';
  const metric = (key: string) => data.metrics.find((item) => item.key === key)?.value ?? 0;
  const failedBuilds = metric('builds_failed');
  const syncIncidents = metric('sync');
  const storageIncidents = metric('storage');
  const criticalErrors = metric('errors');
  const totalIncidents = syncIncidents + storageIncidents + criticalErrors;
  const technicalMetrics = [
    { key: 'builds_running', label: 'Builds em execução', value: metric('builds_running'), icon: Wrench, hint: 'Pipeline atual' },
    { key: 'builds_failed', label: 'Builds com falha', value: failedBuilds, icon: AlertTriangle, hint: 'Exigem revisão' },
    { key: 'sync', label: 'Alertas de sincronização', value: syncIncidents, icon: RefreshCw, hint: 'Últimas 24 horas' },
    { key: 'errors', label: 'Erros críticos', value: criticalErrors, icon: ServerCog, hint: 'Últimas 24 horas' },
  ];
  const healthItems = [
    { label: 'Sincronização', value: syncIncidents, icon: RefreshCw, to: '/app/desenvolvimento/sincronizacao' },
    { label: 'Armazenamento', value: storageIncidents, icon: Database, to: '/app/desenvolvimento/armazenamento' },
    { label: 'Builds com falha', value: failedBuilds, icon: Wrench, to: '/app/desenvolvimento/builds' },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operação técnica"
        title="Painel de desenvolvimento"
        description={`Olá, ${firstName}. Acompanhe releases, telemetria e prioridades técnicas com dados persistidos da plataforma.`}
        actions={
          <>
            <Button asChild variant="outline"><Link to="/app/desenvolvimento/versoes">Gerenciar versões</Link></Button>
            <Button asChild><Link to="/app/desenvolvimento/logs">Abrir eventos<ArrowRight /></Link></Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <Card className="overflow-hidden bg-ink text-white">
          <CardHeader className="border-b border-ink-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-white">Linha de versões</CardTitle>
                <CardDescription className="mt-1 text-white/55">Estado atual dos canais de distribuição.</CardDescription>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-ink-panel px-3 py-1.5 text-xs font-semibold text-warm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configuração persistida
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-px bg-ink-border p-0 sm:grid-cols-3">
            <Release label="Publicada" value={data.release?.published || '—'} />
            <Release label="Mínima suportada" value={data.release?.minimum || '—'} />
            <Release label="Em desenvolvimento" value={data.release?.development || '—'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Leitura operacional</CardDescription>
            <CardTitle>{totalIncidents ? `${totalIncidents} sinais em análise` : 'Operação estável'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
              <span className={`grid h-10 w-10 place-items-center rounded-full ${totalIncidents ? 'bg-status-warning text-warning' : 'bg-status-success text-success'}`}>
                {totalIncidents ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              </span>
              <div>
                <p className="text-sm font-semibold">{totalIncidents ? 'Atenção recomendada' : 'Sem alertas críticos'}</p>
                <p className="text-xs text-muted-foreground">Janela consolidada das últimas 24 horas.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <section aria-label="Indicadores técnicos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {technicalMetrics.map((item) => (
          <MetricCard
            key={item.key}
            label={item.label}
            value={item.value}
            icon={item.icon}
            hint={item.hint}
          />
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Requer atenção</CardTitle>
            <CardDescription>Eventos recentes ordenados por severidade e horário.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.attention.length ? (
              <div className="divide-y">
                {data.attention.map((item, index) => (
                  <article key={`${item.type}-${item.label}-${index}`} className="flex flex-wrap items-center gap-3 p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-status-warning text-warning">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{item.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{attentionDetail(item)}</p>
                    </div>
                    <StatusBadge value={item.status} />
                    {item.customerId && (
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/app/clientes/${encodeURIComponent(item.customerId)}`}>Abrir cliente</Link>
                      </Button>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Nenhuma pendência crítica no momento.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Atalhos operacionais</CardTitle>
            <CardDescription>Filas técnicas separadas por domínio.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {healthItems.map((item) => (
              <Link key={item.label} to={item.to} className="flex min-h-16 items-center gap-3 px-5 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-info-soft text-info"><item.icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.value} ocorrência{item.value === 1 ? '' : 's'}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
            <div className="flex items-center gap-2 px-5 py-4 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Atualização automática a cada 30 segundos
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExecutiveMetricCard({
  mark,
  label,
  value,
  detail,
  tone,
}: {
  mark: string;
  label: string;
  value: number;
  detail: string;
  tone: 'info' | 'primary' | 'success' | 'warning';
}) {
  const tones = {
    info: 'bg-info-soft text-info',
    primary: 'bg-secondary text-primary',
    success: 'bg-status-success text-success',
    warning: 'bg-status-warning text-warning',
  };

  return (
    <Card className="min-h-[150px]">
      <CardContent className="p-5">
        <span className={`grid h-9 w-9 place-items-center rounded-md text-[15px] font-bold ${tones[tone]}`}>{mark}</span>
        <p className="mt-5 text-[13px] font-medium text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-end gap-8">
          <strong className="text-[28px] leading-none tracking-[-0.02em]">{value.toLocaleString('pt-BR')}</strong>
          <span className={`pb-0.5 text-xs font-semibold ${
            tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'info' ? 'text-info' : 'text-primary'
          }`}>
            {detail}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function AttentionInitial({ item }: { item: DashboardAttention }) {
  const danger = item.status === 'past_due' || item.status === 'critical';
  const support = item.type === 'support';
  return (
    <span className={`grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold ${
      danger
        ? 'bg-status-danger text-destructive'
        : support
          ? 'bg-info-soft text-info'
          : 'bg-status-warning text-warning'
    }`}>
      {item.label.trim().charAt(0).toUpperCase() || 'T'}
    </span>
  );
}

function attentionDetail(item: DashboardAttention) {
  const date = item.dueAt
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(item.dueAt))
    : null;
  return [item.detail || item.type, date].filter(Boolean).join(' · ');
}

function HealthRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-3 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-bold">{value.toLocaleString('pt-BR')}</dd>
    </div>
  );
}

function Release({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-panel px-5 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`;
}

function updatedLabel(timestamp: number) {
  if (!timestamp) return 'Atualizando…';
  const elapsed = Date.now() - timestamp;
  if (elapsed < 60_000) return 'Atualizado agora';
  return `Atualizado às ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(timestamp)}`;
}
