import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, LogOut, ShieldCheck } from 'lucide-react';
import { HighAssuranceDialog } from '@/components/security/HighAssuranceDialog';
import { PageHeader } from '@/components/domain/PageHeader';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
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
  organizations: SessionOrganization | null;
}

interface SessionOverview {
  items: SessionRow[];
  total: number;
  platforms: Record<'web' | 'android' | 'ios', number>;
}

export function SessionsPage() {
  const [status, setStatus] = useState('active');
  const [platform, setPlatform] = useState('all');
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const [reviewed, setReviewed] = useState<SessionRow | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const { can, user, profile } = useAuth();
  const query = useQuery({
    queryKey: ['internal-sessions', user?.id, profile?.role, status, platform],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      let request = supabase
        .from('active_sessions')
        .select(sessionSelect, { count: 'exact' })
        .order('last_heartbeat_at', { ascending: false })
        .limit(200);
      if (status !== 'all') request = request.eq('status', status);
      if (platform !== 'all') request = request.eq('platform', platform);
      const { data, error, count } = await request;
      if (error) throw error;
      return { items: (data ?? []) as unknown as SessionRow[], total: count ?? data?.length ?? 0 };
    },
  });
  const overview = useQuery({
    queryKey: ['internal-sessions-overview', user?.id, profile?.role],
    queryFn: loadSessionOverview,
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
    <div className="page-stack">
      <form
        id="session-revoke-form"
        className="sr-only"
        onSubmit={(event) => {
          event.preventDefault();
          if (can('session.terminate')) setSelected(query.data?.items.find((item) => item.status === 'active') ?? null);
        }}
      />

      <PageHeader
        eyebrow="Segurança de acesso"
        title="Sessões"
        description="Visibilidade em tempo real sobre dispositivos, políticas e comportamentos incomuns. Revogações remotas exigem confirmação e são registradas com motivo e horário."
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

            <div className="mt-7 grid items-stretch gap-5 xl:grid-cols-[420px_300px_minmax(0,1fr)] xl:grid-rows-[300px]">
              <AnomalyMap sessions={overviewItems} anomalies={anomalies} />
              <PolicyCard policy={policy} />
              <RiskAlert anomalies={anomalies} onSelect={(session) => void openReview(session)} />
            </div>
          </>
        ) : null}
      </AsyncBoundary>

      <Card className="overflow-hidden shadow-none">
        <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[17px] font-bold">Sessões recentes</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {['active', 'ended', 'expired', 'revoked', 'replaced'].map((value) => (
                  <SelectItem key={value} value={value}>{ptBrLabel(value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar plataforma">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas plataformas</SelectItem>
                {['android', 'ios', 'web', 'unknown'].map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {reviewError ? (
          <div role="alert" className="mx-6 mb-4 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive-soft p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>{reviewError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setReviewError(null)}>
              Fechar aviso
            </Button>
          </div>
        ) : null}
        <AsyncBoundary
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          empty={Boolean(query.data && !query.data.items.length)}
          emptyTitle="Nenhuma sessão"
          emptyDescription="Não há sessões para os filtros selecionados."
        >
          {query.data?.items.length ? (
            <>
              <Table className="min-w-[850px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Usuário</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Última atividade</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead className="w-16"><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.items.map((session) => {
                    const risk = anomalyIds.has(session.id);
                    return (
                      <TableRow key={session.id}>
                        <TableCell className="pl-6 text-xs font-semibold">{shortId(session.user_id)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {session.organizations?.display_name || 'Sem organização'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {session.device_name || session.platform}
                          <span className="block text-[10px] uppercase">{session.platform}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{relativeActivity(session.last_heartbeat_at)}</TableCell>
                        <TableCell><Badge variant={risk ? 'warning' : 'success'}>{risk ? 'Revisar agora' : 'Normal'}</Badge></TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary"
                            disabled={reviewingId === session.id}
                            onClick={() => void openReview(session)}
                          >
                            {reviewingId === session.id ? 'Registrando…' : 'Revisar'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="border-t px-6 py-4 text-[11px] text-muted-foreground">
                Exibindo {query.data.items.length} de {query.data.total.toLocaleString('pt-BR')} sessões · revogação remota exige confirmação e motivo
              </p>
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
        session={reviewed}
        canTerminate={can('session.terminate')}
        onClose={() => setReviewed(null)}
        onTerminate={() => {
          if (reviewed) setSelected(reviewed);
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
      await recordSessionReview(session.id);
      setReviewed(session);
    } catch {
      setReviewError('Não foi possível registrar esta revisão na auditoria. Os detalhes permaneceram fechados. Tente novamente.');
    } finally {
      setReviewingId(null);
    }
  }
}

const sessionSelect = [
  'id',
  'user_id',
  'organization_id',
  'device_id',
  'device_name',
  'platform',
  'status',
  'started_at',
  'last_heartbeat_at',
  'organizations(display_name,session_policy,session_timeout_minutes,offline_tolerance_minutes)',
].join(',');

async function loadSessionOverview(): Promise<SessionOverview> {
  const [sessions, web, android, ios] = await Promise.all([
    supabase
      .from('active_sessions')
      .select(sessionSelect, { count: 'exact' })
      .eq('status', 'active')
      .order('last_heartbeat_at', { ascending: false })
      .limit(200),
    countActivePlatform('web'),
    countActivePlatform('android'),
    countActivePlatform('ios'),
  ]);
  if (sessions.error) throw sessions.error;
  return {
    items: (sessions.data ?? []) as unknown as SessionRow[],
    total: sessions.count ?? sessions.data?.length ?? 0,
    platforms: { web, android, ios },
  };
}

async function countActivePlatform(platform: 'web' | 'android' | 'ios') {
  const { count, error } = await supabase
    .from('active_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('platform', platform);
  if (error) throw error;
  return count ?? 0;
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
    <Card className="overflow-hidden border-foreground bg-foreground text-background shadow-none">
      <CardContent className="grid grid-cols-3 gap-7 p-6 xl:grid-cols-[minmax(0,1fr)_repeat(3,minmax(72px,132px))] xl:items-center">
        <div className="col-span-3 xl:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Agora</p>
          <strong className="mt-4 block text-[28px] leading-none">
            {overview.total.toLocaleString('pt-BR')} {overview.total === 1 ? 'sessão ativa' : 'sessões ativas'}
          </strong>
          <p className="mt-3 text-xs text-background/60">
            em {devices.toLocaleString('pt-BR')} {devices === 1 ? 'dispositivo' : 'dispositivos'} ·{' '}
            {customers.toLocaleString('pt-BR')} {customers === 1 ? 'cliente' : 'clientes'}
          </p>
        </div>
        {([
          ['Web', overview.platforms.web],
          ['Android', overview.platforms.android],
          ['iOS', overview.platforms.ios],
        ] as const).map(([label, value]) => (
          <div key={label}>
            <p className="text-[11px] font-medium text-background/60">{label}</p>
            <strong className="mt-3 block text-xl text-primary">{value.toLocaleString('pt-BR')}</strong>
          </div>
        ))}
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
  const now = Date.now();
  const result: SessionAnomaly[] = [];
  sessions.forEach((session) => {
    const heartbeat = new Date(session.last_heartbeat_at).getTime();
    const timeout = session.organizations
      ? session.organizations.session_timeout_minutes + session.organizations.offline_tolerance_minutes
      : 24 * 60;
    const elapsedMinutes = Number.isNaN(heartbeat) ? Number.POSITIVE_INFINITY : (now - heartbeat) / 60_000;
    if (elapsedMinutes > timeout) {
      result.push({ session, reason: `Heartbeat excedeu a política em ${Math.round(elapsedMinutes - timeout)} min`, severity: 'high' });
      return;
    }
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
    <Card className="border-info/20 bg-info-soft shadow-none">
      <CardContent className="p-6">
        <h2 className="text-[17px] font-bold">Mapa de anomalias</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">Volume por hora e alertas derivados</p>
        <div
          className="mt-7 grid grid-cols-10 gap-2"
          role="img"
          aria-label={`Mapa de atividade com ${sessions.length} sessões e ${anomalies.length} alertas derivados`}
        >
          {slots.map((slot, index) => (
            <span
              key={index}
              title={`${slot.total} sessão(ões) no intervalo`}
              aria-hidden="true"
              className={cn(
                'h-6 w-6 rounded-md',
                slot.risk > 0
                  ? 'bg-warning'
                  : slot.total === 0
                    ? 'bg-muted'
                    : slot.total / max > 0.66
                      ? 'bg-info'
                      : 'bg-info/55',
              )}
            />
          ))}
        </div>
        <p className="mt-5 text-[10px] font-medium text-muted-foreground">Baixo · Médio · Alto risco</p>
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
    ['Revogação remota', policy.remoteRevocation ? 'Disponível' : 'Sem permissão'],
  ];
  return (
    <Card className="shadow-none">
      <CardContent className="p-6">
        <h2 className="text-[17px] font-bold">Política aplicada</h2>
        <Badge variant={policy.policy === 'block' ? 'success' : 'warning'} className="mt-4">
          Dados persistidos
        </Badge>
        <dl className="mt-6 space-y-5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 text-[11px]">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-semibold">{value}</dd>
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
    <Card className="border-destructive/25 bg-destructive-soft shadow-none">
      <CardContent className="p-6">
        <p className="text-[10px] font-bold uppercase tracking-wide text-destructive">Atenção</p>
        <h2 className="mt-5 text-[22px] font-bold">
          {anomalies.length.toLocaleString('pt-BR')} {anomalies.length === 1 ? 'sessão incomum' : 'sessões incomuns'}
        </h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Alertas derivados de heartbeat, plataforma e vínculo exigem revisão.
        </p>
        {anomalies.length ? (
          <div className="mt-6 space-y-4">
            {anomalies.slice(0, 3).map((item) => (
              <button
                key={item.session.id}
                type="button"
                onClick={() => onSelect(item.session)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-background text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-[11px]">{shortId(item.session.user_id)}</strong>
                  <span className="mt-0.5 block text-[10px] leading-4 text-foreground">{item.reason}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-7 text-xs font-medium text-foreground">Nenhuma anomalia detectada nos dados disponíveis.</p>
        )}
      </CardContent>
    </Card>
  );
}

function SessionReviewDialog({
  session,
  canTerminate,
  onClose,
  onTerminate,
}: {
  session: SessionRow | null;
  canTerminate: boolean;
  onClose: () => void;
  onTerminate: () => void;
}) {
  if (!session) return null;
  const risk = findSessionAnomalies([session])[0];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Revisar sessão</DialogTitle>
          <DialogDescription>
            Esta consulta é registrada na auditoria. São exibidos apenas os dados necessários para avaliar o acesso.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-4 text-sm">
          <ReviewRow label="Identificador" value={shortId(session.user_id)} />
          <ReviewRow label="Organização" value={session.organizations?.display_name || 'Não vinculada'} />
          <ReviewRow label="Dispositivo" value={session.device_name || session.platform} />
          <ReviewRow label="Última atividade" value={relativeActivity(session.last_heartbeat_at)} />
          {risk && <ReviewRow label="Motivo da revisão" value={risk.reason} tone="warning" />}
        </dl>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          {canTerminate && session.status === 'active' ? (
            <Button type="button" variant="destructive" onClick={onTerminate}><LogOut />Revogar sessão</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('max-w-[65%] text-right font-medium', tone === 'warning' && 'text-foreground')}>{value}</dd>
    </div>
  );
}

async function recordSessionReview(sessionId: string) {
  const { error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>)('record_internal_session_review', {
    p_session_id: sessionId,
  });
  if (error) throw error;
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

function relativeActivity(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60) return `há ${Math.floor(minutes / 60)} h`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
