import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive, AlertCircle, Loader2, CheckCircle2, Clock,
  XCircle, RefreshCcw, ExternalLink, Settings2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type StorageLocation = 'supabase' | 'archiving' | 'drive_uploaded' | 'drive' | 'failed';

type VistoriaArq = {
  id: string;
  protocolo: string | null;
  municipio: string | null;
  nivelRisco: string | null;
  dataVistoria: string | null;
  storage_location: StorageLocation;
  drive_folder_url: string | null;
  archived_at: string | null;
};

type ArqConfig = {
  mode: 'auto' | 'manual';
  enabled: boolean;
  days_threshold: number;
};

// ─── Config badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<StorageLocation, { label: string; bg: string; text: string; Icon: React.FC<{ className?: string }> }> = {
  supabase:       { label: 'Pendente',    bg: 'bg-amber-50',   text: 'text-amber-700',   Icon: Clock },
  archiving:      { label: 'Arquivando',  bg: 'bg-blue-50',    text: 'text-blue-700',    Icon: Loader2 },
  drive_uploaded: { label: 'Validando',   bg: 'bg-indigo-50',  text: 'text-indigo-700',  Icon: RefreshCcw },
  drive:          { label: 'No Drive',    bg: 'bg-emerald-50', text: 'text-emerald-700', Icon: CheckCircle2 },
  failed:         { label: 'Falhou',      bg: 'bg-red-50',     text: 'text-red-700',     Icon: XCircle },
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useArquivamento() {
  return useQuery({
    queryKey: ['arquivamento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vistorias')
        .select('id, protocolo, municipio, "nivelRisco", "dataVistoria", storage_location, drive_folder_url, archived_at')
        .neq('storage_location', 'supabase')
        .order('dataVistoria', { ascending: false });
      if (error) throw error;
      return (data ?? []) as VistoriaArq[];
    },
  });
}

function usePendentes(daysThreshold: number) {
  return useQuery({
    queryKey: ['arquivamento-pendentes', daysThreshold],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - daysThreshold * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('vistorias')
        .select('id, protocolo, municipio, "nivelRisco", "dataVistoria", storage_location, drive_folder_url, archived_at')
        .eq('storage_location', 'supabase')
        .lt('dataVistoria', cutoff)
        .order('dataVistoria', { ascending: true });
      if (error) throw error;
      return (data ?? []) as VistoriaArq[];
    },
  });
}

function useArqConfig() {
  return useQuery({
    queryKey: ['arq-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('id', 'arquivamento')
        .single();
      if (error) throw error;
      return (data?.valor ?? { mode: 'manual', enabled: false, days_threshold: 7 }) as ArqConfig;
    },
  });
}

function useSalvarConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: ArqConfig) => {
      const { error } = await supabase
        .from('configuracoes')
        .update({ valor: cfg, atualizadoEm: new Date().toISOString() })
        .eq('id', 'arquivamento');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arq-config'] }),
  });
}

function useDisparar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      const { data, error } = await supabase.functions.invoke('archive-lifecycle', {
        body: ids?.length ? { vistoria_ids: ids } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arquivamento'] });
      qc.invalidateQueries({ queryKey: ['arquivamento-pendentes'] });
    },
  });
}

// ─── Componentes ──────────────────────────────────────────────────────────────

function StatusBadge({ loc }: { loc: StorageLocation }) {
  const cfg = STATUS_CFG[loc] ?? STATUS_CFG.supabase;
  const { Icon, label, bg, text } = cfg;
  return (
    <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', bg, text)}>
      <Icon className={cn('w-3 h-3', loc === 'archiving' && 'animate-spin')} />
      {label}
    </span>
  );
}

function CardVistoria({ v }: { v: VistoriaArq }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-sm font-semibold text-slate-900 truncate">
            {v.protocolo ?? v.id.slice(0, 8)}
          </span>
          {v.municipio && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {v.municipio}
            </span>
          )}
          <StatusBadge loc={v.storage_location} />
        </div>
        <p className="text-xs text-muted-foreground">
          {v.dataVistoria ? new Date(v.dataVistoria).toLocaleDateString('pt-BR') : '—'}
          {v.archived_at && ` · Arquivado em ${new Date(v.archived_at).toLocaleDateString('pt-BR')}`}
        </p>
      </div>
      {v.drive_folder_url && (
        <a
          href={v.drive_folder_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <ExternalLink className="w-3 h-3" />
          Drive
        </a>
      )}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function ArquivamentoPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [configAberto, setConfigAberto] = useState(false);

  const { data: config, isLoading: cfgLoading } = useArqConfig();
  const { data: arquivados = [], isLoading: arqLoading, refetch: refetchArq } = useArquivamento();
  const { data: pendentes = [], isLoading: pendLoading } = usePendentes(config?.days_threshold ?? 7);
  const salvar = useSalvarConfig();
  const disparar = useDisparar();

  const [cfgLocal, setCfgLocal] = useState<ArqConfig | null>(null);
  const cfg: ArqConfig = cfgLocal ?? config ?? { mode: 'manual', enabled: false, days_threshold: 7 };

  const stats = useMemo(() => ({
    pendentes: pendentes.length,
    arquivando: arquivados.filter((v) => v.storage_location === 'archiving').length,
    concluidos: arquivados.filter((v) => v.storage_location === 'drive').length,
    falhos: arquivados.filter((v) => v.storage_location === 'failed').length,
  }), [pendentes, arquivados]);

  const isLoading = cfgLoading || arqLoading || pendLoading;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDisparar() {
    const ids = selectedIds.size > 0 ? [...selectedIds] : undefined;
    await disparar.mutateAsync(ids);
    setSelectedIds(new Set());
  }

  async function handleSalvarConfig() {
    await salvar.mutateAsync(cfg);
    setCfgLocal(null);
    setConfigAberto(false);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Arquivamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lifecycle de arquivos: Supabase Storage → Google Drive após {cfg.days_threshold} dias
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfigAberto(!configAberto)}>
            <Settings2 className="w-4 h-4" />
            Configurações
          </Button>
          <Button
            size="sm"
            onClick={handleDisparar}
            disabled={disparar.isPending || pendentes.length === 0}
          >
            {disparar.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Archive className="w-4 h-4" />}
            {selectedIds.size > 0
              ? `Arquivar selecionados (${selectedIds.size})`
              : `Arquivar todos pendentes (${stats.pendentes})`}
          </Button>
        </div>
      </div>

      {/* Painel de configuração */}
      {configAberto && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-slate-900 text-sm">Configurações de arquivamento</h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-800 font-medium">Modo</p>
              <p className="text-xs text-muted-foreground">
                {cfg.mode === 'auto'
                  ? 'Automático: cron diário arquiva sozinho'
                  : 'Manual: master_admin dispara manualmente'}
              </p>
            </div>
            <button
              onClick={() => setCfgLocal({ ...cfg, mode: cfg.mode === 'auto' ? 'manual' : 'auto' })}
              className="text-primary"
            >
              {cfg.mode === 'auto'
                ? <ToggleRight className="w-8 h-8" />
                : <ToggleLeft className="w-8 h-8 text-slate-400" />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-800 font-medium">Arquivamento ativo</p>
              <p className="text-xs text-muted-foreground">
                {cfg.enabled ? 'Ligado' : 'Desligado'}
              </p>
            </div>
            <button
              onClick={() => setCfgLocal({ ...cfg, enabled: !cfg.enabled })}
              className="text-primary"
            >
              {cfg.enabled
                ? <ToggleRight className="w-8 h-8" />
                : <ToggleLeft className="w-8 h-8 text-slate-400" />}
            </button>
          </div>

          <div>
            <p className="text-sm text-slate-800 font-medium mb-1">Threshold (dias)</p>
            <input
              type="number"
              min={1}
              max={365}
              value={cfg.days_threshold}
              onChange={(e) => setCfgLocal({ ...cfg, days_threshold: Number(e.target.value) })}
              className="h-8 w-24 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSalvarConfig} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setCfgLocal(null); setConfigAberto(false); }}>
              Cancelar
            </Button>
          </div>

          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Para ativar o upload real no Google Drive, configure as variáveis de ambiente
            <code className="font-mono mx-1">GOOGLE_SERVICE_ACCOUNT_KEY</code> e
            <code className="font-mono mx-1">DRIVE_FOLDER_ROOT_ID</code> na Edge Function.
          </p>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Prontos para arquivar</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pendentes}</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Arquivando</p>
          <p className="text-2xl font-bold text-blue-600">{stats.arquivando}</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">No Drive</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.concluidos}</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Com falha</p>
          <p className="text-2xl font-bold text-red-600">{stats.falhos}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pendentes */}
          {pendentes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-900 text-sm">
                  Prontos para arquivar ({pendentes.length})
                </h2>
                {selectedIds.size > 0 && (
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground hover:text-slate-700">
                    Limpar seleção
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {pendentes.map((v) => (
                  <div key={v.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(v.id)}
                      onChange={() => toggleSelect(v.id)}
                      className="rounded border-slate-300 text-primary focus:ring-ring"
                    />
                    <div className="flex-1">
                      <CardVistoria v={v} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Arquivados / em processo */}
          {arquivados.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-900 text-sm">
                  Histórico ({arquivados.length})
                </h2>
                <button onClick={() => refetchArq()} className="text-xs text-muted-foreground hover:text-slate-700 flex items-center gap-1">
                  <RefreshCcw className="w-3 h-3" /> Atualizar
                </button>
              </div>
              <div className="space-y-2">
                {arquivados.map((v) => <CardVistoria key={v.id} v={v} />)}
              </div>
            </div>
          )}

          {pendentes.length === 0 && arquivados.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <Archive className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma vistoria elegível para arquivamento ainda.</p>
              <p className="text-xs mt-1">
                Vistorias com mais de {cfg.days_threshold} dias aparecerão aqui.
              </p>
            </div>
          )}

          {/* Aviso Drive não configurado */}
          {disparar.isError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Falha ao disparar arquivamento. Verifique se a Edge Function está publicada e as variáveis de ambiente configuradas.</span>
            </div>
          )}

          {disparar.isSuccess && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Arquivamento disparado com sucesso.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
