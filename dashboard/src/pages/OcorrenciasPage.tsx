import { useState, useEffect } from 'react';
import {
  Search,
  X,
  RotateCcw,
  AlertCircle,
  Loader2,
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  User,
  Calendar,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useOcorrencias,
  getSignedUrl,
  type Vistoria,
  type FiltroPeriodo,
  type FiltroRisco,
  type NivelRisco,
} from '@/hooks/useOcorrencias';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RISCO_CONFIG: Record<NivelRisco, { label: string; bg: string; text: string; dot: string }> = {
  r1: { label: 'R1 — Baixo', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  r2: { label: 'R2 — Médio', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  r3: { label: 'R3 — Alto', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  r4: { label: 'R4 — Crítico', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

function RiscoBadge({ nivel }: { nivel: NivelRisco | null }) {
  if (!nivel) return <span className="text-xs text-muted-foreground">—</span>;
  const c = RISCO_CONFIG[nivel];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', c.bg, c.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}

function enderecoCompleto(v: Vistoria): string {
  if (v.endereco) return v.endereco;
  const parts = [v.enderecoRua, v.enderecoNumero, v.enderecoBairro].filter(Boolean);
  return parts.join(', ') || '—';
}

function useMunicipios() {
  const [municipios, setMunicipios] = useState<string[]>([]);
  useEffect(() => {
    supabase
      .from('municipios')
      .select('nome')
      .order('nome')
      .then(({ data }) => setMunicipios((data ?? []).map((m: { nome: string }) => m.nome)));
  }, []);
  return municipios;
}

// ─── Painel de Detalhe ────────────────────────────────────────────────────────

function PainelDetalhe({ vistoria, onClose }: { vistoria: Vistoria; onClose: () => void }) {
  const [signedUrls, setSignedUrls] = useState<string[]>([]);
  const [loadingFotos, setLoadingFotos] = useState(false);
  const [fotoAberta, setFotoAberta] = useState<string | null>(null);

  const urls = vistoria.fotosUrls ?? (vistoria.fotoUrl ? [vistoria.fotoUrl] : []);

  useEffect(() => {
    if (!urls.length) return;
    setLoadingFotos(true);
    Promise.all(urls.map((u) => getSignedUrl(u, 3600)))
      .then((resolved) => setSignedUrls(resolved.filter(Boolean) as string[]))
      .finally(() => setLoadingFotos(false));
  }, [vistoria.id]);

  const rc = vistoria.nivelRisco ? RISCO_CONFIG[vistoria.nivelRisco] : null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Painel lateral */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Vistoria</p>
            <h2 className="font-bold text-slate-900 text-sm">
              {vistoria.protocolo ?? vistoria.id.slice(0, 8).toUpperCase()}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Nível de risco */}
          {rc && (
            <div className={cn('rounded-xl p-4 flex items-center gap-4', rc.bg)}>
              <span className={cn('w-3 h-3 rounded-full shrink-0', rc.dot)} />
              <div>
                <p className={cn('font-bold', rc.text)}>{rc.label}</p>
                {vistoria.pontuacaoTotal != null && (
                  <p className={cn('text-xs', rc.text)}>
                    Pontuação: {vistoria.pontuacaoTotal}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Detalhes */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Endereço</p>
                <p className="text-sm font-medium text-slate-900">{enderecoCompleto(vistoria)}</p>
                {vistoria.municipio && (
                  <p className="text-xs text-muted-foreground">{vistoria.municipio}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Agente</p>
                <p className="text-sm font-medium text-slate-900">{vistoria.agenteNome ?? '—'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Data da vistoria</p>
                <p className="text-sm font-medium text-slate-900">
                  {vistoria.dataVistoria
                    ? new Date(vistoria.dataVistoria).toLocaleString('pt-BR')
                    : '—'}
                </p>
              </div>
            </div>

            {vistoria.laudo_gerado_em && (
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Laudo gerado em</p>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(vistoria.laudo_gerado_em).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Fotos */}
          <div>
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
              Fotos ({urls.length})
            </p>
            {urls.length === 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <ImageIcon className="w-4 h-4" />
                <span>Nenhuma foto registrada</span>
              </div>
            ) : loadingFotos ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Carregando fotos...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {signedUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setFotoAberta(url)}
                    className="aspect-square rounded-xl overflow-hidden bg-slate-100 hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={url}
                      alt={`Foto ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {fotoAberta && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFotoAberta(null)}
        >
          <img
            src={fotoAberta}
            alt="Foto ampliada"
            className="max-w-full max-h-full rounded-lg object-contain"
          />
          <button
            onClick={() => setFotoAberta(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X className="w-7 h-7" />
          </button>
        </div>
      )}
    </>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export function OcorrenciasPage() {
  const { profile } = useAuth();
  const isMaster = profile?.role === 'master_admin';
  const municipios = useMunicipios();

  const [periodo, setPeriodo] = useState<FiltroPeriodo>('30d');
  const [risco, setRisco] = useState<FiltroRisco>('todos');
  const [municipioFiltro, setMunicipioFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<Vistoria | null>(null);

  const { data = [], isLoading, isError, refetch } = useOcorrencias(
    periodo,
    risco,
    municipioFiltro,
    busca
  );

  const vistorias = data;

  const periodos: { key: FiltroPeriodo; label: string }[] = [
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: '90d', label: '90 dias' },
    { key: 'todos', label: 'Todos' },
  ];

  const riscos: { key: FiltroRisco; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'r4', label: 'R4 — Crítico' },
    { key: 'r3', label: 'R3 — Alto' },
    { key: 'r2', label: 'R2 — Médio' },
    { key: 'r1', label: 'R1 — Baixo' },
  ];

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ocorrências</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vistorias registradas no sistema
        </p>
      </div>

      {/* Filtros */}
      <div className="space-y-3 mb-6">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por endereço, agente ou protocolo..."
            className="pl-9"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Linha de filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Período */}
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

          <div className="w-px h-5 bg-slate-200" />

          {/* Risco */}
          <select
            value={risco}
            onChange={(e) => setRisco(e.target.value as FiltroRisco)}
            className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {riscos.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>

          {/* Município (master_admin) */}
          {isMaster && (
            <select
              value={municipioFiltro}
              onChange={(e) => setMunicipioFiltro(e.target.value)}
              className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos os municípios</option>
              {municipios.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando ocorrências...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p>Falha ao carregar ocorrências.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="w-4 h-4" /> Tentar novamente
          </Button>
        </div>
      ) : vistorias.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma vistoria encontrada para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-xs text-muted-foreground">
              {vistorias.length} vistoria{vistorias.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Header da tabela */}
          <div
            className={cn(
              'grid text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-slate-50 px-4 py-2.5 border-b border-slate-100',
              isMaster
                ? 'grid-cols-[1fr_1.5fr_1fr_1fr_1fr_auto]'
                : 'grid-cols-[1fr_2fr_1fr_1fr_auto]'
            )}
          >
            <span>Data</span>
            <span>Endereço</span>
            {isMaster && <span>Município</span>}
            <span>Risco</span>
            <span>Agente</span>
            <span />
          </div>

          {/* Linhas */}
          <div className="divide-y divide-slate-100">
            {vistorias.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelecionada(v)}
                className={cn(
                  'w-full grid text-sm px-4 py-3 hover:bg-slate-50 transition-colors text-left items-center',
                  isMaster
                    ? 'grid-cols-[1fr_1.5fr_1fr_1fr_1fr_auto]'
                    : 'grid-cols-[1fr_2fr_1fr_1fr_auto]'
                )}
              >
                <span className="text-slate-500 text-xs">
                  {v.dataVistoria
                    ? new Date(v.dataVistoria).toLocaleDateString('pt-BR')
                    : '—'}
                </span>
                <span className="text-slate-900 font-medium truncate pr-2">
                  {enderecoCompleto(v)}
                </span>
                {isMaster && (
                  <span className="text-slate-600 text-xs truncate pr-2">
                    {v.municipio ?? '—'}
                  </span>
                )}
                <span>
                  <RiscoBadge nivel={v.nivelRisco} />
                </span>
                <span className="text-slate-600 text-xs truncate pr-2">
                  {v.agenteNome ?? '—'}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Painel de detalhe */}
      {selecionada && (
        <PainelDetalhe vistoria={selecionada} onClose={() => setSelecionada(null)} />
      )}
    </div>
  );
}
