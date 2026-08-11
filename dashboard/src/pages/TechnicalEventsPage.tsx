import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Database,
  FilterX,
  RefreshCw,
  ScrollText,
} from 'lucide-react';
import { PageHeader } from '@/components/domain/PageHeader';
import { MetricCard } from '@/components/domain/MetricCard';
import { StatusBadge } from '@/components/domain/Badges';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { jsonArray, jsonObject, jsonString } from '@/lib/json';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/types/supabase';

interface EventRow {
  id: string;
  version: string | null;
  platform: string;
  category: string;
  severity: string;
  correlation: string | null;
  summary: string;
  occurredAt: string;
  customerId: string | null;
  customerName: string | null;
}

const pageCopy = {
  sync: {
    eyebrow: 'Operação técnica',
    description: 'Acompanhe ciclos, conflitos e falhas de sincronização por cliente, versão e plataforma.',
    Icon: RefreshCw,
  },
  storage: {
    eyebrow: 'Infraestrutura de dados',
    description: 'Observe gravações, uploads e falhas de persistência sem expor conteúdo sensível.',
    Icon: Database,
  },
  logs: {
    eyebrow: 'Observabilidade',
    description: 'Investigue eventos sanitizados com correlação, severidade e contexto operacional.',
    Icon: ScrollText,
  },
} as const;

export function TechnicalEventsPage({
  category: fixedCategory,
  title,
}: {
  category?: string;
  title: string;
}) {
  const { can, user, profile } = useAuth();
  const page = pageCopy[fixedCategory === 'sync' ? 'sync' : fixedCategory === 'storage' ? 'storage' : 'logs'];
  const [customer, setCustomer] = useState('');
  const [version, setVersion] = useState('');
  const [platform, setPlatform] = useState('all');
  const [category, setCategory] = useState(fixedCategory || 'all');
  const [severity, setSeverity] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const deferredCustomer = useDeferredValue(customer);
  const deferredVersion = useDeferredValue(version);
  const invalidDateRange = Boolean(from && to && from > to);

  const query = useQuery({
    queryKey: ['technical-events', user?.id, profile?.role, fixedCategory || 'logs', deferredCustomer, deferredVersion, platform, category, severity, from, to],
    enabled: !invalidDateRange,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_internal_technical_events', {
        p_customer_id: deferredCustomer || undefined,
        p_version: deferredVersion || undefined,
        p_platform: platform === 'all' ? undefined : platform,
        p_category: category === 'all' ? undefined : category,
        p_severity: severity === 'all' ? undefined : severity,
        p_from: from ? new Date(from).toISOString() : undefined,
        p_to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
        p_limit: 250,
      });
      if (error) throw error;
      return jsonArray(data).map(parseTechnicalEvent).filter((event): event is EventRow => event !== null);
    },
  });

  const metrics = useMemo(() => {
    const events = invalidDateRange ? [] : query.data ?? [];
    return {
      total: events.length,
      critical: events.filter((event) => ['error', 'critical'].includes(event.severity)).length,
      warnings: events.filter((event) => event.severity === 'warning').length,
      customers: new Set(events.map((event) => event.customerId).filter(Boolean)).size,
    };
  }, [invalidDateRange, query.data]);

  const hasFilters = Boolean(customer || version || platform !== 'all' || severity !== 'all' || from || to || (!fixedCategory && category !== 'all'));
  function clearFilters() {
    setCustomer('');
    setVersion('');
    setPlatform('all');
    setCategory(fixedCategory || 'all');
    setSeverity('all');
    setFrom('');
    setTo('');
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={page.eyebrow}
        title={title}
        description={page.description}
        actions={(
          <Button variant="outline" disabled={query.isFetching || invalidDateRange} onClick={() => void query.refetch()}>
            <RefreshCw className={query.isFetching ? 'h-4 w-4 animate-spin motion-reduce:animate-none' : 'h-4 w-4'} />
            {query.isFetching ? 'Atualizando…' : 'Atualizar'}
          </Button>
        )}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo dos eventos">
        <MetricCard label="Eventos retornados" value={metrics.total} icon={page.Icon} />
        <MetricCard label="Erros críticos" value={metrics.critical} icon={AlertTriangle} />
        <MetricCard label="Avisos" value={metrics.warnings} icon={Boxes} />
        <MetricCard label="Clientes afetados" value={metrics.customers} icon={CheckCircle2} />
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Filtros da investigação</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              O estado destes filtros pertence somente a {title.toLowerCase()}.
            </p>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <FilterX className="h-4 w-4" />
              Limpar
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="ID do cliente" aria-label="Filtrar cliente" />
          <Input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="Versão do app" aria-label="Filtrar versão" />
          <FilterSelect label="Filtrar plataforma" value={platform} onValueChange={setPlatform} values={['android', 'ios', 'web', 'server', 'unknown']} all="Todas as plataformas" />
          {!fixedCategory && <FilterSelect label="Filtrar categoria" value={category} onValueChange={setCategory} values={['version', 'build', 'sync', 'storage', 'runtime', 'configuration']} all="Todas as categorias" />}
          <FilterSelect label="Filtrar severidade" value={severity} onValueChange={setSeverity} values={['debug', 'info', 'warning', 'error', 'critical']} all="Todas as severidades" />
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Data inicial" />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Data final" />
        </CardContent>
      </Card>

      {invalidDateRange ? (
        <p role="alert" className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-foreground">
          A data inicial deve ser anterior ou igual à data final. Corrija o período para consultar eventos.
        </p>
      ) : null}

      <AsyncBoundary
        loading={!invalidDateRange && query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={Boolean(!invalidDateRange && query.data && !query.data.length)}
        emptyTitle="Nenhum evento persistido"
        emptyDescription="A fonte respondeu sem eventos para os filtros selecionados."
      >
        {!invalidDateRange && query.data && (
          <section className="space-y-3" aria-label={`Eventos de ${title.toLowerCase()}`}>
            {query.data.map((event) => (
              <Card key={event.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={event.severity} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {ptBrLabel(event.category)} · {ptBrLabel(event.platform)}
                    </span>
                    <time className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto" dateTime={event.occurredAt}>
                      {new Date(event.occurredAt).toLocaleString('pt-BR')}
                    </time>
                  </div>
                  <p className="mt-3 font-semibold leading-6">{event.summary}</p>
                  <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                    <span>Versão {event.version || '—'}</span>
                    <span aria-hidden="true" className="hidden sm:inline">·</span>
                    <span className="break-all">Correlação {event.correlation || event.id}</span>
                    {event.customerId && can('customer.read') ? (
                      <Link className="font-semibold text-primary underline-offset-4 hover:underline" to={`/app/clientes/${encodeURIComponent(event.customerId)}`}>
                        {event.customerName || 'Abrir cliente'}
                      </Link>
                    ) : event.customerId ? <span>{event.customerName || 'Cliente identificado'}</span> : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </AsyncBoundary>
    </div>
  );
}

function parseTechnicalEvent(value: Json): EventRow | null {
  const row = jsonObject(value);
  const id = jsonString(row?.id) || jsonString(row?.event_key);
  const summary = jsonString(row?.summary);
  const occurredAt = jsonString(row?.occurred_at);
  const platform = jsonString(row?.platform);
  const category = jsonString(row?.category);
  const severity = jsonString(row?.severity);
  if (!id || !summary || !occurredAt || !platform || !category || !severity || Number.isNaN(new Date(occurredAt).getTime())) {
    return null;
  }
  return {
    id,
    version: jsonString(row?.app_version),
    platform,
    category,
    severity,
    correlation: jsonString(row?.correlation_id),
    summary,
    occurredAt,
    customerId: jsonString(row?.customer_id),
    customerName: jsonString(row?.customer_name),
  };
}

function FilterSelect({
  label,
  value,
  onValueChange,
  values,
  all,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  values: string[];
  all: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{all}</SelectItem>
        {values.map((item) => <SelectItem key={item} value={item}>{ptBrLabel(item)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
