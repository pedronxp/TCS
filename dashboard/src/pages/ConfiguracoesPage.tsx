import { ExternalLink, Database, Cpu, Archive, Hammer, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const INTEGRACOES = [
  {
    label: 'EAS Build',
    descricao: 'Geração remota de APK via Expo Application Services.',
    variaveis: ['EAS_TOKEN', 'EAS_PROJECT_ID'],
    link: 'https://expo.dev',
    linkLabel: 'expo.dev',
  },
  {
    label: 'GitHub Actions',
    descricao: 'Fallback de build via workflow do repositório.',
    variaveis: ['GH_ACTIONS_TOKEN', 'GITHUB_REPO'],
    link: 'https://github.com/settings/tokens',
    linkLabel: 'github.com/settings/tokens',
  },
  {
    label: 'Google Drive',
    descricao: 'Arquivamento de fotos e laudos após 7 dias.',
    variaveis: ['GOOGLE_SERVICE_ACCOUNT_KEY', 'DRIVE_FOLDER_ROOT_ID'],
    link: 'https://console.cloud.google.com',
    linkLabel: 'console.cloud.google.com',
  },
];

function CartaoIntegracao({
  label,
  descricao,
  variaveis,
  link,
  linkLabel,
}: (typeof INTEGRACOES)[0]) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">{label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>
        </div>
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <ExternalLink className="w-3 h-3" />
          {linkLabel}
        </a>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-600 mb-1.5">Variáveis de ambiente (Edge Functions):</p>
        {variaveis.map((v) => (
          <div key={v} className="flex items-center gap-2">
            <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConfiguracoesPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informações do sistema e integrações externas
        </p>
      </div>

      {/* Info do sistema */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900 text-sm">Sistema</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Aplicativo</p>
            <p className="font-medium text-slate-800">TCS — Relatório de Risco</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Versão do dashboard</p>
            <p className="font-medium text-slate-800">1.0.0</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Supabase Project</p>
            <a
              href={SUPABASE_URL?.replace('.supabase.co', '') + '.supabase.co'}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-primary hover:underline"
            >
              {SUPABASE_URL}
            </a>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ambiente</p>
            <p className="font-medium text-slate-800">Produção</p>
          </div>
        </div>
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => navigate('/arquivamento')}
          className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-50 grid place-items-center shrink-0">
            <Archive className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900 text-sm">Arquivamento</p>
            <p className="text-xs text-muted-foreground">Config. lifecycle Supabase → Drive</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/builds')}
          className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 grid place-items-center shrink-0">
            <Hammer className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900 text-sm">Builds APK</p>
            <p className="text-xs text-muted-foreground">Gerar APK remoto via EAS / GitHub</p>
          </div>
        </button>
      </div>

      {/* Integrações */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900 text-sm">Integrações externas</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Configure as variáveis abaixo no painel do Supabase em{' '}
          <a
            href="https://supabase.com/dashboard/project/vobcapzssxchdckazfnr/functions"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Project → Edge Functions → Secrets
          </a>
          .
        </p>
        <div className="space-y-3">
          {INTEGRACOES.map((i) => (
            <CartaoIntegracao key={i.label} {...i} />
          ))}
        </div>
      </div>

      {/* Supabase DB */}
      <div className="mt-4 bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900 text-sm">Banco de dados</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Acesse o editor SQL e as tabelas diretamente no Supabase Studio.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            window.open(
              'https://supabase.com/dashboard/project/vobcapzssxchdckazfnr/editor',
              '_blank',
            )
          }
        >
          <ExternalLink className="w-4 h-4" />
          Abrir Supabase Studio
        </Button>
      </div>
    </div>
  );
}
