import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, X, RotateCcw, AlertCircle, Loader2,
  FileText, Download, CheckCircle2, Circle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type VistoriaLaudo = {
  id: string;
  protocolo: string | null;
  endereco: string | null;
  enderecoRua: string | null;
  municipio: string | null;
  nivelRisco: string | null;
  agenteNome: string | null;
  dataVistoria: string | null;
  laudo_gerado_em: string | null;
  relatorio_gerado_em: string | null;
  termo_gerado_em: string | null;
};

type FiltroPeriodo = '7d' | '30d' | '90d' | 'todos';

const RISCO_CONFIG: Record<string, { bg: string; text: string }> = {
  r1: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  r2: { bg: 'bg-yellow-50',  text: 'text-yellow-700'  },
  r3: { bg: 'bg-orange-50',  text: 'text-orange-700'  },
  r4: { bg: 'bg-red-50',     text: 'text-red-700'     },
};
const RISCO_LABEL: Record<string, string> = {
  r1: 'R1', r2: 'R2', r3: 'R3', r4: 'R4',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useLaudos(periodo: FiltroPeriodo, municipioFiltro: string) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['laudos', periodo, municipioFiltro, profile?.role, profile?.municipio],
    queryFn: async () => {
      let q = supabase
        .from('vistorias')
        .select('id, protocolo, endereco, enderecoRua, municipio, "nivelRisco", "agenteNome", "dataVistoria", laudo_gerado_em, relatorio_gerado_em, termo_gerado_em')
        .not('laudo_gerado_em', 'is', null)
        .order('laudo_gerado_em', { ascending: false });

      if (profile?.role !== 'master_admin') {
        q = q.eq('municipio', profile?.municipio);
      } else if (municipioFiltro) {
        q = q.eq('municipio', municipioFiltro);
      }

      if (periodo !== 'todos') {
        const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
        const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
        q = q.gte('laudo_gerado_em', desde);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as VistoriaLaudo[];
    },
    enabled: !!profile,
  });
}

// ─── Ação: abrir PDF ──────────────────────────────────────────────────────────

async function abrirLaudo(v: VistoriaLaudo): Promise<string | null> {
  if (!v.municipio) return null;
  const path = `${v.municipio}/${v.id}.pdf`;
  const { data, error } = await supabase.storage
    .from('laudos')
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 dias
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

// ─── Linha da tabela ──────────────────────────────────────────────────────────

function LinhaLaudo({ v, isMaster }: { v: VistoriaLaudo; isMaster: boolean }) {
  const [expandido, setExpandido] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState('');

  const endereco = v.endereco ?? v.enderecoRua ?? '—';
  const rc = v.nivelRisco ? RISCO_CONFIG[v.nivelRisco] : null;

  async function handleAbrir() {
    setAbrindo(true);
    setErro('');
    const url = await abrirLaudo(v);
    setAbrindo(false);
    if (!url) { setErro('Arquivo não encontrado no storage.'); return; }
    window.open(url, '_blank');
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Linha principal */}
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-semibold text-slate-900 text-sm truncate">
              {endereco}
            </span>
            {rc && (
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', rc.bg, rc.text)}>
                {RISCO_LABEL[v.nivelRisco!]}
              </span>
            )}
            {isMaster && v.municipio && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {v.municipio}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {v.protocolo && <span className="font-mono">{v.protocolo}</span>}
            {v.agenteNome && <span>{v.agenteNome}</span>}
            {v.laudo_gerado_em && (
              <span>Laudo: {new Date(v.laudo_gerado_em).toLocaleDateString('pt-BR')}</span>
            )}
          </div>
        </div>

        {/* Indicadores de documentos */}
        <div className="flex items-center gap-2 shrink-0">
          <DocBadge label="Laudo" gerado={!!v.laudo_gerado_em} />
          <DocBadge label="Relatório" gerado={!!v.relatorio_gerado_em} />
          <DocBadge label="Termo" gerado={!!v.termo_gerado_em} />
        </div>

        <button onClick={() => setExpandido(!expandido)} className="text-slate-400 hover:text-slate-600 shrink-0">
          {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expandido */}
      {expandido && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <DetalheDoc
              label="Laudo Técnico"
              timestamp={v.laudo_gerado_em}
              podeBaixar
              onBaixar={handleAbrir}
              baixando={abrindo}
            />
            <DetalheDoc label="Relatório de Vistoria" timestamp={v.relatorio_gerado_em} />
            <DetalheDoc label="Termo de Interdição" timestamp={v.termo_gerado_em} />
          </div>
          {erro && <p className="text-xs text-red-500">{erro}</p>}
        </div>
      )}
    </div>
  );
}

function DocBadge({ label, gerado }: { label: string; gerado: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
      gerado ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
    )}>
      {gerado
        ? <CheckCircle2 className="w-3 h-3" />
        : <Circle className="w-3 h-3" />}
      {label}
    </div>
  );
}

function DetalheDoc({
  label, timestamp, podeBaixar, onBaixar, baixando,
}: {
  label: string;
  timestamp: string | null;
  podeBaixar?: boolean;
  onBaixar?: () => void;
  baixando?: boolean;
}) {
  return (
    <div className={cn('rounded-lg p-3 border', timestamp ? 'bg-white border-slate-200' : 'bg-slate-100 border-transparent')}>
      <div className="flex items-center gap-1.5 mb-1">
        <FileText className={cn('w-3.5 h-3.5', timestamp ? 'text-primary' : 'text-slate-400')} />
        <span className={cn('font-semibold', timestamp ? 'text-slate-800' : 'text-slate-400')}>{label}</span>
      </div>
      {timestamp ? (
        <>
          <p className="text-muted-foreground mb-2">{new Date(timestamp).toLocaleString('pt-BR')}</p>
          {podeBaixar && (
            <button
              onClick={onBaixar}
              disabled={baixando}
              className="flex items-center gap-1 text-primary hover:underline font-medium disabled:opacity-50"
            >
              {baixando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Abrir PDF
            </button>
          )}
        </>
      ) : (
        <p className="text-slate-400">Não gerado</p>
      )}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function LaudosPage() {
  const { profile } = useAuth();
  const isMaster = profile?.role === 'master_admin';

  const [periodo, setPeriodo] = useState<FiltroPeriodo>('30d');
  const [municipioFiltro, setMunicipioFiltro] = useState('');
  const [busca, setBusca] = useState('');

  const { data: laudos = [], isLoading, isError, refetch } = useLaudos(periodo, municipioFiltro);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return laudos;
    const b = busca.toLowerCase();
    return laudos.filter(v =>
      (v.endereco ?? v.enderecoRua ?? '').toLowerCase().includes(b) ||
      (v.agenteNome ?? '').toLowerCase().includes(b) ||
      (v.protocolo ?? '').toLowerCase().includes(b) ||
      (v.municipio ?? '').toLowerCase().includes(b)
    );
  }, [laudos, busca]);

  const periodos: { key: FiltroPeriodo; label: string }[] = [
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: '90d', label: '90 dias' },
    { key: 'todos', label: 'Todos' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Laudos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Documentos gerados nas vistorias (laudo técnico, relatório e termo)
        </p>
      </div>

      {/* Filtros */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por endereço, agente, protocolo ou município..."
            className="pl-9"
          />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1">
            {periodos.map((p) => (
              <button key={p.key} onClick={() => setPeriodo(p.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  periodo === p.key
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}>
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
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando laudos...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p>Falha ao carregar laudos.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="w-4 h-4" /> Tentar novamente
          </Button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum laudo encontrado para o período selecionado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            {filtrados.length} vistoria{filtrados.length !== 1 ? 's' : ''} com laudo gerado
          </p>
          {filtrados.map((v) => (
            <LinhaLaudo key={v.id} v={v} isMaster={isMaster} />
          ))}
        </div>
      )}
    </div>
  );
}
