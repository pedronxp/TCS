import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChartNoAxesCombined, Download, FileText, Filter, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { portalHome, portalRestrictionMessage } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

type Filters = {
  period: string;
  status: string;
  form: string;
  risk: string;
  neighborhood: string;
  team: string;
};

const DEFAULT_FILTERS: Filters = {
  period: 'last_30_days',
  status: 'all',
  form: 'all',
  risk: 'all',
  neighborhood: 'all',
  team: 'all',
};

const periodOptions: Array<{ value: string; label: string }> = [
  { value: 'last_7_days', label: 'Últimos 7 dias' },
  { value: 'last_30_days', label: 'Últimos 30 dias' },
  { value: 'last_90_days', label: 'Últimos 90 dias' },
  { value: 'this_year', label: 'Este ano' },
  { value: 'custom', label: 'Personalizado' },
];

const statusOptions: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todas as situações' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluídas' },
  { value: 'refused', label: 'Recusadas' },
];

const riskOptions: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos os riscos' },
  { value: 'low', label: 'Baixo' },
  { value: 'medium', label: 'Médio' },
  { value: 'high', label: 'Alto' },
  { value: 'critical', label: 'Crítico' },
];

type ReportingResult = {
  indicators: Array<{ key: string; label: string; value: number | string; detail?: string }>;
  rows: Array<Record<string, unknown>>;
  charts: Array<{ key: string; label: string; series: Array<{ label: string; value: number }> }>;
};

function parseReportingResult(value: unknown): ReportingResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid_reporting_response');
  }
  const source = value as Record<string, unknown>;
  const indicators = Array.isArray(source.indicators) ? source.indicators as ReportingResult['indicators'] : [];
  const rows = Array.isArray(source.rows) ? source.rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) as Array<Record<string, unknown>> : [];
  const charts = Array.isArray(source.charts) ? source.charts.filter((chart) => chart && typeof chart === 'object') as ReportingResult['charts'] : [];
  return { indicators, rows, charts };
}

export function PortalReportsPage() {
  const { access } = usePortalAuth();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [exporting, setExporting] = useState<null | 'csv' | 'pdf'>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  if (!access) return null;
  const root = portalHome(access.accountKind);
  const subscriptionBlocks = !access.creationAllowed;

  const query = useQuery({
    queryKey: ['portal', 'reporting', access.userId, access.accountKind, access.organizationId ?? null, access?.role ?? null, filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('portal_get_reporting', {
        p_period: filters.period,
        p_status: filters.status,
        p_form: filters.form,
        p_risk: filters.risk,
        p_neighborhood: filters.neighborhood,
        p_team: filters.team,
      });
      if (error) throw new Error(error.message);
      return parseReportingResult(data);
    },
  });

  const neighborhoods = useMemo(() => Array.from(new Set((query.data?.rows ?? []).map((row) => String(row.neighborhood ?? '')).filter(Boolean))), [query.data]);
  const teams = useMemo(() => Array.from(new Set((query.data?.rows ?? []).map((row) => String(row.team ?? row.agent_name ?? '')).filter(Boolean))), [query.data]);
  const forms = useMemo(() => Array.from(new Set((query.data?.rows ?? []).map((row) => String(row.form ?? row.type ?? '')).filter(Boolean))), [query.data]);

  function updateFilter<Key extends keyof Filters>(key: Key, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function exportRecorte(format: 'csv' | 'pdf') {
    if (!query.data || query.data.rows.length === 0) {
      setExportError('Não há recorte disponível para exportar com os filtros atuais.');
      return;
    }
    setExportError(null);
    setExporting(format);
    try {
      if (format === 'csv') {
        const rows = query.data.rows;
        const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
        const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const csv = [columns.map(quote).join(';'), ...rows.map((row) => columns.map((column) => quote(row[column])).join(';'))].join('\n');
        const suffix = suffixFromFilters(filters);
        const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `tcs-relatorio-${suffix}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        // PDF depende de contrato de exportação ainda indisponível.
        setExportError('A exportação em PDF ainda não está disponível no backend. Use a exportação em CSV ou solicite o endpoint no relatório de pendências.');
      }
    } catch {
      setExportError('Não foi possível gerar o arquivo. Tente novamente.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="page-stack">
      {subscriptionBlocks && (
        <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-foreground" role="status">
          Relatórios em consulta: {portalRestrictionMessage(access.restrictionCause ?? null)} A exportação de recortes volta após a regularização da assinatura.
        </p>
      )}
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Análise</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em]">Relatórios e estatísticas</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Filtre por período, situação, formulário, risco, bairro e equipe. Os indicadores e a tabela usam exatamente o recorte exibido na exportação.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Filter aria-hidden="true" />Filtros do recorte</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">Período
            <select className="mt-2 h-11 w-full rounded-md border bg-card px-3 text-sm" value={filters.period} onChange={(event) => updateFilter('period', event.target.value)}>
              {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Situação
            <select className="mt-2 h-11 w-full rounded-md border bg-card px-3 text-sm" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Formulário
            <select className="mt-2 h-11 w-full rounded-md border bg-card px-3 text-sm" value={filters.form} onChange={(event) => updateFilter('form', event.target.value)}>
              <option value="all">Todos os formulários</option>
              {forms.map((form) => <option key={form} value={form}>{form}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Risco
            <select className="mt-2 h-11 w-full rounded-md border bg-card px-3 text-sm" value={filters.risk} onChange={(event) => updateFilter('risk', event.target.value)}>
              {riskOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Bairro
            <select className="mt-2 h-11 w-full rounded-md border bg-card px-3 text-sm" value={filters.neighborhood} onChange={(event) => updateFilter('neighborhood', event.target.value)}>
              <option value="all">Todos os bairros</option>
              {neighborhoods.map((neighborhood) => <option key={neighborhood} value={neighborhood}>{neighborhood}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Equipe
            <select className="mt-2 h-11 w-full rounded-md border bg-card px-3 text-sm" value={filters.team} onChange={(event) => updateFilter('team', event.target.value)}>
              <option value="all">Toda a equipe</option>
              {teams.map((team) => <option key={team} value={team}>{team}</option>)}
            </select>
          </label>
        </CardContent>
      </Card>

      {exportError && <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-foreground" role="alert">{exportError}</p>}

      {query.isLoading && (
        <Card aria-busy="true">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center" role="status" aria-label="Carregando relatório">
            <LoaderCircle className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Carregando indicadores do escopo…</p>
          </CardContent>
        </Card>
      )}

      {query.isError && (
        <Card>
          <CardContent className="grid min-h-72 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary text-primary"><AlertCircle aria-hidden="true" /></span>
              <h2 className="mt-5 text-xl font-semibold">Relatórios em integração</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                O contrato <code className="rounded bg-secondary px-1 py-0.5 text-xs">portal_get_reporting</code> ainda não está disponível no backend. Os indicadores e a tabela aparecerão aqui assim que o endpoint for liberado, sem necessidade de nova implantação do portal.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => void query.refetch()}><RefreshCw aria-hidden="true" />Tentar novamente</Button>
                <Button asChild><a href={root}>Voltar para o início</a></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {query.data && query.data.indicators.length === 0 && query.data.rows.length === 0 && (
        <Card>
          <CardContent className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-secondary text-primary"><FileText className="h-5 w-5" aria-hidden="true" /></span>
              <h2 className="mt-4 font-semibold">Nenhum dado para este recorte</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Ajuste os filtros ou amplie o período. Nenhum valor foi estimado ou substituído.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {query.data && query.data.indicators.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores do recorte">
          {query.data.indicators.map((indicator) => (
            <Card key={indicator.key}>
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{indicator.label}</p>
                <p className="mt-3 text-2xl font-bold tabular-nums">{formatIndicator(indicator.value)}</p>
                {indicator.detail && <p className="mt-1 text-xs text-muted-foreground">{indicator.detail}</p>}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {query.data && query.data.charts.length > 0 && (
        <section className="grid gap-4 lg:grid-cols-2" aria-label="Gráficos do recorte">
          {query.data.charts.map((chart) => (
            <BarChartCard key={chart.key} chart={chart} />
          ))}
        </section>
      )}

      {query.data && query.data.rows.length > 0 && (
        <Card>
          <CardHeader className="min-h-[72px] gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Tabela do recorte</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{query.data.rows.length} registros no filtro atual.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => exportRecorte('csv')} disabled={exporting !== null || subscriptionBlocks} title={subscriptionBlocks ? 'A assinatura não permite exportar agora.' : 'Exportar recorte atual em CSV'}>
                {exporting === 'csv' ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download aria-hidden="true" />}Exportar CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportRecorte('pdf')} disabled={exporting !== null || subscriptionBlocks} title={subscriptionBlocks ? 'A assinatura não permite exportar agora.' : 'Exportar recorte atual em PDF'}>
                {exporting === 'pdf' ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download aria-hidden="true" />}Exportar PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-secondary/50 text-left">
                  <tr>{Object.keys(query.data.rows[0] ?? {}).map((column) => (
                    <th key={column} scope="col" className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{humanize(column)}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y">
                  {query.data.rows.map((row, index) => (
                    <tr key={String(row.id ?? index)}>
                      {Object.keys(query.data.rows[0] ?? {}).map((column) => (
                        <td key={column} className="whitespace-nowrap px-4 py-3">{formatCell(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BarChartCard({ chart }: { chart: ReportingResult['charts'][number] }) {
  const maxValue = Math.max(1, ...chart.series.map((point) => point.value));
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ChartNoAxesCombined className="h-4 w-4 text-primary" aria-hidden="true" />{chart.label}</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-3" role="list" aria-label={chart.label}>
          {chart.series.map((point) => {
            const percent = Math.round((point.value / maxValue) * 100);
            return (
              <li key={point.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{point.label}</span>
                  <span className="tabular-nums font-semibold text-muted-foreground">{point.value.toLocaleString('pt-BR')}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary" role="presentation">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="sr-only">Gráfico de barras acessível por teclado; cada barra representa {chart.label}.</p>
      </CardContent>
    </Card>
  );
}

function formatIndicator(value: number | string) {
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  return value;
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  if (typeof value === 'string') {
    if (!Number.isNaN(Date.parse(value)) && value.length > 10) return new Date(value).toLocaleDateString('pt-BR');
    return humanize(value);
  }
  return String(value);
}

function suffixFromFilters(filters: Filters) {
  return `${filters.period}-${filters.status}-${filters.risk}`.replace(/[^a-z0-9-]/gi, '').slice(0, 32);
}

function humanize(value: string) {
  const normalized = value.replace(/_/g, ' ');
  return normalized.charAt(0).toLocaleUpperCase('pt-BR') + normalized.slice(1);
}

export { DEFAULT_FILTERS };
