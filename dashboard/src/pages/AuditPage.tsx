import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileSearch, Filter, FilterX, Search, UsersRound } from 'lucide-react';
import { PageHeader } from '@/components/domain/PageHeader';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { jsonArray, jsonObject, jsonString } from '@/lib/json';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/types/supabase';

interface AuditRow {
  source: string;
  id: string;
  type: string;
  entity: string;
  entityId: string | null;
  actor: string;
  result: string;
  reason: string | null;
  createdAt: string;
}

type TimeRange = 'today' | '7d' | '30d' | 'all';
type Category = 'all' | 'access' | 'configuration';

export function AuditPage() {
  const { user, profile } = useAuth();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [result, setResult] = useState('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [category, setCategory] = useState<Category>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);
  const from = rangeStart(timeRange);
  const query = useQuery({
    queryKey: ['audit-timeline', user?.id, profile?.role, deferredSearch, source, result, timeRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_internal_audit_timeline', {
        p_search: deferredSearch || undefined,
        p_source: source === 'all' ? undefined : source,
        p_result: result === 'all' ? undefined : result,
        p_from: from,
        p_to: undefined,
        p_limit: 250,
      });
      if (error) throw error;
      return jsonArray(data).map(parseAuditRow).filter((row): row is AuditRow => row !== null);
    },
  });
  const rows = useMemo(
    () => consolidateAuditRows(query.data ?? []).filter((row) => matchesCategory(row, category)),
    [category, query.data],
  );
  const selected = rows.find((row) => auditKey(row) === selectedKey) ?? rows[0] ?? null;
  const metrics = useMemo(() => ({
    total: rows.length,
    successful: rows.filter((row) => row.result === 'allowed').length,
    needsReview: rows.filter((row) => ['denied', 'failed', 'error'].includes(row.result)).length,
    actors: new Set(rows.map((row) => row.actor).filter((actor) => actor !== 'Sistema')).size,
  }), [rows]);
  const hasFilters = Boolean(search || source !== 'all' || result !== 'all' || timeRange !== '30d' || category !== 'all');

  function clearFilters() {
    setSearch('');
    setSource('all');
    setResult('all');
    setTimeRange('30d');
    setCategory('all');
  }

  return (
    <div className="page-stack">
      <form
        id="audit-export-form"
        className="sr-only"
        onSubmit={(event) => {
          event.preventDefault();
          exportAuditRows(rows);
        }}
      />

      <PageHeader
        eyebrow="Governança"
        title="Auditoria"
        description="Entenda o que aconteceu, quem realizou a ação e qual foi o resultado — sem depender de códigos técnicos."
      />

      <AuditPulse metrics={metrics} />

      <Card className="bg-muted/45 shadow-none">
        <CardHeader className="flex-row items-start justify-between gap-4 pb-0">
          <div>
            <CardTitle>Filtros da investigação</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Refine os registros por período, tipo de ação, origem ou resultado.</p>
          </div>
          {hasFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <FilterX className="h-4 w-4" />
              Limpar filtros
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-3 pt-4 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1 lg:max-w-[420px]">
            <span className="sr-only">Buscar auditoria</span>
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pessoa, recurso ou identificador"
              className="h-11 border-0 bg-background pl-10 shadow-none"
            />
          </label>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
            {([
              ['today', 'Hoje'],
              ['7d', '7 dias'],
              ['30d', '30 dias'],
              ['all', 'Tudo'],
            ] as const).map(([value, label]) => (
              <FilterChip
                key={value}
                active={timeRange === value}
                onClick={() => setTimeRange(value)}
                label={label}
              />
            ))}
            <FilterChip
              active={category === 'access'}
              onClick={() => setCategory(category === 'access' ? 'all' : 'access')}
              label="Acesso"
            />
            <FilterChip
              active={category === 'configuration'}
              onClick={() => setCategory(category === 'configuration' ? 'all' : 'configuration')}
              label="Configuração"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn('h-8 w-8 shrink-0 rounded-full', (source !== 'all' || result !== 'all') && 'border-primary')}
                  aria-label="Mais filtros de auditoria"
                >
                  <Filter className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold">Fonte</p>
                  <AuditSelect
                    label="Fonte"
                    value={source}
                    onValueChange={setSource}
                    options={[
                      ['all', 'Todas as fontes'],
                      ['internal', 'Interna'],
                      ['commercial', 'Comercial'],
                      ['support', 'Suporte'],
                      ['technical', 'Telemetria'],
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold">Resultado</p>
                  <AuditSelect
                    label="Resultado"
                    value={result}
                    onValueChange={setResult}
                    options={[
                      ['all', 'Todos os resultados'],
                      ['allowed', 'Permitido'],
                      ['denied', 'Negado'],
                      ['failed', 'Falhou'],
                    ]}
                  />
                </div>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={clearFilters}
                >
                  Limpar filtros
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <AsyncBoundary
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={Boolean(query.data && !rows.length)}
        emptyTitle="Sem eventos"
        emptyDescription="Nenhum evento corresponde aos filtros."
      >
        {rows.length ? (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_334px]">
            <Card className="min-h-[630px] overflow-hidden shadow-none">
              <div className="px-6 py-5">
                <h2 className="text-[17px] font-bold">Registros encontrados</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {rows.length} {rows.length === 1 ? 'evento consolidado' : 'eventos consolidados'} no período selecionado
                </p>
              </div>
              <div className="px-6 pb-6">
                {rows.map((row) => (
                  <article
                    key={`${row.source}-${row.id}`}
                    className={cn(
                      'grid grid-cols-[72px_20px_minmax(0,1fr)] rounded-xl border-b px-3 py-5 transition-colors sm:grid-cols-[104px_24px_minmax(0,1fr)_auto]',
                      selected && auditKey(selected) === auditKey(row) && 'border-transparent bg-success-soft',
                    )}
                  >
                    <time className="pt-0.5 text-[11px] font-bold text-muted-foreground" dateTime={row.createdAt}>
                      {formatTimelineDateTime(row.createdAt)}
                    </time>
                    <span className="relative flex justify-center">
                      <span className={cn('relative z-10 mt-0.5 h-4 w-4 rounded-full', auditTone(row))} />
                      <span className="absolute bottom-[-21px] top-4 w-px bg-border" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 px-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={auditBadgeVariant(row.result)}>{auditResultLabel(row.result)}</Badge>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{auditSourceLabel(row.source)}</span>
                      </div>
                      <h3 className="mt-2 truncate text-[13px] font-bold">{auditActionLabel(row.type)}</h3>
                      <p className="mt-1 text-[11px] font-medium text-muted-foreground">Por {row.actor}</p>
                      <p className="mt-1 truncate text-[11px] font-medium text-foreground">
                        {auditEntityLabel(row.entity)}{row.entityId ? ` · ${shortId(row.entityId)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(auditKey(row))}
                      aria-pressed={selected ? auditKey(selected) === auditKey(row) : false}
                      className="col-start-3 mt-3 justify-self-start text-[11px] font-semibold text-primary hover:underline sm:col-start-auto sm:mt-1 sm:justify-self-end"
                    >
                      Ver detalhes →
                    </button>
                  </article>
                ))}
              </div>
            </Card>
            <AuditInspector row={selected} />
          </div>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}

function parseAuditRow(value: Json): AuditRow | null {
  const row = jsonObject(value);
  const source = jsonString(row?.source);
  const id = jsonString(row?.event_id);
  const type = jsonString(row?.event_type);
  const entity = jsonString(row?.entity_type);
  const actor = jsonString(row?.actor_name);
  const result = jsonString(row?.result);
  const createdAt = jsonString(row?.created_at);
  if (!source || !id || !type || !entity || !actor || !result || !createdAt || Number.isNaN(new Date(createdAt).getTime())) {
    return null;
  }
  return {
    source,
    id,
    type,
    entity,
    entityId: jsonString(row?.entity_id),
    actor,
    result,
    reason: jsonString(row?.reason),
    createdAt,
  };
}

function auditKey(row: AuditRow) {
  return `${row.source}:${row.id}`;
}

function consolidateAuditRows(rows: AuditRow[]) {
  return rows.filter((row, index, allRows) => {
    if (!isTechnicalMutation(row)) return true;
    return !allRows.some((candidate, candidateIndex) => (
      candidateIndex !== index
      && !isTechnicalMutation(candidate)
      && Boolean(row.entityId)
      && candidate.entityId === row.entityId
      && candidate.actor === row.actor
      && Math.abs(new Date(candidate.createdAt).getTime() - new Date(row.createdAt).getTime()) <= 120_000
    ));
  });
}

function isTechnicalMutation(row: AuditRow) {
  return /^(insert|update|delete)$/i.test(row.type.trim());
}

function AuditPulse({ metrics }: { metrics: { total: number; successful: number; needsReview: number; actors: number } }) {
  const indicators = [
    { label: 'Registros no período', value: metrics.total, icon: FileSearch, tone: 'bg-info-soft text-info' },
    { label: 'Ações concluídas', value: metrics.successful, icon: CheckCircle2, tone: 'bg-success-soft text-success' },
    { label: 'Exigem revisão', value: metrics.needsReview, icon: AlertTriangle, tone: 'bg-warning-soft text-warning' },
    { label: 'Responsáveis', value: metrics.actors, icon: UsersRound, tone: 'bg-secondary text-muted-foreground' },
  ];
  return (
    <section className="rounded-2xl border border-border/85 bg-muted/45 p-3 sm:p-4" aria-label="Resumo da auditoria">
      <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {indicators.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-5 xl:first:pl-2">
            <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', tone)}><Icon className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] tabular-nums">{value.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-8 shrink-0 rounded-full border px-3 text-[11px] font-semibold',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary',
      )}
    >
      {label}
    </button>
  );
}

function AuditInspector({ row }: { row: AuditRow | null }) {
  if (!row) return null;
  const details = [
    ['Responsável', row.actor],
    ['Origem', auditSourceLabel(row.source)],
    ['Data', formatDateTime(row.createdAt)],
    ['Alvo', row.entityId ? `${auditEntityLabel(row.entity)} · ${shortId(row.entityId)}` : auditEntityLabel(row.entity)],
    ['Resultado', auditResultLabel(row.result)],
  ];
  return (
    <Card className="min-h-[630px] overflow-hidden border-primary/15 bg-muted/65 text-foreground shadow-none">
      <CardContent className="p-6">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Evento selecionado</p>
        <h2 className="mt-5 text-xl font-bold">{auditActionLabel(row.type)}</h2>
        <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground">{shortId(row.id, 22)}</p>
        <dl className="mt-8 border-t border-border pt-2">
          {details.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-4 text-[11px]">
              <dt className="text-[10px] text-muted-foreground">{label}</dt>
              <dd className="break-words font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Contexto sanitizado</p>
          <div className="mt-4 min-h-28 rounded-xl border border-border bg-card p-4">
            <p className="whitespace-pre-wrap break-words text-[11px] leading-5 text-muted-foreground">
              {row.reason || 'Nenhum motivo adicional informado para este evento.'}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <Badge variant={auditBadgeVariant(row.result)}>
            {auditResultLabel(row.result)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, optionLabel]) => (
          <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function matchesCategory(row: AuditRow, category: Category) {
  if (category === 'all') return true;
  const haystack = `${row.type} ${row.entity} ${row.source}`.toLowerCase();
  if (category === 'access') return /(session|sess|access|acesso|login|auth|staff|user|usu)/.test(haystack);
  return /(config|risk|risco|form|version|vers|build|setting|policy|política)/.test(haystack);
}

function rangeStart(range: TimeRange) {
  if (range === 'all') return undefined;
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (range === '7d') date.setDate(date.getDate() - 6);
  if (range === '30d') date.setDate(date.getDate() - 29);
  return date.toISOString();
}

function auditTone(row: AuditRow) {
  if (['denied', 'failed', 'error'].includes(row.result)) return 'bg-destructive';
  if (/(access|session|auth|staff)/i.test(`${row.type} ${row.entity}`)) return 'bg-warning';
  if (/(subscription|commercial)/i.test(`${row.type} ${row.source}`)) return 'bg-success';
  return 'bg-info';
}

const auditActionLabels: Record<string, string> = {
  'configuration.published': 'Configuração publicada',
  'customer.appointment.create': 'Agendamento criado pela web',
  'session.review': 'Sessão revisada',
  'session.terminate': 'Sessão revogada remotamente',
  'session.revoke': 'Sessão revogada remotamente',
  'password.reset': 'Senha redefinida',
  'user.block': 'Acesso de membro bloqueado',
  'user.unblock': 'Acesso de membro liberado',
};

const auditEntityLabels: Record<string, string> = {
  active_session: 'Sessão ativa',
  appointment: 'Agendamento',
  configuration: 'Configuração',
  organization: 'Organização',
  support_ticket: 'Chamado de suporte',
  technical_event: 'Evento técnico',
  user: 'Usuário',
};

function auditActionLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  const exact = auditActionLabels[normalized];
  if (exact) return exact;

  const telemetry = /^telemetry\.([a-z_]+)\.([a-z_]+)$/.exec(normalized);
  if (telemetry) {
    return `Telemetria de ${ptBrLabel(telemetry[1]).toLowerCase()}: ${ptBrLabel(telemetry[2]).toLowerCase()}`;
  }

  const label = normalized
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => ptBrLabel(part))
    .join(' ');
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Evento registrado';
}

function auditEntityLabel(value: string) {
  return auditEntityLabels[value.toLowerCase()] ?? ptBrLabel(value);
}

function auditBadgeVariant(value: string): 'destructive' | 'success' | 'warning' {
  if (['denied', 'failed', 'error'].includes(value)) return 'destructive';
  if (value === 'allowed') return 'success';
  return 'warning';
}

function shortId(value: string, limit = 12) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function formatTimelineDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
}

function exportAuditRows(rows: AuditRow[]) {
  if (!rows.length) return;
  const values = [
    ['Data', 'Fonte', 'Ação', 'Responsável', 'Alvo', 'Identificador', 'Resultado', 'Motivo'],
    ...rows.map((row) => [
      row.createdAt,
      auditSourceLabel(row.source),
      auditActionLabel(row.type),
      row.actor,
      auditEntityLabel(row.entity),
      row.entityId || '',
      auditResultLabel(row.result),
      row.reason || '',
    ]),
  ];
  const csv = values.map((line) => line.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `auditoria-tcs-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function auditSourceLabel(value: string) {
  if (value === 'internal') return 'TCS Console';
  if (value === 'commercial') return 'Comercial';
  if (value === 'support') return 'Suporte';
  if (value === 'technical') return 'Telemetria';
  return ptBrLabel(value);
}

function auditResultLabel(value: string) {
  if (value === 'allowed') return 'Sucesso';
  if (value === 'denied') return 'Negado';
  return ptBrLabel(value);
}
