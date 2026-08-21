import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, LogOut, ShieldCheck, Monitor, Smartphone, Tablet, Activity, Filter, RefreshCw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { HighAssuranceDialog } from '@/components/security/HighAssuranceDialog';
import { PageHeader } from '@/components/domain/PageHeader';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useAuth } from '@/contexts/AuthContext';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface SessionOrganization {
  display_name: string;
  session_policy: string;
  session_timeout_minutes: number;
  offline_tolerance_minutes: number;
}

interface SessionRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  device_id: string;
  device_name: string | null;
  platform: string;
  status: string;
  started_at: string;
  last_heartbeat_at: string;
  ended_at?: string | null;
  end_reason?: string | null;
  organizations: SessionOrganization | null;
}

interface SessionDetail {
  session: SessionRow;
  same_device_sessions: Array<Pick<SessionRow, 'id' | 'status' | 'started_at' | 'last_heartbeat_at'>>;
}

interface SessionOverview {
  items: SessionRow[];
  total: number;
  platforms: Record<'web' | 'android' | 'ios', number>;
}

interface SessionWorkspace {
  items: SessionRow[];
  total: number;
  overview: { active_total: number; platforms: Record<'web' | 'android' | 'ios', number> };
}

export function SessionsPage() {
  const [urlParams] = useSearchParams();
  const [status, setStatus] = useState('active');
  const [platform, setPlatform] = useState('all');
  const [search, setSearch] = useState(() => urlParams.get('busca') || '');
  const deferredSearch = useDeferredValue(search);
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const [reviewed, setReviewed] = useState<SessionDetail | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const { can, user, profile } = useAuth();
  const query = useQuery({
    queryKey: ['internal-sessions', user?.id, profile?.role, status, platform, deferredSearch],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: () => loadSessionWorkspace(status, platform, deferredSearch),
  });
  const overview = useQuery({
    queryKey: ['internal-sessions-overview', user?.id, profile?.role],
    queryFn: () => loadSessionOverview(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const terminate = useAdministrativeMutation<{ id: string; reason: string }, boolean>({
    mutationFn: async ({ id, reason }) => {
      const { data, error } = await supabase.rpc('end_active_session', {
        p_session_id: id,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    invalidate: [['internal-sessions'], ['internal-sessions-overview']],
  });

  const overviewItems = useMemo(() => overview.data?.items ?? [], [overview.data?.items]);
  const anomalies = useMemo(() => findSessionAnomalies(overviewItems), [overviewItems]);
  const anomalyIds = useMemo(() => new Set(anomalies.map((item) => item.session.id)), [anomalies]);
  const activeDevices = new Set(overviewItems.map((item) => item.device_id)).size;
  const activeCustomers = new Set(overviewItems.map((item) => item.organization_id).filter(Boolean)).size;
  const policy = useMemo(() => summarizePolicy(overviewItems, can('session.terminate')), [overviewItems, can]);

  return (
    <div className="page-stack space-y-6">
      <form
        id="session-revoke-form"
        className="sr-only"
        onSubmit={(event) => {
          event.preventDefault();
          if (can('session.terminate')) setSelected(query.data?.items.find((item) => item.status === 'active') ?? null);
        }}
      />

      <PageHeader
        eyebrow="Segurança e Acessos"
        title="Sessões"
        description="Acessos ativos e histórico de encerramentos, atualizados automaticamente a cada 30 segundos."
        actions={<Button asChild variant="outline"><Link to="/app/dispositivo">Ver dispositivos</Link></Button>}
      />

      <AsyncBoundary
        loading={overview.isLoading}
        error={overview.error}
        onRetry={() => void overview.refetch()}
        loadingLabel="Carregando panorama de sessões…"
      >
        {overview.data ? (
          <>
            <SessionPulse
              overview={overview.data}
              devices={activeDevices}
              customers={activeCustomers}
            />

            <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.2fr)_320px_minmax(320px,1fr)]">
              <AnomalyMap sessions={overviewItems} anomalies={anomalies} />
              <PolicyCard policy={policy} />
              <RiskAlert anomalies={anomalies} onSelect={(session) => void openReview(session)} />
            </div>
          </>
        ) : null}
      </AsyncBoundary>

      <Card className="rounded-2xl border-border/70 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Sessões Recentes</h2>
              <p className="text-xs text-muted-foreground">Listagem filtrável dos acessos registrados na plataforma.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44 rounded-xl border-border/80 bg-background/80" aria-label="Filtrar status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/80">
                <SelectItem value="all">Todos os status</SelectItem>
                {['active', 'ended', 'expired', 'revoked', 'replaced'].map((value) => (
                  <SelectItem key={value} value={value}>{ptBrLabel(value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-full sm:w-44 rounded-xl border-border/80 bg-background/80" aria-label="Filtrar plataforma">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/80">
                <SelectItem value="all">Todas plataformas</SelectItem>
                {['android', 'ios', 'web', 'unknown'].map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full sm:w-60 rounded-xl" placeholder="Usuário, organização ou dispositivo" aria-label="Pesquisar sessões" />

            <Button
              variant="outline"
              size="icon"
              className="rounded-xl border-border/80 shrink-0"
              onClick={() => void query.refetch()}
              title="Atualizar sessões"
            >
              <RefreshCw className={cn("h-4 w-4 text-muted-foreground", query.isFetching && "animate-spin text-primary")} />
            </Button>
          </div>
        </div>

        {reviewError ? (
          <div role="alert" className="mx-6 mt-4 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive-soft p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-destructive font-medium">{reviewError}</p>
            <Button type="button" variant="outline" size="sm" className="rounded-lg border-destructive/40 text-destructive" onClick={() => setReviewError(null)}>
              Fechar aviso
            </Button>
          </div>
        ) : null}

        <AsyncBoundary
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          empty={Boolean(query.data && !query.data.items.length)}
          emptyTitle="Nenhuma sessão encontrada"
          emptyDescription="Não há sessões registradas com os filtros selecionados."
        >
          {query.data?.items.length ? (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[850px]">
                  <TableHeader>
                    <TableRow className="border-b border-border/60 bg-muted/40 hover:bg-muted/40">
                      <TableHead className="pl-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">Usuário</TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Organização</TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dispositivo / Plataforma</TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Última atividade</TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado / Risco</TableHead>
                      <TableHead className="w-24 text-right pr-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data.items.map((session) => {
                      const risk = anomalyIds.has(session.id);
                      return (
                        <TableRow key={session.id} className="border-b border-border/40 hover:bg-muted/50 transition-colors">
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                {session.user_id.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-xs font-mono font-semibold text-foreground">{shortId(session.user_id)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground/90">
                            {session.organizations?.display_name || <span className="text-muted-foreground italic">Sem organização</span>}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-2">
                              <PlatformIcon platform={session.platform} />
                              <div>
                                <p className="font-semibold text-foreground">{session.device_name || 'Dispositivo genérico'}</p>
                                <p className="text-[10px] uppercase font-mono text-muted-foreground">{session.platform}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            {relativeActivity(session.last_heartbeat_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={risk ? 'warning' : session.status === 'active' ? 'success' : 'secondary'}>
                              {risk ? 'Revisar agora' : ptBrLabel(session.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl border-border/80 text-xs hover:bg-primary/10 hover:text-primary transition-colors"
                              disabled={reviewingId === session.id}
                              onClick={() => void openReview(session)}
                            >
                              {reviewingId === session.id ? 'Carregando…' : 'Detalhes'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="border-t border-border/60 px-6 py-3.5 bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
                <span>Exibindo <strong>{query.data.items.length}</strong> de <strong>{query.data.total.toLocaleString('pt-BR')}</strong> sessões</span>
                <span>Revogação remota exige motivo registrado na auditoria</span>
              </div>
            </>
          ) : null}
        </AsyncBoundary>
      </Card>

      <HighAssuranceDialog
        open={Boolean(selected)}
        title="Revogar sessão remotamente"
        impact="O dispositivo perderá acesso imediatamente. A revogação exige motivo e fica registrada na auditoria com estado anterior e horário."
        confirmLabel="Revogar sessão"
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onConfirm={async (reason) => {
          if (!selected) return;
          const result = await terminate.mutateAsync({ id: selected.id, reason });
          if (!result.ok) throw new Error(result.error);
          setSelected(null);
        }}
      />
      <SessionReviewDialog
        detail={reviewed}
        canTerminate={can('session.terminate')}
        onClose={() => setReviewed(null)}
        onTerminate={() => {
          if (reviewed) setSelected(reviewed.session);
          setReviewed(null);
        }}
      />
    </div>
  );

  async function openReview(session: SessionRow) {
    if (reviewingId) return;
    setReviewError(null);
    setReviewingId(session.id);
    try {
      const { data, error } = await (supabase.rpc as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>)('get_internal_session_detail', { p_session_id: session.id });
      if (error || !isSessionDetail(data)) throw new Error(error?.message ?? 'session_detail_invalid');
      setReviewed(data);
    } catch {
      setReviewError('Não foi possível registrar esta revisão na auditoria. Tente novamente.');
    } finally {
      setReviewingId(null);
    }
  }
}

async function loadSessionOverview(): Promise<SessionOverview> {
  const workspace = await loadSessionWorkspace('active', 'all', '');
  return {
    items: workspace.items,
    total: workspace.overview.active_total,
    platforms: workspace.overview.platforms,
  };
}

async function loadSessionWorkspace(status: string, platform: string, search: string): Promise<SessionWorkspace> {
  const { data, error } = await (supabase.rpc as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>)('get_internal_session_workspace', {
    p_status: status === 'all' ? null : status,
    p_platform: platform === 'all' ? null : platform,
    p_search: search.trim() || null,
    p_limit: 200,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('session_workspace_invalid');
  return data as SessionWorkspace;
}

function SessionPulse({
  overview,
  devices,
  customers,
}: {
  overview: SessionOverview;
  devices: number;
  customers: number;
}) {
  return (
    <Card className="rounded-2xl border-border/80 bg-card/90 backdrop-blur-md text-foreground shadow-sm overflow-hidden">
      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 items-center divide-y md:divide-y-0 md:divide-x divide-border/60">
        <div className="md:pr-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Panorama Em Tempo Real</p>
          </div>
          <strong className="mt-3 block text-3xl font-extrabold tracking-tight text-foreground">
            {overview.total.toLocaleString('pt-BR')} <span className="text-lg font-normal text-muted-foreground">sessões ativas</span>
          </strong>
          <p className="mt-2 text-xs text-muted-foreground">
            em <strong>{devices.toLocaleString('pt-BR')}</strong> {devices === 1 ? 'dispositivo' : 'dispositivos'} · <strong>{customers.toLocaleString('pt-BR')}</strong> {customers === 1 ? 'cliente' : 'clientes'}
          </p>
        </div>

        <div className="pt-4 md:pt-0 md:pl-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
            <Monitor className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">Web</span>
          </div>
          <strong className="text-2xl font-bold text-foreground tabular-nums">{overview.platforms.web.toLocaleString('pt-BR')}</strong>
        </div>

        <div className="pt-4 md:pt-0 md:pl-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
            <Smartphone className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">Android</span>
          </div>
          <strong className="text-2xl font-bold text-foreground tabular-nums">{overview.platforms.android.toLocaleString('pt-BR')}</strong>
        </div>

        <div className="pt-4 md:pt-0 md:pl-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
            <Tablet className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">iOS</span>
          </div>
          <strong className="text-2xl font-bold text-foreground tabular-nums">{overview.platforms.ios.toLocaleString('pt-BR')}</strong>
        </div>
      </CardContent>
    </Card>
  );
}

interface SessionAnomaly {
  session: SessionRow;
  reason: string;
  severity: 'medium' | 'high';
}

function findSessionAnomalies(sessions: SessionRow[]): SessionAnomaly[] {
  const result: SessionAnomaly[] = [];
  sessions.forEach((session) => {
    if (session.platform === 'unknown') {
      result.push({ session, reason: 'Plataforma não identificada', severity: 'medium' });
      return;
    }
    if (!session.organization_id) {
      result.push({ session, reason: 'Sessão ativa sem organização vinculada', severity: 'medium' });
    }
  });
  return result;
}

function AnomalyMap({ sessions, anomalies }: { sessions: SessionRow[]; anomalies: SessionAnomaly[] }) {
  const anomalyIds = new Set(anomalies.map((item) => item.session.id));
  const slots = Array.from({ length: 48 }, () => ({ total: 0, risk: 0 }));
  sessions.forEach((session) => {
    const date = new Date(session.last_heartbeat_at);
    if (Number.isNaN(date.getTime())) return;
    const slot = date.getHours() * 2 + (date.getMinutes() >= 30 ? 1 : 0);
    slots[slot].total += 1;
    if (anomalyIds.has(session.id)) slots[slot].risk += 1;
  });
  const max = Math.max(...slots.map((slot) => slot.total), 1);

  return (
    <Card className="rounded-2xl border-border/80 bg-card/70 backdrop-blur-sm shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Atividade Recente</h2>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">Janelas de 30 min</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Volume de tráfego e distribuição de alertas no ciclo de 24 horas.</p>

        <div
          className="mt-6 grid grid-cols-12 gap-2"
          role="img"
          aria-label={`Mapa de atividade com ${sessions.length} sessões e ${anomalies.length} alertas`}
        >
          {slots.map((slot, index) => (
            <span
              key={index}
              title={`${slot.total} sessão(ões) no intervalo (${index * 0.5}h)`}
              aria-hidden="true"
              className={cn(
                'h-3.5 w-full rounded-md transition-all duration-200 hover:scale-110',
                slot.risk > 0
                  ? 'bg-warning shadow-xs ring-1 ring-warning/30'
                  : slot.total === 0
                    ? 'bg-muted/60'
                    : slot.total / max > 0.66
                      ? 'bg-primary'
                      : 'bg-primary/40',
              )}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
          <span>00:00</span>
          <span>12:00</span>
          <span>23:59</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface PolicySummary {
  policy: string;
  timeout: number | null;
  tolerance: number | null;
  remoteRevocation: boolean;
}

function summarizePolicy(sessions: SessionRow[], remoteRevocation: boolean): PolicySummary {
  const organizations = sessions.map((item) => item.organizations).filter((item): item is SessionOrganization => Boolean(item));
  return {
    policy: mostCommon(organizations.map((item) => item.session_policy)) || 'não informada',
    timeout: median(organizations.map((item) => item.session_timeout_minutes)),
    tolerance: median(organizations.map((item) => item.offline_tolerance_minutes)),
    remoteRevocation,
  };
}

function PolicyCard({ policy }: { policy: PolicySummary }) {
  const rows = [
    ['Política predominante', policy.policy === 'replace' ? 'Substituir' : policy.policy === 'block' ? 'Bloquear' : policy.policy],
    ['Expiração mediana', policy.timeout === null ? '—' : formatMinutes(policy.timeout)],
    ['Tolerância offline', policy.tolerance === null ? '—' : formatMinutes(policy.tolerance)],
    ['Revogação remota', policy.remoteRevocation ? 'Disponível' : 'Restrita'],
  ];
  return (
    <Card className="rounded-2xl border-border/80 bg-card/70 backdrop-blur-sm shadow-sm">
      <CardContent className="p-6">
        <h2 className="text-base font-bold text-foreground">Diretrizes de Sessão</h2>
        <div className="mt-3">
          <Badge variant={policy.policy === 'block' ? 'success' : 'secondary'} className="rounded-lg">
            Persistência controlada
          </Badge>
        </div>
        <dl className="mt-5 space-y-4">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 text-xs">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-semibold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function RiskAlert({
  anomalies,
  onSelect,
}: {
  anomalies: SessionAnomaly[];
  onSelect: (session: SessionRow) => void;
}) {
  return (
    <Card className={cn("rounded-2xl shadow-sm transition-all", anomalies.length ? "border-warning/40 bg-warning-soft/30" : "border-border/80 bg-card/70")}>
      <CardContent className="p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn("h-4 w-4", anomalies.length ? "text-warning-foreground" : "text-muted-foreground")} />
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Alertas de Risco</p>
        </div>

        <h2 className="mt-3 text-lg font-bold text-foreground">
          {anomalies.length.toLocaleString('pt-BR')} {anomalies.length === 1 ? 'acesso exige atenção' : 'acessos exigem atenção'}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Sessões ativas sem organização ou com identificador de plataforma incomum.
        </p>

        {anomalies.length ? (
          <div className="mt-4 space-y-2.5">
            {anomalies.slice(0, 3).map((item) => (
              <button
                key={item.session.id}
                type="button"
                onClick={() => onSelect(item.session)}
                className="flex w-full items-center justify-between rounded-xl border border-warning/30 bg-card/90 p-3 text-left hover:border-warning/60 transition-all group"
              >
                <div className="min-w-0">
                  <strong className="block truncate text-xs font-mono text-foreground">{shortId(item.session.user_id)}</strong>
                  <span className="block text-[11px] text-muted-foreground">{item.reason}</span>
                </div>
                <span className="text-xs font-semibold text-primary group-hover:underline shrink-0 ml-2">Revisar</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-border/40 bg-card/60 p-4 text-center">
            <p className="text-xs font-medium text-foreground">Nenhuma vulnerabilidade ou anomalia detectada.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SessionReviewDialog({
  detail,
  canTerminate,
  onClose,
  onTerminate,
}: {
  detail: SessionDetail | null;
  canTerminate: boolean;
  onClose: () => void;
  onTerminate: () => void;
}) {
  if (!detail) return null;
  const { session } = detail;
  const risk = findSessionAnomalies([session])[0];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            Revisão Detalhada de Sessão
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Esta consulta é registrada na auditoria para conformidade de acesso.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3.5 py-3 text-xs">
          <ReviewRow label="Identificador de Usuário" value={shortId(session.user_id)} />
          <ReviewRow label="Organização Vinculada" value={session.organizations?.display_name || 'Não vinculada'} />
          <ReviewRow label="Dispositivo / SO" value={session.device_name || session.platform} />
          <ReviewRow label="Início da sessão" value={formatTimestamp(session.started_at)} />
          <ReviewRow label="Última atividade" value={relativeActivity(session.last_heartbeat_at)} />
          {session.ended_at ? <ReviewRow label="Encerrada em" value={formatTimestamp(session.ended_at)} /> : null}
          {session.end_reason ? <ReviewRow label="Motivo do encerramento" value={session.end_reason} /> : null}
          {risk && <ReviewRow label="Motivo do Alerta" value={risk.reason} tone="warning" />}
        </dl>
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs">
          <p className="font-semibold text-foreground">Histórico deste dispositivo</p>
          <p className="mt-1 text-muted-foreground">{detail.same_device_sessions.length} sessão(ões) encontradas para este usuário e dispositivo.</p>
          {detail.same_device_sessions.length > 1 ? <ul className="mt-2 space-y-1 text-muted-foreground">{detail.same_device_sessions.slice(0, 3).map((item) => <li key={item.id}>{ptBrLabel(item.status)} · iniciada em {formatTimestamp(item.started_at)}</li>)}</ul> : null}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Fechar</Button>
          {canTerminate && session.status === 'active' ? (
            <Button type="button" variant="destructive" className="rounded-xl gap-1.5" onClick={onTerminate}>
              <LogOut className="h-4 w-4" />
              Revogar sessão
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-2.5 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right font-medium', tone === 'warning' ? 'text-warning font-semibold' : 'text-foreground')}>{value}</dd>
    </div>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform.toLowerCase()) {
    case 'web':
      return <Monitor className="h-4 w-4 text-primary shrink-0" />;
    case 'android':
      return <Smartphone className="h-4 w-4 text-primary shrink-0" />;
    case 'ios':
      return <Tablet className="h-4 w-4 text-primary shrink-0" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function isSessionDetail(value: unknown): value is SessionDetail {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const detail = value as Record<string, unknown>;
  return Boolean(detail.session && typeof detail.session === 'object' && Array.isArray(detail.same_device_sessions));
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function formatMinutes(minutes: number) {
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleString('pt-BR');
}

function relativeActivity(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60) return `há ${Math.floor(minutes / 60)} h`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
