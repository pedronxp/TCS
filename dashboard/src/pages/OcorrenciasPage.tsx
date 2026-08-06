import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  Search,
  User,
  Calendar,
  FileText,
  X,
  Loader2,
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
import { PageHeader } from '@/components/domain/PageHeader';
import { RiskBadge } from '@/components/domain/Badges';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Mapeia o nível de risco (lowercase, vindo do banco) para o formato do
// componente compartilhado RiskBadge ('R1'..'R4').
const RISCO_LABEL: Record<NivelRisco, 'R1' | 'R2' | 'R3' | 'R4'> = {
  r1: 'R1',
  r2: 'R2',
  r3: 'R3',
  r4: 'R4',
};

// Fundo suave por nível — usa os tokens de risco semânticos para o painel de
// destaque (a única exceção monocromática: cores de risco são críticas).
const RISCO_SOFT_BG: Record<NivelRisco, string> = {
  r1: 'bg-success-soft',
  r2: 'bg-warning-soft',
  r3: 'bg-warning-soft',
  r4: 'bg-destructive-soft',
};

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

  const urls = useMemo(
    () => vistoria.fotosUrls ?? (vistoria.fotoUrl ? [vistoria.fotoUrl] : []),
    [vistoria.fotoUrl, vistoria.fotosUrls],
  );

  useEffect(() => {
    if (!urls.length) return;
    setLoadingFotos(true);
    Promise.all(urls.map((u) => getSignedUrl(u, 3600)))
      .then((resolved) => setSignedUrls(resolved.filter(Boolean) as string[]))
      .finally(() => setLoadingFotos(false));
  }, [urls]);

  const risco = vistoria.nivelRisco ? RISCO_LABEL[vistoria.nivelRisco] : null;

  return (
    <>
      {/* Overlay */}
      <button
        type="button"
        aria-label="Fechar detalhes"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
      />

      {/* Painel lateral — superfície glass conforme design system */}
      <aside
        className="glass fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-md flex-col overflow-hidden"
        aria-label="Detalhes da vistoria"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-sidebar-border p-5">
          <div>
            <p className="mb-0.5 text-xs text-muted-foreground">Vistoria</p>
            <h2 className="text-sm font-bold text-foreground">
              {vistoria.protocolo ?? vistoria.id.slice(0, 8).toUpperCase()}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="mt-0.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Nível de risco */}
          {risco && (
            <div
              className={cn(
                'flex items-center gap-4 rounded-lg p-4',
                vistoria.nivelRisco ? RISCO_SOFT_BG[vistoria.nivelRisco] : 'bg-secondary'
              )}
            >
              <RiskBadge risk={risco} />
              <div>
                {vistoria.pontuacaoTotal != null && (
                  <p className="text-xs font-medium text-foreground">
                    Pontuação: {vistoria.pontuacaoTotal}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Detalhes */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Endereço</p>
                <p className="text-sm font-medium text-foreground">{enderecoCompleto(vistoria)}</p>
                {vistoria.municipio && <p className="text-xs text-muted-foreground">{vistoria.municipio}</p>}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">Agente</p>
                <p className="text-sm font-medium text-foreground">{vistoria.agenteNome ?? '—'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">Data da vistoria</p>
                <p className="text-sm font-medium text-foreground">
                  {vistoria.dataVistoria ? new Date(vistoria.dataVistoria).toLocaleString('pt-BR') : '—'}
                </p>
              </div>
            </div>

            {vistoria.laudo_gerado_em && (
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground">Laudo gerado em</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(vistoria.laudo_gerado_em).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Fotos */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fotos ({urls.length})
            </p>
            {urls.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                <span>Nenhuma foto registrada</span>
              </div>
            ) : loadingFotos ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Carregando fotos...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {signedUrls.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFotoAberta(url)}
                    aria-label={`Ampliar foto ${i + 1}`}
                    className="aspect-square overflow-hidden rounded-lg bg-secondary transition-opacity hover:opacity-90"
                  >
                    <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Lightbox */}
      {fotoAberta && (
        <button
          type="button"
          aria-label="Fechar foto"
          onClick={() => setFotoAberta(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
        >
          <img src={fotoAberta} alt="Foto ampliada" className="max-h-full max-w-full rounded-lg object-contain" />
          <span className="absolute right-4 top-4 rounded-md p-1 text-white/80 transition-colors hover:text-white">
            <X className="h-7 w-7" />
          </span>
        </button>
      )}
    </>
  );
}

// ─── Chip de filtro (toggle monocromático) ────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-8 rounded-full border px-3 text-[11px] font-semibold transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-secondary'
      )}
    >
      {children}
    </button>
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
    busca,
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
    <div className="page-stack">
      <PageHeader
        eyebrow="Operacional"
        title="Ocorrências"
        description="Vistorias registradas no sistema, com detalhes de risco e fotos anexadas."
      />

      {/* Filtros */}
      <Card>
        <CardContent className="space-y-3 p-3">
          {/* Busca */}
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por endereço, agente ou protocolo..."
              className="border-0 bg-secondary pl-10 shadow-none"
              aria-label="Buscar ocorrências"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Linha de filtros */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Período */}
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Período
            </span>
            <div className="flex flex-wrap gap-1">
              {periodos.map((p) => (
                <FilterChip
                  key={p.key}
                  active={periodo === p.key}
                  onClick={() => setPeriodo(p.key)}
                >
                  {p.label}
                </FilterChip>
              ))}
            </div>

            <div className="mx-1 h-5 w-px bg-border" />

            {/* Risco (Radix Select) */}
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Risco
            </span>
            <Select value={risco} onValueChange={(v) => setRisco(v as FiltroRisco)}>
              <SelectTrigger className="h-8 w-auto min-w-[9rem] rounded-full text-[11px] font-semibold" aria-label="Filtrar por risco">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {riscos.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Município (master_admin) */}
            {isMaster && (
              <Select
                value={municipioFiltro || 'all'}
                onValueChange={(v) => setMunicipioFiltro(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-auto min-w-[12rem] rounded-full text-[11px] font-semibold" aria-label="Filtrar por município">
                  <SelectValue placeholder="Todos os municípios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os municípios</SelectItem>
                  {municipios.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <AsyncBoundary
        loading={isLoading}
        error={isError ? new Error('Falha ao carregar ocorrências.') : undefined}
        onRetry={() => void refetch()}
        empty={Boolean(!isLoading && !isError && vistorias.length === 0)}
        emptyTitle="Nenhuma vistoria encontrada"
        emptyDescription="Ajuste os filtros para visualizar ocorrências registradas."
        loadingLabel="Carregando ocorrências..."
      >
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {vistorias.length} vistoria{vistorias.length !== 1 ? 's' : ''}
          </p>

          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Endereço</TableHead>
                  {isMaster && <TableHead>Município</TableHead>}
                  <TableHead>Risco</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead className="w-8">
                    <span className="sr-only">Abrir detalhes</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vistorias.map((v) => (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer"
                    onClick={() => setSelecionada(v)}
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {v.dataVistoria ? new Date(v.dataVistoria).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell className="max-w-0 truncate pr-2 font-medium text-foreground">
                      {enderecoCompleto(v)}
                    </TableCell>
                    {isMaster && (
                      <TableCell className="truncate pr-2 text-xs text-muted-foreground">
                        {v.municipio ?? '—'}
                      </TableCell>
                    )}
                    <TableCell>
                      <RiskBadge risk={v.nivelRisco ? RISCO_LABEL[v.nivelRisco] : null} />
                    </TableCell>
                    <TableCell className="truncate pr-2 text-xs text-muted-foreground">
                      {v.agenteNome ?? '—'}
                    </TableCell>
                    <TableCell className="w-8">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </AsyncBoundary>

      {/* Painel de detalhe */}
      {selecionada && <PainelDetalhe vistoria={selecionada} onClose={() => setSelecionada(null)} />}
    </div>
  );
}
