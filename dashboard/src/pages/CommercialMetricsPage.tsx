import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, CircleAlert, CreditCard, Headphones, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/domain/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { supabase } from '@/lib/supabase';
import { customerDetailPath } from '@/lib/customerRoutes';
import type { Json } from '@/types/supabase';

type Metric = { key: string; label: string; value: number };
type Priority = { type: string; label: string; detail: string | null; status: string | null; customerId: string | null; dueAt: string | null };

function parseBusiness(value: Json | null) {
  const root = jsonObject(value);
  return {
    metrics: jsonArray(root?.metrics).map(jsonObject).filter(Boolean).map((row) => ({
      key: jsonString(row?.key) || 'metric',
      label: jsonString(row?.label) || 'Indicador',
      value: jsonNumber(row?.value) || 0,
    })) as Metric[],
    priorities: jsonArray(root?.attention).map(jsonObject).filter(Boolean).map((row) => ({
      type: jsonString(row?.type) || 'event',
      label: jsonString(row?.label) || 'Evento',
      detail: jsonString(row?.detail),
      status: jsonString(row?.status),
      customerId: jsonString(row?.customer_id),
      dueAt: jsonString(row?.due_at),
    })) as Priority[],
  };
}

export function CommercialMetricsPage() {
  const { profile } = useAuth();
  const query = useQuery({
    queryKey: ['commercial-metrics', profile?.userId, profile?.role],
    enabled: Boolean(profile),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_internal_dashboard');
      if (error) throw error;
      return parseBusiness(data);
    },
  });
  const metrics = query.data?.metrics ?? [];
  const priorities = query.data?.priorities ?? [];
  const businessMetrics = ['customers', 'subscriptions', 'renewals', 'past_due'].map((key) => (
    metrics.find((metric) => metric.key === key) ?? { key, label: labelFor(key), value: 0 }
  ));
  const support = metrics.find((metric) => metric.key === 'support')?.value ?? 0;
  const breachedSla = metrics.find((metric) => metric.key === 'sla')?.value ?? 0;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Negócio"
        title="Indicadores"
        description="Acompanhe carteira, renovações e suporte usando os dados operacionais do console."
      />

      <AsyncBoundary
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={false}
      >
        <section className="rounded-2xl border border-border/85 bg-muted/45 p-3 sm:p-4" aria-label="Panorama comercial">
          <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
            {businessMetrics.map((metric) => (
              <div key={metric.key} className="min-w-0 px-4 py-3 sm:px-5 xl:first:pl-2">
                <p className="text-[11px] font-semibold text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums tracking-[-0.04em]">{metric.value.toLocaleString('pt-BR')}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="border-warning/15 bg-muted/30 shadow-none">
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Prioridades da carteira</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Renovações, pendências e SLAs que pedem decisão.</p>
              </div>
              <Badge variant="secondary">{priorities.length}</Badge>
            </CardHeader>
            <CardContent>
              {priorities.length ? (
                <ul className="divide-y divide-border">
                  {priorities.map((item, index) => (
                    <li key={`${item.type}-${item.customerId ?? item.label}-${index}`} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.label}</p>{item.status && <Badge variant={item.status === 'past_due' || item.status === 'critical' ? 'destructive' : 'secondary'}>{item.status}</Badge>}</div>
                        {item.detail && <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>}
                        {item.dueAt && <p className="mt-2 text-xs text-muted-foreground">Prazo: {formatDate(item.dueAt)}</p>}
                      </div>
                      {item.customerId ? <Link className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline" to={item.type === 'support' ? '/app/suporte' : customerDetailPath(item.customerId)}>Abrir <ArrowRight className="h-4 w-4" /></Link> : null}
                    </li>
                  ))}
                </ul>
              ) : <EmptyPriorities />}
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm">
            <CardContent className="p-6">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Operação conectada</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">O indicador não substitui o trabalho da equipe: ele aponta a próxima área para agir.</p>
              <dl className="mt-6 space-y-4 border-t border-border/80 pt-5">
                <MetricLine icon={Headphones} label="Chamados abertos" value={support} />
                <MetricLine icon={CircleAlert} label="SLAs violados" value={breachedSla} danger={breachedSla > 0} />
              </dl>
              <div className="mt-6 space-y-2">
                <QuickLink to="/app/clientes" icon={Building2} label="Abrir clientes" />
                <QuickLink to="/app/assinaturas" icon={CreditCard} label="Revisar assinaturas" />
                <QuickLink to="/app/suporte" icon={Headphones} label="Atender suporte" />
              </div>
            </CardContent>
          </Card>
        </div>
      </AsyncBoundary>
    </div>
  );
}

function MetricLine({ icon: Icon, label, value, danger = false }: { icon: typeof Sparkles; label: string; value: number; danger?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</dt><dd className={danger ? 'font-semibold tabular-nums text-destructive' : 'font-semibold tabular-nums'}>{value}</dd></div>;
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: typeof Sparkles; label: string }) {
  return <Link to={to} className="flex items-center justify-between rounded-xl border border-primary/10 bg-card px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"><span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{label}</span><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link>;
}

function EmptyPriorities() {
  return <div className="rounded-2xl border border-dashed border-border p-8 text-center"><Sparkles className="mx-auto h-6 w-6 text-primary" /><p className="mt-3 font-semibold">Nenhuma prioridade retornada</p><p className="mt-1 text-sm text-muted-foreground">Acompanhe as rotas operacionais para confirmar a situação.</p></div>;
}

function labelFor(key: string) {
  return ({ customers: 'Clientes', subscriptions: 'Assinaturas vigentes', renewals: 'Renovações em 30 dias', past_due: 'Assinaturas em risco' } as Record<string, string>)[key] ?? 'Indicador';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'não informado' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
