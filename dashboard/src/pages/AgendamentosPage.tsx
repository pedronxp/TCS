import { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  User,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAgendamentos,
  useAtualizarStatus,
  type Agendamento,
  type FiltroPeriodo,
  type FiltroStatus,
  type StatusAgendamento,
} from '@/hooks/useAgendamentos';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/domain/PageHeader';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

// ─── Status (sem cores hardcoded — usa badges do design system) ────────────────

const STATUS_BADGE: Record<StatusAgendamento, 'warning' | 'success' | 'destructive'> = {
  pendente: 'warning',
  concluido: 'success',
  cancelado: 'destructive',
};

const STATUS_LABEL: Record<StatusAgendamento, string> = {
  pendente: 'Pendente',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

function SmileStatusBadge({ status }: { status: StatusAgendamento }) {
  return <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

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

// ─── Card de Agendamento ────────────────────────────────────────────────────────

function CardAgendamento({ a }: { a: Agendamento }) {
  const [expandido, setExpandido] = useState(false);
  const { profile } = useAuth();
  const atualizar = useAtualizarStatus();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'master_admin';

  const dataAgendada = a.data_agendada ? new Date(a.data_agendada) : null;
  const passado = dataAgendada ? dataAgendada < new Date() : false;
  const pendenteVencido = passado && a.status === 'pendente';

  return (
    <Card
      className={cn(
        'overflow-hidden',
        pendenteVencido && 'border-warning/40'
      )}
    >
      {/* Linha principal */}
      <div className="flex items-center gap-4 p-4">
        {/* Data */}
        <div
          className={cn(
            'w-14 shrink-0 rounded-lg border border-border p-2 text-center',
            pendenteVencido ? 'bg-warning-soft' : 'bg-secondary'
          )}
        >
          {dataAgendada ? (
            <>
              <p
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-wide',
                  pendenteVencido ? 'text-warning' : 'text-muted-foreground'
                )}
              >
                {dataAgendada.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
              </p>
              <p className="text-xl font-bold leading-tight text-foreground">
                {dataAgendada.getDate()}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {a.titulo ?? 'Sem título'}
            </span>
            <SmileStatusBadge status={a.status} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {a.endereco && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {a.endereco}
              </span>
            )}
            {a.agente_nome && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {a.agente_nome}
              </span>
            )}
            {dataAgendada && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {dataAgendada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          aria-label={expandido ? 'Recolher detalhes' : 'Expandir detalhes'}
          aria-expanded={expandido}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expandido */}
      {expandido && (
        <div className="space-y-3 border-t border-border bg-secondary/50 px-4 py-3">
          {a.observacoes && (
            <p className="text-sm text-foreground">
              <span className="font-medium">Observações: </span>
              {a.observacoes}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Criado por <strong className="text-foreground">{a.criado_por_nome ?? '—'}</strong>
            </span>
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
                variant="default"
                disabled={atualizar.isPending}
                onClick={() => atualizar.mutate({ id: a.id, status: 'concluido' })}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Marcar concluído
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={atualizar.isPending}
                onClick={() => atualizar.mutate({ id: a.id, status: 'cancelado' })}
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Página Principal ───────────────────────────────────────────────────────────

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

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operacional"
        title="Agendamentos"
        description="Vistorias agendadas no sistema, com foco nos próximos compromissos."
      />

      {/* Filtros */}
      <Card className="shadow-none">
        <div className="flex flex-col gap-3 p-3">
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, endereço ou agente..."
              className="h-11 border-0 bg-secondary pl-10 shadow-none"
              aria-label="Buscar agendamentos"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Período */}
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Período
            </span>
            <div className="flex flex-wrap gap-1">
              {periodoOpts.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={filtroPeriodo === p.key}
                  onClick={() => setFiltroPeriodo(p.key)}
                  className={cn(
                    'h-8 rounded-full border px-3 text-[11px] font-semibold transition-colors',
                    filtroPeriodo === p.key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mx-1 h-5 w-px bg-border" />

            {/* Status */}
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </span>
            <div className="flex flex-wrap gap-1">
              {statusOpts.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={filtroStatus === s.key}
                  onClick={() => setFiltroStatus(s.key)}
                  className={cn(
                    'h-8 rounded-full border px-3 text-[11px] font-semibold transition-colors',
                    filtroStatus === s.key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-secondary'
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
                className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Filtrar por município"
              >
                <option value="">Todos os municípios</option>
                {municipios.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Card>

      {/* Lista */}
      <AsyncBoundary
        loading={isLoading}
        error={isError ? new Error('Falha ao carregar agendamentos.') : undefined}
        onRetry={() => void refetch()}
        empty={Boolean(!isLoading && !isError && agendamentos.length === 0)}
        emptyTitle="Nenhum agendamento encontrado"
        emptyDescription="Ajuste os filtros ou agende uma nova vistoria para vê-la aqui."
        loadingLabel="Carregando agendamentos..."
      >
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {agendamentos.length} agendamento{agendamentos.length !== 1 ? 's' : ''}
          </p>
          {agendamentos.map((a) => (
            <CardAgendamento key={a.id} a={a} />
          ))}
        </div>
      </AsyncBoundary>
    </div>
  );
}
