import { useState, useEffect } from 'react';
import {
  Search,
  X,
  RotateCcw,
  AlertCircle,
  Loader2,
  Calendar,
  MapPin,
  User,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAgendamentos,
  useAtualizarStatus,
  type FiltroStatus,
  type FiltroPeriodo,
  type Agendamento,
  type StatusAgendamento,
} from '@/hooks/useAgendamentos';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<StatusAgendamento, { label: string; bg: string; text: string; icon: typeof Clock }> = {
  pendente:  { label: 'Pendente',  bg: 'bg-blue-50',    text: 'text-blue-700',    icon: Clock },
  concluido: { label: 'Concluído', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', bg: 'bg-red-50',     text: 'text-red-700',     icon: XCircle },
};

function StatusBadge({ status }: { status: StatusAgendamento }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendente;
  const Icon = c.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', c.bg, c.text)}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
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

// ─── Card de Agendamento ──────────────────────────────────────────────────────

function CardAgendamento({ a }: { a: Agendamento }) {
  const [expandido, setExpandido] = useState(false);
  const { profile } = useAuth();
  const atualizar = useAtualizarStatus();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'master_admin';

  const dataAgendada = a.data_agendada ? new Date(a.data_agendada) : null;
  const passado = dataAgendada ? dataAgendada < new Date() : false;

  return (
    <div className={cn(
      'bg-white border rounded-xl overflow-hidden',
      passado && a.status === 'pendente' ? 'border-amber-200' : 'border-slate-200'
    )}>
      {/* Linha principal */}
      <div className="flex items-center gap-4 p-4">
        {/* Data */}
        <div className={cn(
          'w-14 shrink-0 rounded-xl p-2 text-center',
          passado && a.status === 'pendente' ? 'bg-amber-50' : 'bg-slate-50'
        )}>
          {dataAgendada ? (
            <>
              <p className={cn('text-xs font-semibold', passado && a.status === 'pendente' ? 'text-amber-600' : 'text-muted-foreground')}>
                {dataAgendada.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
              </p>
              <p className={cn('text-xl font-bold leading-tight', passado && a.status === 'pendente' ? 'text-amber-700' : 'text-slate-900')}>
                {dataAgendada.getDate()}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-slate-900 text-sm truncate">
              {a.titulo ?? 'Sem título'}
            </span>
            <StatusBadge status={a.status} />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {a.endereco && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {a.endereco}
              </span>
            )}
            {a.agente_nome && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {a.agente_nome}
              </span>
            )}
            {dataAgendada && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dataAgendada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpandido(!expandido)}
          className="text-slate-400 hover:text-slate-600 shrink-0"
        >
          {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expandido */}
      {expandido && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-3">
          {a.observacoes && (
            <p className="text-sm text-slate-700">
              <span className="font-medium">Observações: </span>{a.observacoes}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Criado por <strong>{a.criado_por_nome ?? '—'}</strong></span>
            {a.municipio && <span>· {a.municipio}</span>}
            {a.criado_em && (
              <span>· {new Date(a.criado_em).toLocaleDateString('pt-BR')}</span>
            )}
          </div>

          {/* Ações de status (admin/master_admin) */}
          {isAdmin && a.status === 'pendente' && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                disabled={atualizar.isPending}
                onClick={() => atualizar.mutate({ id: a.id, status: 'concluido' })}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Marcar concluído
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                disabled={atualizar.isPending}
                onClick={() => atualizar.mutate({ id: a.id, status: 'cancelado' })}
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export function AgendamentosPage() {
  const { profile } = useAuth();
  const isMaster = profile?.role === 'master_admin';
  const municipios = useMunicipios();

  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('proximos');
  const [municipioFiltro, setMunicipioFiltro] = useState('');
  const [busca, setBusca] = useState('');

  const { data: agendamentos = [], isLoading, isError, refetch } = useAgendamentos(
    filtroStatus,
    filtroPeriodo,
    municipioFiltro,
    busca
  );

  const statusOpts: { key: FiltroStatus; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'pendente', label: 'Pendentes' },
    { key: 'concluido', label: 'Concluídos' },
    { key: 'cancelado', label: 'Cancelados' },
  ];

  const periodoOpts: { key: FiltroPeriodo; label: string }[] = [
    { key: 'proximos', label: 'Próximos' },
    { key: 'passados', label: 'Passados' },
    { key: 'todos', label: 'Todos' },
  ];

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Agendamentos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vistorias agendadas no sistema
        </p>
      </div>

      {/* Filtros */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, endereço ou agente..."
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

        <div className="flex flex-wrap gap-2 items-center">
          {/* Período */}
          <div className="flex gap-1">
            {periodoOpts.map((p) => (
              <button
                key={p.key}
                onClick={() => setFiltroPeriodo(p.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  filtroPeriodo === p.key
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-200" />

          {/* Status */}
          <div className="flex gap-1">
            {statusOpts.map((s) => (
              <button
                key={s.key}
                onClick={() => setFiltroStatus(s.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  filtroStatus === s.key
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Município (master_admin) */}
          {isMaster && (
            <select
              value={municipioFiltro}
              onChange={(e) => setMunicipioFiltro(e.target.value)}
              className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos os municípios</option>
              {municipios.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando agendamentos...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p>Falha ao carregar agendamentos.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="w-4 h-4" /> Tentar novamente
          </Button>
        </div>
      ) : agendamentos.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum agendamento encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            {agendamentos.length} agendamento{agendamentos.length !== 1 ? 's' : ''}
          </p>
          {agendamentos.map((a) => (
            <CardAgendamento key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
