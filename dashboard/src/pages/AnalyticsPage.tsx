import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// ─── Analytics do owner (F6) ─────────────────────────────────────────────────

interface Analytics {
  mrr_centavos: number;
  recebido_mes_centavos: number;
  organizacoes: Record<string, number>;
  agentes_ativos_30d: number;
  series_6m: { mes: string; receita_centavos: number; vistorias: number }[];
  qe: {
    pendentes: number;
    avaliadas_30d: number;
    aprovadas_30d: number;
    nota_media: number | null;
    tempo_medio_horas: number | null;
  };
  top_orgs_90d: { org: string; vistorias: number }[];
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (cents: number) => BRL.format(cents / 100);

const MES_LABEL: Record<string, string> = {
  '01': 'jan', '02': 'fev', '03': 'mar', '04': 'abr', '05': 'mai', '06': 'jun',
  '07': 'jul', '08': 'ago', '09': 'set', '10': 'out', '11': 'nov', '12': 'dez',
};
const mesLabel = (yyyyMm: string) => {
  const [, m] = yyyyMm.split('-');
  return MES_LABEL[m] ?? yyyyMm;
};

function csvDownload(nome: string, linhas: string[][]) {
  const csv = linhas.map(l => l.map(c => `"${String(c).replaceAll('"', '""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsPage() {
  const [baixando, setBaixando] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['owner-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_owner_analytics');
      if (error) throw error;
      return data as Analytics;
    },
  });

  const series = useMemo(
    () => (data?.series_6m ?? []).map(s => ({ ...s, mes: mesLabel(s.mes), receita: s.receita_centavos / 100 })),
    [data],
  );

  const qePct = data && data.qe.avaliadas_30d > 0
    ? Math.round((data.qe.aprovadas_30d / data.qe.avaliadas_30d) * 100)
    : null;

  // ── Exports CSV ──
  const exportar = async (tipo: 'faturas' | 'orgs' | 'vistorias') => {
    setBaixando(tipo);
    try {
      if (tipo === 'faturas') {
        const { data: rows, error } = await supabase
          .from('billing_invoices')
          .select('competencia, valor_centavos, vencimento, status, pago_em, organizations(display_name)')
          .order('vencimento', { ascending: false });
        if (error) throw error;
        csvDownload('faturas.csv', [
          ['organizacao', 'competencia', 'valor_brl', 'vencimento', 'status', 'pago_em'],
          ...(rows ?? []).map((r: any) => [
            r.organizations?.display_name ?? r.organization_id,
            r.competencia,
            (r.valor_centavos / 100).toFixed(2).replace('.', ','),
            r.vencimento, r.status, r.pago_em ?? '',
          ]),
        ]);
      } else if (tipo === 'orgs') {
        const { data: rows, error } = await supabase
          .from('organizations')
          .select('display_name, municipality_name, status, created_at')
          .order('created_at', { ascending: false });
        if (error) throw error;
        csvDownload('organizacoes.csv', [
          ['nome', 'municipio', 'status', 'criada_em'],
          ...(rows ?? []).map((r: any) => [r.display_name, r.municipality_name ?? '', r.status, r.created_at]),
        ]);
      } else {
        const { data: rows, error } = await supabase
          .from('vistorias')
          .select('protocolo, municipio, agenteNome, nivelRisco, status, criadoEm')
          .order('criadoEm', { ascending: false })
          .limit(5000);
        if (error) throw error;
        csvDownload('vistorias.csv', [
          ['protocolo', 'municipio', 'agente', 'risco', 'status', 'criada_em'],
          ...(rows ?? []).map((r: any) => [r.protocolo ?? '', r.municipio, r.agenteNome, r.nivelRisco, r.status, r.criadoEm]),
        ]);
      }
      toast.success('CSV gerado.');
    } catch (e: any) {
      toast.error(`Falha no export: ${e.message}`);
    } finally {
      setBaixando(null);
    }
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando indicadores…</div>;
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Sem dados.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Receita, cobrança e operação em tempo real.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportar('vistorias')} disabled={baixando !== null}>
            <Download className="mr-1 h-4 w-4" />Vistorias
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportar('orgs')} disabled={baixando !== null}>
            <Download className="mr-1 h-4 w-4" />Orgs
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportar('faturas')} disabled={baixando !== null}>
            <Download className="mr-1 h-4 w-4" />Faturas
          </Button>
          <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isRefetching}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">MRR</p>
          <p className="mt-1 text-2xl font-bold">{fmt(data.mrr_centavos)}</p>
          <p className="text-xs text-muted-foreground">Somas mensais ativas</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Recebido este mês</p>
          <p className="mt-1 text-2xl font-bold">{fmt(data.recebido_mes_centavos)}</p>
          <p className="text-xs text-muted-foreground">Comprovantes aprovados</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Organizações</p>
          <p className="mt-1 text-2xl font-bold">{data.organizacoes.active ?? 0} <span className="text-sm font-normal text-muted-foreground">ativas</span></p>
          <p className="text-xs text-muted-foreground">
            {data.organizacoes.trial ?? 0} trial · {data.organizacoes.suspended ?? 0} suspensas
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Agentes ativos (30d)</p>
          <p className="mt-1 text-2xl font-bold">{data.agentes_ativos_30d}</p>
          <p className="text-xs text-muted-foreground">Com vistoria no mês</p>
        </CardContent></Card>
      </div>

      {/* Gráficos em barras */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Receita (últimos 6 meses)</h2></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v: number) => `R$${(v / 1000).toFixed(1)}k`} />
                <Tooltip formatter={(v: any) => fmt(Number(v) * 100)} />
                <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Vistorias (últimos 6 meses)</h2></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="vistorias" name="Vistorias" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* QE + top orgs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Qualidade (QE) — últimos 30 dias</h2></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Aguardando revisão" value={String(data.qe.pendentes)} />
            <Row label="Taxa de aprovação" value={qePct !== null ? `${qePct}%` : '—'} />
            <Row label="Nota média" value={data.qe.nota_media != null ? `${data.qe.nota_media}/10` : '—'} />
            <Row label="Tempo médio de revisão" value={data.qe.tempo_media_horas != null ? `${data.qe.tempo_medio_horas}h` : '—'} />
          </CardContent>
        </Card>        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Vistorias por organização (90 dias)</h2></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.top_orgs_90d.length === 0
              ? <p className="text-muted-foreground">Nenhuma vistoria no período.</p>
              : data.top_orgs_90d.map(o => (
                <div key={o.org} className="flex justify-between border-b pb-1 last:border-0">
                  <span>{o.org}</span>
                  <span className="font-semibold">{o.vistorias}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <RetencaoBloco />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

// ─── Retenção (F8): relatórios mensais + configuração ────────────────────────

interface RelatorioRow {
  id: string;
  competencia: string;
  enviado_em: string | null;
  resumo: { vistorias?: number; vistorias_mes_anterior?: number };
  organizations: { display_name: string } | null;
}

function RetencaoBloco() {
  const [dias, setDias] = useState(14);
  const [salvando, setSalvando] = useState(false);

  const relatorios = useQuery({
    queryKey: ['org-monthly-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_monthly_reports')
        .select('id, competencia, enviado_em, resumo, organizations(display_name)')
        .order('competencia', { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as RelatorioRow[];
    },
  });

  const cfg = useQuery({
    queryKey: ['retention-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retention_settings')
        .select('inatividade_dias')
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (cfg.data?.inatividade_dias) setDias(cfg.data.inatividade_dias);
  }, [cfg.data]);

  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase
      .from('retention_settings')
      .update({ inatividade_dias: dias, atualizado_em: new Date().toISOString() })
      .eq('singleton', true);
    setSalvando(false);
    if (error) toast.error('Falha ao salvar: ' + error.message);
    else toast.success('Alerta de inatividade atualizado.');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Relatórios mensais (retenção)</h2></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(relatorios.data ?? []).length === 0
            ? <p className="text-muted-foreground">Gerados automaticamente todo dia 1º. Nenhum ainda.</p>
            : (relatorios.data ?? []).map(r => (
              <div key={r.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <p className="font-medium">{r.organizations?.display_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.competencia} · {r.resumo.vistorias ?? 0} vistorias
                  </p>
                </div>
                <span className={`text-xs font-medium ${r.enviado_em ? 'text-success' : 'text-warning'}`}>
                  {r.enviado_em ? 'E-mail enviado' : 'Pendente de e-mail'}
                </span>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Alerta de inatividade</h2></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Os administradores de uma organização recebem um aviso no app quando ela fica
            este número de dias sem registrar vistoria.
          </p>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="inat" className="text-xs font-medium">Dias sem vistoria</label>
              <input
                id="inat" type="number" min={3} max={90}
                className="w-28 rounded-md border bg-background px-3 py-2 text-sm"
                value={dias} onChange={e => setDias(Number(e.target.value))}
              />
            </div>
            <Button size="sm" onClick={() => void salvar()} disabled={salvando}>Salvar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AnalyticsPage;
