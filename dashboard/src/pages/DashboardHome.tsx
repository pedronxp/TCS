import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  CreditCard,
  FileClock,
  GitBranch,
  Headphones,
  History,
  ListTodo,
  RefreshCw,
  ServerCog,
  TimerReset,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { customerDetailPath } from '@/lib/customerRoutes';
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

type ConsoleAction = {
  label: string;
  description: string;
  to: string;
  permission: InternalPermission;
  icon: LucideIcon;
};

type CanAccess = (permission: InternalPermission) => boolean;

type AttentionAction = {
  destination: string | null;
  unavailableReason: string | null;
};

const executiveActions: ConsoleAction[] = [
  { label: 'Abrir clientes', description: 'Carteira, implantação e acesso.', to: '/app/clientes', permission: 'customer.read', icon: Building2 },
  { label: 'Revisar assinaturas', description: 'Ciclos, renovações e pendências.', to: '/app/assinaturas', permission: 'commercial.read', icon: CreditCard },
  { label: 'Atender suporte', description: 'Fila, prioridade e SLA.', to: '/app/suporte', permission: 'support.read', icon: Headphones },
  { label: 'Consultar auditoria', description: 'Eventos e decisões registradas.', to: '/app/auditoria', permission: 'audit.read', icon: History },
];

const technicalActions: ConsoleAction[] = [
  { label: 'Abrir builds', description: 'Fila, execução e falhas recentes.', to: '/app/desenvolvimento/builds', permission: 'build.request', icon: Boxes },
  { label: 'Revisar versões', description: 'Publicada, mínima e desenvolvimento.', to: '/app/desenvolvimento/versoes', permission: 'technical.read', icon: GitBranch },
  { label: 'Investigar logs', description: 'Erros e eventos técnicos.', to: '/app/desenvolvimento/logs', permission: 'technical.read', icon: ServerCog },
  { label: 'Consultar auditoria', description: 'Rastreabilidade das operações.', to: '/app/auditoria', permission: 'audit.read', icon: History },
];

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
          published: jsonString(rawRelease?.published_version) || '—',
          minimum: jsonString(rawRelease?.minimum_version) || '—',
          development: jsonString(rawRelease?.development_version) || '—',
        }
      : null,
  };
}

async function fetchDashboard(): Promise<DashboardData> {
  const { data, error } = await supabase.rpc('get_internal_dashboard');
  if (error) throw error;
  return parseDashboard(data ?? null);
}

export function DashboardHome() {
  const { profile, can } = useAuth();
  const query = useQuery({
    queryKey: ['internal-dashboard', profile?.userId, profile?.role],
    queryFn: fetchDashboard,
    enabled: Boolean(profile),
  });

  if (!profile) return null;
  if (query.isLoading) return <DashboardSkeleton technical={profile.role === 'developer'} />;
  if (query.isError) return <DashboardError retrying={query.isFetching} onRetry={() => void query.refetch()} />;

  const data = query.data;
  const technical = data?.kind === 'technical';
  const metrics = data?.metrics ?? [];
  const attention = data?.attention ?? [];
  const actions = (technical ? technicalActions : executiveActions).filter((action) => can(action.permission));
  const firstName = profile.displayName.split(/\s+/).filter(Boolean)[0] || 'equipe';

  return (
    <div className="mx-auto max-w-[1240px] space-y-7 pb-8">
      <header className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            {technical ? 'Saúde técnica' : 'Visão executiva'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
            {technical ? 'O que exige investigação agora' : 'O que exige decisão agora'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {technical
              ? `Olá, ${firstName}. Acompanhe builds, falhas recentes e versões ativas sem misturar indicadores comerciais.`
              : `Olá, ${firstName}. Acompanhe carteira, assinaturas e filas operacionais sem substituir dados por estimativas.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={cn(query.isFetching && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
            {query.isFetching ? 'Atualizando…' : 'Atualizar dados'}
          </Button>
          <Badge variant="outline" className="w-fit shrink-0">
            {technical ? 'Perfil developer' : 'Perfil owner'}
          </Badge>
        </div>
      </header>

      {!technical && <ExecutiveBrief metrics={metrics} attention={attention} can={can} />}

      {metrics.length > 0 ? (
        <MetricGrid metrics={metrics} technical={technical} />
      ) : (
        <EmptyPanel
          icon={CircleAlert}
          title="Indicadores ainda não disponíveis"
          description="O serviço não retornou métricas para este perfil. Nenhum valor foi estimado."
        />
      )}

      {technical && <ReleasePanel release={data?.release ?? null} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <AttentionPanel items={attention} technical={technical} can={can} />
        <ActionsPanel actions={actions} technical={technical} />
      </div>
    </div>
  );
}

function MetricGrid({ metrics, technical }: { metrics: DashboardMetric[]; technical: boolean }) {
  return (
    <section aria-labelledby="dashboard-metrics-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="dashboard-metrics-title" className="text-lg font-semibold">
            {technical ? 'Sinais das últimas 24 horas e 7 dias' : 'Panorama da operação'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Valores fornecidos pelo painel interno.</p>
        </div>
      </div>
      <div className={cn(
        'mt-5 grid gap-3',
        technical ? 'sm:grid-cols-2 xl:grid-cols-5' : 'sm:grid-cols-2 xl:grid-cols-12',
      )}>
        {metrics.map((metric) => {
          const urgent = isUrgentMetric(metric);
          const config = metricPresentation(metric);
          return (
            <article key={metric.key} className={cn(
              'min-w-0 rounded-2xl border border-border/75 bg-card p-5 shadow-sm transition-colors hover:border-border',
              technical ? 'xl:col-span-1' : metricSpan(metric.key),
              urgent && 'border-warning/35 bg-warning-soft/35',
            )}>
              <div className="flex items-start justify-between gap-3">
                <span className={cn('grid h-9 w-9 place-items-center rounded-xl', config.iconClassName)}>
                  <config.icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                {urgent && <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-warning"><AlertTriangle className="h-3 w-3" aria-hidden="true" />Revisar</span>}
              </div>
              <p className="mt-5 max-w-[24ch] text-xs font-semibold text-muted-foreground">{metric.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-[-0.04em]">{metric.value.toLocaleString('pt-BR')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{metricHint(metric, technical)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function metricValue(metrics: DashboardMetric[], key: string) {
  return metrics.find((metric) => metric.key === key)?.value ?? 0;
}

function metricPresentation(metric: DashboardMetric): { icon: LucideIcon; iconClassName: string } {
  switch (metric.key) {
    case 'customers': return { icon: UsersRound, iconClassName: 'bg-primary/10 text-primary' };
    case 'subscriptions': return { icon: CircleDollarSign, iconClassName: 'bg-success-soft text-success' };
    case 'renewals': return { icon: CalendarClock, iconClassName: 'bg-info-soft text-info' };
    case 'past_due': return { icon: AlertTriangle, iconClassName: 'bg-warning-soft text-warning' };
    case 'support': return { icon: Headphones, iconClassName: 'bg-muted text-muted-foreground' };
    case 'sla': return { icon: TimerReset, iconClassName: 'bg-warning-soft text-warning' };
    case 'onboarding': return { icon: TrendingUp, iconClassName: 'bg-primary/10 text-primary' };
    default: return { icon: ListTodo, iconClassName: 'bg-muted text-muted-foreground' };
  }
}

function metricSpan(key: string) {
  if (key === 'customers' || key === 'subscriptions' || key === 'renewals') return 'xl:col-span-4';
  return 'xl:col-span-3';
}

function metricHint(metric: DashboardMetric, technical: boolean) {
  if (technical) return 'Atualização conforme o serviço interno';
  switch (metric.key) {
    case 'customers': return 'Base cadastrada no painel';
    case 'subscriptions': return 'Ciclos ativos, trial ou carência';
    case 'renewals': return 'Vencimento nos próximos 30 dias';
    case 'past_due': return metric.value > 0 ? 'Necessita revisão comercial' : 'Nenhum registro retornado';
    case 'support': return 'Fila ainda não resolvida';
    case 'sla': return metric.value > 0 ? 'Necessita resposta imediata' : 'Sem violação retornada';
    case 'onboarding': return 'Organizações em onboarding ou piloto';
    default: return 'Dado fornecido pelo painel';
  }
}

function ExecutiveBrief({ metrics, attention, can }: { metrics: DashboardMetric[]; attention: DashboardAttention[]; can: CanAccess }) {
  const pastDue = metricValue(metrics, 'past_due');
  const sla = metricValue(metrics, 'sla');
  const renewals = metricValue(metrics, 'renewals');
  const support = metricValue(metrics, 'support');
  const onboarding = metricValue(metrics, 'onboarding');
  const hasCritical = pastDue > 0 || sla > 0;
  const primaryAction = pastDue > 0
    ? { to: '/app/assinaturas', permission: 'commercial.read' as const, label: 'Abrir contas em risco' }
    : sla > 0
      ? { to: '/app/suporte', permission: 'support.read' as const, label: 'Tratar SLAs violados' }
      : renewals > 0
        ? { to: '/app/assinaturas', permission: 'commercial.read' as const, label: 'Planejar renovações' }
        : null;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]" aria-label="Resumo para decisão">
      <Card className={cn('overflow-hidden shadow-none', hasCritical ? 'border-warning/40' : 'border-primary/25')}>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Leitura do momento</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
                {hasCritical ? 'Há itens que exigem ação antes da próxima rotina.' : 'Atenção direcionada às próximas decisões operacionais.'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {hasCritical
                  ? `${pastDue} assinatura(s) em risco e ${sla} SLA(s) violado(s) foram retornados pelo serviço.`
                  : `${renewals} renovação(ões), ${support} chamado(s) abertos e ${onboarding} implantação(ões) estão no radar.`}
              </p>
            </div>
            <span className={cn('grid h-11 w-11 place-items-center rounded-2xl', hasCritical ? 'bg-warning-soft text-warning' : 'bg-primary/10 text-primary')}>
              {hasCritical ? <AlertTriangle className="h-5 w-5" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {primaryAction && can(primaryAction.permission) ? <Button asChild size="sm"><Link to={primaryAction.to}>{primaryAction.label}<ArrowRight aria-hidden="true" /></Link></Button> : null}
            <span className="text-xs text-muted-foreground">{attention.length} prioridade(s) disponíveis para revisão abaixo.</span>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-muted/40 shadow-none">
        <CardContent className="grid grid-cols-3 gap-2 p-4">
          <BriefStat label="Renovações" value={renewals} icon={CalendarClock} />
          <BriefStat label="Chamados" value={support} icon={Headphones} />
          <BriefStat label="Implantação" value={onboarding} icon={TrendingUp} />
        </CardContent>
      </Card>
    </section>
  );
}

function BriefStat({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return <div className="rounded-xl bg-card p-4"><Icon className="h-4 w-4 text-primary" aria-hidden="true" /><p className="mt-4 text-2xl font-semibold tabular-nums">{value.toLocaleString('pt-BR')}</p><p className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</p></div>;
}

function ReleasePanel({ release }: { release: DashboardData['release'] }) {
  return (
    <section aria-labelledby="release-title">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle id="release-title" className="text-lg">Referência de versões</CardTitle>
        </CardHeader>
        <CardContent>
          {release ? (
            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                ['Publicada', release.published],
                ['Mínima suportada', release.minimum],
                ['Em desenvolvimento', release.development],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border bg-secondary/45 p-4">
                  <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                  <dd className="mt-2 font-mono text-sm font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma configuração de release foi retornada.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function AttentionPanel({ items, technical, can }: { items: DashboardAttention[]; technical: boolean; can: CanAccess }) {
  return (
    <Card className={cn('shadow-none', items.length > 0 && 'border-warning/20')}>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-lg">{technical ? 'Eventos para investigar' : 'Prioridades operacionais'}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {technical ? 'Alertas técnicos recentes retornados pelo serviço.' : 'Renovações, pendências e SLAs retornados pelo serviço.'}
          </p>
        </div>
        <Badge variant="secondary">{items.length}</Badge>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-5 text-sm leading-6 text-muted-foreground">
            Nenhuma prioridade foi retornada. Isso não confirma ausência de risco fora deste painel.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item, index) => {
              const action = attentionAction(item, technical, can);
              const tone = item.status ? attentionTone(item.status) : null;
              return (
                <li key={`${item.type}-${item.customerId ?? item.label}-${index}`} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{item.label}</p>
                        {item.status && <Badge variant={tone ?? 'secondary'} className={tone === 'warning' ? 'text-foreground' : undefined}>{item.status}</Badge>}
                      </div>
                      {item.detail && <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>}
                      {item.dueAt && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FileClock className="h-3.5 w-3.5" aria-hidden="true" />
                          <time dateTime={item.dueAt}>{formatDateTime(item.dueAt)}</time>
                        </p>
                      )}
                    </div>
                    {action.destination ? (
                      <Button asChild variant="ghost" size="sm" className="self-start">
                        <Link to={action.destination}>Abrir <ArrowRight aria-hidden="true" /></Link>
                      </Button>
                    ) : (
                      <p className="max-w-[24ch] text-xs leading-5 text-muted-foreground">
                        {action.unavailableReason}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActionsPanel({ actions, technical }: { actions: ConsoleAction[]; technical: boolean }) {
  return (
    <Card className="bg-muted/45 shadow-none">
      <CardHeader>
        <CardTitle className="text-lg">Próximo passo</CardTitle>
        <p className="text-sm text-muted-foreground">
          {technical ? 'Atalhos técnicos liberados para seu perfil.' : 'Atalhos operacionais liberados para seu perfil.'}
        </p>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">Seu perfil não possui outro módulo disponível neste contexto.</p>
        ) : (
          <div className="space-y-2">
            {actions.map((action, index) => (
              <Link
                key={action.to}
                to={action.to}
                className={cn(
                  'group flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  index === 0 ? 'border-primary/40 bg-card shadow-sm hover:border-primary' : 'border-border/70 bg-card/60 hover:bg-secondary/80 hover:border-border',
                )}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-card text-primary">
                  <action.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{action.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{action.description}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton({ technical }: { technical: boolean }) {
  return (
    <div className="mx-auto max-w-[1440px] space-y-8" role="status" aria-label="Carregando painel interno">
      <span className="sr-only">Carregando painel interno…</span>
      <div className="border-b border-border pb-7">
        <Skeleton className="h-3 w-32 motion-reduce:animate-none" />
        <Skeleton className="mt-4 h-10 w-full max-w-xl motion-reduce:animate-none" />
        <Skeleton className="mt-3 h-5 w-full max-w-2xl motion-reduce:animate-none" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: technical ? 5 : 7 }, (_, index) => (
          <Skeleton key={index} className="h-[148px] motion-reduce:animate-none" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Skeleton className="h-[320px] motion-reduce:animate-none" />
        <Skeleton className="h-[320px] motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function DashboardError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <Card className="mx-auto max-w-2xl" role="alert">
      <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-destructive-soft text-destructive">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-semibold">Não foi possível carregar o painel</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Os indicadores não foram substituídos por estimativas. Tente consultar o serviço novamente.
        </p>
        <Button className="mt-5" variant="outline" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={cn('h-4 w-4', retrying && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
          {retrying ? 'Consultando…' : 'Tentar novamente'}
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyPanel({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-[180px] flex-col items-center justify-center p-8 text-center">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-4 font-semibold">{title}</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function isUrgentMetric(metric: DashboardMetric) {
  return metric.value > 0 && ['past_due', 'sla', 'builds_failed', 'sync', 'storage', 'errors'].includes(metric.key);
}

function attentionAction(item: DashboardAttention, technical: boolean, can: CanAccess): AttentionAction {
  let destination: string | null = null;
  let permission: InternalPermission | null = null;

  if (technical) {
    destination = '/app/desenvolvimento/logs';
    permission = 'technical.read';
  } else if (item.type === 'support') {
    destination = '/app/suporte';
    permission = 'support.read';
  } else if (item.customerId) {
    destination = customerDetailPath(item.customerId);
    permission = 'customer.read';
  } else if (item.type === 'renewal') {
    destination = '/app/assinaturas';
    permission = 'commercial.read';
  }

  if (!destination || !permission) {
    return {
      destination: null,
      unavailableReason: 'Este tipo de alerta não possui um módulo de destino.',
    };
  }

  if (!can(permission)) {
    return {
      destination: null,
      unavailableReason: 'Seu perfil pode acompanhar este alerta, mas não tem acesso ao módulo correspondente.',
    };
  }

  return { destination, unavailableReason: null };
}

function attentionTone(status: string): 'secondary' | 'warning' | 'destructive' {
  if (['critical', 'error', 'failed'].includes(status)) return 'destructive';
  if (['warning', 'high', 'past_due'].includes(status)) return 'warning';
  return 'secondary';
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}
