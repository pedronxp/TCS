import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Hammer, Loader2, CheckCircle2, XCircle, Clock,
  ExternalLink, Copy, ChevronDown, ChevronUp, AlertCircle, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type BuildStatus = 'queued' | 'building' | 'success' | 'failed' | 'cancelled';
type BuildProvider = 'eas' | 'github_actions';

type Build = {
  id: string;
  provider: BuildProvider;
  version: string;
  profile: string;
  changelog: string | null;
  status: BuildStatus;
  eas_build_id: string | null;
  github_run_id: string | null;
  apk_url: string | null;
  drive_folder_url: string | null;
  initiated_by_name: string | null;
  created_at: string;
  completed_at: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<BuildStatus, { label: string; bg: string; text: string; Icon: React.FC<{ className?: string }> }> = {
  queued:    { label: 'Na fila',    bg: 'bg-slate-100',  text: 'text-slate-600',  Icon: Clock },
  building:  { label: 'Buildando', bg: 'bg-blue-50',    text: 'text-blue-700',   Icon: Loader2 },
  success:   { label: 'Pronto',    bg: 'bg-emerald-50', text: 'text-emerald-700',Icon: CheckCircle2 },
  failed:    { label: 'Falhou',    bg: 'bg-red-50',     text: 'text-red-700',    Icon: XCircle },
  cancelled: { label: 'Cancelado', bg: 'bg-slate-100',  text: 'text-slate-500',  Icon: XCircle },
};

function StatusBadge({ status }: { status: BuildStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.queued;
  const { Icon, label, bg, text } = cfg;
  return (
    <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', bg, text)}>
      <Icon className={cn('w-3 h-3', status === 'building' && 'animate-spin')} />
      {label}
    </span>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useBuilds() {
  return useQuery({
    queryKey: ['builds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('builds')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Build[];
    },
    refetchInterval: 30_000,
  });
}

function useTriggerBuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      provider: BuildProvider;
      version: string;
      profile: string;
      changelog: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('trigger-build', {
        body: payload,
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['builds'] }),
  });
}

// ─── Card de build ────────────────────────────────────────────────────────────

function BuildCard({ b }: { b: Build }) {
  const [expandido, setExpandido] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    if (!b.apk_url) return;
    navigator.clipboard.writeText(b.apk_url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const easUrl = b.eas_build_id
    ? `https://expo.dev/accounts/pedronxp/projects/app-defesa-civil/builds/${b.eas_build_id}`
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-semibold text-slate-900 text-sm">
              TCS v{b.version}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {b.profile}
            </span>
            <StatusBadge status={b.status} />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{b.provider === 'eas' ? 'EAS Build' : 'GitHub Actions'}</span>
            {b.initiated_by_name && <span>por {b.initiated_by_name}</span>}
            <span>{new Date(b.created_at).toLocaleString('pt-BR')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {b.apk_url && (
            <>
              <a href={b.apk_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                <ExternalLink className="w-3 h-3" />
                Baixar
              </a>
              <button onClick={copiar}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-slate-700">
                <Copy className="w-3 h-3" />
                {copiado ? 'Copiado!' : 'Link'}
              </button>
            </>
          )}
          {easUrl && (
            <a href={easUrl} target="_blank" rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-slate-700">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button onClick={() => setExpandido(!expandido)} className="text-slate-400 hover:text-slate-600">
            {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expandido && b.changelog && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-700 mb-1">Changelog</p>
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{b.changelog}</p>
        </div>
      )}
    </div>
  );
}

// ─── Formulário de novo build ─────────────────────────────────────────────────

function FormNovoBuild({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState<BuildProvider>('eas');
  const [version, setVersion] = useState('1.4.0');
  const [profile, setProfile] = useState('preview');
  const [changelog, setChangelog] = useState('');
  const [iniciado, setIniciado] = useState<string | null>(null);
  const trigger = useTriggerBuild();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await trigger.mutateAsync({ provider, version, profile, changelog });
    setIniciado(new Date().toLocaleString('pt-BR'));
  }

  if (iniciado) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-blue-800 text-sm">Build enviado para a fila!</p>
            <p className="text-sm text-blue-700 mt-1">
              Iniciado em: <span className="font-medium">{iniciado}</span>
            </p>
            <div className="mt-3 flex items-start gap-2 bg-blue-100 rounded-lg px-3 py-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                Você pode <strong>fechar esta aba</strong> ou navegar para outras seções.
                O link do APK ficará disponível nesta página assim que o build finalizar
                — status atualiza automaticamente a cada 30s.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-xs text-blue-600 hover:underline mt-3 font-medium"
            >
              Fechar aviso
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-4">
      <h2 className="font-semibold text-slate-900 text-sm">Novo build</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Provedor</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as BuildProvider)}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-white"
          >
            <option value="eas">EAS Build (primário)</option>
            <option value="github_actions">GitHub Actions (fallback)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Profile</label>
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-white"
          >
            <option value="preview">preview</option>
            <option value="production">production</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Versão</label>
        <Input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="ex: 1.4.0"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Changelog</label>
        <textarea
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder="O que mudou nesta versão..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={trigger.isPending}>
          {trigger.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <Hammer className="w-4 h-4" />
          Iniciar build
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>

      {trigger.isError && (
        <p className="text-xs text-red-600">
          Falha ao disparar build. Verifique se a Edge Function está publicada e as variáveis de ambiente configuradas (EAS_TOKEN, EAS_PROJECT_ID).
        </p>
      )}
    </form>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function BuildsPage() {
  const { profile: userProfile } = useAuth();
  const [formAberto, setFormAberto] = useState(false);
  const { data: builds = [], isLoading, isError, refetch } = useBuilds();

  const emAndamento = builds.filter((b) => b.status === 'building' || b.status === 'queued').length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Builds APK</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Geração remota via EAS Build / GitHub Actions
          </p>
        </div>
        {userProfile?.role === 'master_admin' && (
          <Button size="sm" onClick={() => setFormAberto(!formAberto)}>
            <Hammer className="w-4 h-4" />
            Novo build
          </Button>
        )}
      </div>

      {formAberto && <FormNovoBuild onClose={() => setFormAberto(false)} />}

      {emAndamento > 0 && (
        <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{emAndamento} build{emAndamento > 1 ? 's' : ''} em andamento — status atualiza a cada 30s.</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando builds...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p>Falha ao carregar builds.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      ) : builds.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Hammer className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum build iniciado ainda.</p>
          <p className="text-xs mt-1">Clique em "Novo build" para gerar o primeiro APK.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {builds.map((b) => <BuildCard key={b.id} b={b} />)}
        </div>
      )}
    </div>
  );
}
