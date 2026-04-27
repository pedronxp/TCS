import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { AlertCircle, Download, Loader2, BarChart2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type VistoriaRow = {
  id: string;
  nivelRisco: string | null;
  dataVistoria: string | null;
  agenteUid: string | null;
  agenteNome: string | null;
  municipio: string | null;
};

type FiltroPeriodo = '7d' | '30d' | '90d' | 'todos';

// ─── Cores ────────────────────────────────────────────────────────────────────

const RISCO_COR: Record<string, string> = {
  r1: '#10b981',
  r2: '#f59e0b',
  r3: '#f97316',
  r4: '#ef4444',
};

const RISCO_LABEL: Record<string, string> = {
  r1: 'R1 — Baixo',
  r2: 'R2 — Médio',
  r3: 'R3 — Alto',
  r4: 'R4 — Crítico',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useRelatorios(periodo: FiltroPeriodo, municipioFiltro: string) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['relatorios', periodo, municipioFiltro, profile?.role, profile?.municipio],
    queryFn: async () => {
      let q = supabase
        .from('vistorias')
        .select('id, "nivelRisco", "dataVistoria", "agenteUid", "agenteNome", municipio')
        .order('dataVistoria', { ascending: false });

      if (profile?.role !== 'master_admin') {
        q = q.eq('municipio', profile?.municipio);
      } else if (municipioFiltro) {
        q = q.eq('municipio', municipioFiltro);
      }

      if (periodo !== 'todos') {
        const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
        const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
        q = q.gte('dataVistoria', desde);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as VistoriaRow[];
    },
    enabled: !!profile,
  });
}

// ─── Exportar CSV ─────────────────────────────────────────────────────────────

function exportarCSV(vistorias: VistoriaRow[], periodo: string) {
  const header = ['ID', 'Município', 'Nível de Risco', 'Agente', 'Data Vistoria'];
  const rows = vistorias.map((v) => [
    v.id,
    v.municipio ?? '',
    RISCO_LABEL[v.nivelRisco ?? ''] ?? v.nivelRisco ?? '',
    v.agenteNome ?? '',
    v.dataVistoria ? new Date(v.dataVistoria).toLocaleDateString('pt-BR') : '',
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio_vistorias_${periodo}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Cards de resumo ──────────────────────────────────────────────────────────

function CardResumo({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', cor)}>{valor}</p>
    </div>
  );
}

// ─── Tooltip personalizado ────────────────────────────────────────────────────

function TooltipCustom({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} vistoria{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function RelatoriosPage() {
  const { profile } = useAuth();
  const isMaster = profile?.role === 'master_admin';

  const [periodo, setPeriodo] = useState<FiltroPeriodo>('30d');
  const [municipioFiltro, setMunicipioFiltro] = useState('');

  const { data: vistorias = [], isLoading, isError, refetch } = useRelatorios(periodo, municipioFiltro);

  // ── Totais por risco
  const porRisco = useMemo(() => {
    const counts: Record<string, number> = { r1: 0, r2: 0, r3: 0, r4: 0 };
    for (const v of vistorias) {
      if (v.nivelRisco && counts[v.nivelRisco] !== undefined) {
        counts[v.nivelRisco]++;
      }
    }
    return counts;
  }, [vistorias]);

  const alto = porRisco.r3 + porRisco.r4;
  const medio = porRisco.r2;
  const baixo = porRisco.r1;

  // ── Dados para gráfico de barras
  const dadosBarras = useMemo(
    () =>
      ['r1', 'r2', 'r3', 'r4'].map((r) => ({
        name: r.toUpperCase(),
        total: porRisco[r],
        cor: RISCO_COR[r],
      })),
    [porRisco]
  );

  // ── Dados para gráfico de pizza
  const dadosPizza = useMemo(
    () =>
      ['r1', 'r2', 'r3', 'r4']
        .filter((r) => porRisco[r] > 0)
        .map((r) => ({
          name: r.toUpperCase(),
          value: porRisco[r],
          cor: RISCO_COR[r],
        })),
    [porRisco]
  );

  // ── Ranking de agentes
  const rankingAgentes = useMemo(() => {
    const map: Record<string, { nome: string; total: number }> = {};
    for (const v of vistorias) {
      if (!v.agenteUid) continue;
      if (!map[v.agenteUid]) map[v.agenteUid] = { nome: v.agenteNome ?? '—', total: 0 };
      map[v.agenteUid].total++;
    }
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [vistorias]);

  const periodos: { key: FiltroPeriodo; label: string }[] = [
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: '90d', label: '90 dias' },
    { key: 'todos', label: 'Todos' },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estatísticas e exportação de vistorias por período
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportarCSV(vistorias, periodo)}
          disabled={vistorias.length === 0}
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center mb-6">
        <div className="flex gap-1">
          {periodos.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                periodo === p.key
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {isMaster && (
          <input
            value={municipioFiltro}
            onChange={(e) => setMunicipioFiltro(e.target.value)}
            placeholder="Filtrar município..."
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring w-44"
          />
        )}
      </div>

      {/* Estados de loading/erro */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando dados...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p>Falha ao carregar relatórios.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : vistorias.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma vistoria encontrada para o período selecionado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <CardResumo label="Total de vistorias" valor={vistorias.length} cor="text-slate-900" />
            <CardResumo label="Alto risco (R3 + R4)" valor={alto} cor="text-red-600" />
            <CardResumo label="Médio risco (R2)" valor={medio} cor="text-amber-600" />
            <CardResumo label="Baixo risco (R1)" valor={baixo} cor="text-emerald-600" />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Barras */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-slate-900 mb-4 text-sm">Vistorias por nível de risco</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dadosBarras} barSize={40}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip content={<TooltipCustom />} />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {dadosBarras.map((entry) => (
                      <Cell key={entry.name} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pizza */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-slate-900 mb-4 text-sm">Distribuição proporcional</h2>
              {dadosPizza.length === 0 ? (
                <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                  Sem dados
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={dadosPizza}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {dadosPizza.map((entry) => (
                        <Cell key={entry.name} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Legend
                      formatter={(value) => RISCO_LABEL[value.toLowerCase()] ?? value}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Tooltip formatter={(v) => [`${v} vistoria${v !== 1 ? 's' : ''}`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Ranking de agentes */}
          {rankingAgentes.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-slate-900 mb-4 text-sm">Ranking de agentes</h2>
              <div className="space-y-2">
                {rankingAgentes.map((a, i) => {
                  const pct = Math.round((a.total / vistorias.length) * 100);
                  return (
                    <div key={a.nome} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-slate-800 truncate">{a.nome}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {a.total} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
