import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, Search } from 'lucide-react';
import { PageHeader } from '@/components/domain/PageHeader';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { jsonArray, jsonObject, jsonString } from '@/lib/json';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

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
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [result, setResult] = useState('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [category, setCategory] = useState<Category>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const from = rangeStart(timeRange);
  const query = useQuery({
    queryKey: ['audit-timeline', search, source, result, timeRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_internal_audit_timeline', {
        p_search: search || undefined,
        p_source: source === 'all' ? undefined : source,
        p_result: result === 'all' ? undefined : result,
        p_from: from,
        p_to: undefined,
        p_limit: 250,
      });
      if (error) throw error;
      return jsonArray(data)
        .map(jsonObject)
        .filter(Boolean)
        .map((row): AuditRow => ({
          source: jsonString(row?.source) || 'internal',
          id: jsonString(row?.event_id) || crypto.randomUUID(),
          type: jsonString(row?.event_type) || 'evento',
          entity: jsonString(row?.entity_type) || '—',
          entityId: jsonString(row?.entity_id),
          actor: jsonString(row?.actor_name) || 'Sistema',
          result: jsonString(row?.result) || 'allowed',
          reason: jsonString(row?.reason),
          createdAt: jsonString(row?.created_at) || new Date(0).toISOString(),
        }));
    },
  });
  const rows = useMemo(
    () => (query.data ?? []).filter((row) => matchesCategory(row, category)),
    [category, query.data],
  );
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

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
        description="Reconstrua decisões, acessos e mudanças com contexto e evidência."
      />

      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-3 p-2 lg:flex-row lg:items-center">
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
                  onClick={() => {
                    setSource('all');
                    setResult('all');
                    setTimeRange('all');
                    setCategory('all');
                  }}
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
                <h2 className="text-[17px] font-bold">Linha do tempo</h2>
              </div>
              <div className="px-6 pb-6">
                {rows.map((row) => (
                  <article
                    key={`${row.source}-${row.id}`}
                    className="grid grid-cols-[48px_20px_minmax(0,1fr)] border-b py-5 sm:grid-cols-[60px_24px_minmax(0,1fr)_auto]"
                  >
                    <time className="pt-0.5 text-[11px] font-bold text-muted-foreground" dateTime={row.createdAt}>
                      {formatTime(row.createdAt)}
                    </time>
                    <span className="relative flex justify-center">
                      <span className={cn('relative z-10 mt-0.5 h-4 w-4 rounded-full', auditTone(row))} />
                      <span className="absolute bottom-[-21px] top-4 w-px bg-border" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 px-2">
                      <h3 className="truncate text-[13px] font-bold">{humanize(row.type)}</h3>
                      <p className="mt-1 text-[11px] font-medium text-muted-foreground">{row.actor}</p>
                      <p className="mt-1 truncate text-[11px] font-medium text-info">
                        {row.entity}{row.entityId ? ` · ${shortId(row.entityId)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      aria-pressed={selected?.id === row.id}
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
    ['Alvo', row.entityId ? `${row.entity} · ${shortId(row.entityId)}` : row.entity],
    ['Resultado', auditResultLabel(row.result)],
  ];
  return (
    <Card className="min-h-[630px] overflow-hidden border-foreground bg-foreground text-background shadow-none">
      <CardContent className="p-6">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Evento selecionado</p>
        <h2 className="mt-5 text-xl font-bold">{humanize(row.type)}</h2>
        <p className="mt-2 truncate font-mono text-[10px] text-background/60">{shortId(row.id, 22)}</p>
        <dl className="mt-8 border-t border-background/10 pt-2">
          {details.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-4 text-[11px]">
              <dt className="text-[10px] text-background/60">{label}</dt>
              <dd className="break-words font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Contexto sanitizado</p>
          <div className="mt-4 min-h-28 rounded-lg border border-background/10 bg-background/[0.035] p-4">
            <p className="whitespace-pre-wrap break-words text-[11px] leading-5 text-background/75">
              {row.reason || 'Nenhum motivo adicional informado para este evento.'}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <Badge variant={['denied', 'failed'].includes(row.result) ? 'destructive' : 'success'}>
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

function humanize(value: string) {
  const normalized = value.replace(/[._-]+/g, ' ').trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Evento';
}

function shortId(value: string, limit = 12) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
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
      row.source,
      row.type,
      row.actor,
      row.entity,
      row.entityId || '',
      row.result,
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
  return ptBrLabel(value);
}

function auditResultLabel(value: string) {
  if (value === 'allowed') return 'Sucesso';
  if (value === 'denied') return 'Negado';
  return ptBrLabel(value);
}
