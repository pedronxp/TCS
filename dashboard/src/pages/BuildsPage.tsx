import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Check,
  Circle,
  ExternalLink,
  LoaderCircle,
  Plus,
  X,
} from 'lucide-react';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { StatusBadge } from '@/components/domain/Badges';
import { DataTable } from '@/components/ui/AsyncState';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { jsonArray, jsonObject, jsonString } from '@/lib/json';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/supabase';

type BuildRow = Database['public']['Tables']['builds']['Row'];
type BuildRequestRow = Database['public']['Tables']['internal_build_requests']['Row'];

interface Draft {
  provider: 'eas' | 'github';
  environment: 'development' | 'preview' | 'production';
  version: string;
  profile: string;
  changelog: string;
}

interface BuildEvent {
  id: string;
  version: string | null;
  severity: string;
  correlation: string | null;
  summary: string;
  occurredAt: string;
}

export function BuildsPage() {
  const { can, profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmingRequest, setConfirmingRequest] = useState(false);
  const [decision, setDecision] = useState<{ id: string; approve: boolean } | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['internal-builds', user?.id, profile?.role],
    queryFn: async () => {
      const [requests, builds, events] = await Promise.all([
        supabase.from('internal_build_requests').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('builds').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.rpc('list_internal_technical_events', {
          p_category: 'build',
          p_limit: 50,
        }),
      ]);
      const firstError = requests.error || builds.error || events.error;
      if (firstError) throw firstError;
      return {
        requests: requests.data || [],
        builds: builds.data || [],
        events: parseBuildEvents(events.data),
      };
    },
    refetchInterval: 30000,
  });

  async function execute(requestId: string) {
    const { data, error } = await supabase.functions.invoke('trigger-build', {
      body: { request_id: requestId },
    });
    if (error) throw error;
    const root = jsonObject(data);
    if (!root || root.ok !== true) {
      throw new Error(jsonString(root?.error) || 'Não foi possível iniciar o build.');
    }
    await queryClient.invalidateQueries({ queryKey: ['internal-builds'] });
  }

  const requestMutation = useAdministrativeMutation<{
    draft: Draft;
    reason: string;
  }, { requestId: string; status: string }>({
    mutationFn: async (input, operationId) => {
      const { data, error } = await supabase.rpc('request_internal_build', {
        p_operation_id: operationId,
        p_provider: input.draft.provider,
        p_environment: input.draft.environment,
        p_version: input.draft.version,
        p_profile: input.draft.profile,
        p_changelog: input.draft.changelog,
        p_reason: input.reason,
      });
      if (error) throw error;
      const root = jsonObject(data);
      const requestId = jsonString(root?.request_id);
      const status = jsonString(root?.status);
      if (!requestId || !status) throw new Error('Resposta de build inválida.');
      if (status === 'approved') await execute(requestId);
      return { requestId, status };
    },
    invalidate: [['internal-builds'], ['audit-timeline'], ['internal-dashboard']],
  });

  const decideMutation = useAdministrativeMutation<{
    id: string;
    approve: boolean;
    reason: string;
  }, unknown>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.rpc('decide_internal_build', {
        p_request_id: input.id,
        p_approve: input.approve,
        p_reason: input.reason,
      });
      if (error) throw error;
      if (input.approve) await execute(input.id);
      return data;
    },
    invalidate: [['internal-builds'], ['audit-timeline'], ['internal-dashboard']],
  });

  const requests = useMemo(() => query.data?.requests ?? [], [query.data]);
  const builds = useMemo(() => query.data?.builds ?? [], [query.data]);
  const events = useMemo(() => query.data?.events ?? [], [query.data]);
  const currentBuild = builds.find((build) => build.status === 'building' || build.status === 'queued') || builds[0] || null;
  const currentRequest = currentBuild
    ? requests.find((request) => request.version === currentBuild.version && request.executed_at)
      || requests.find((request) => request.version === currentBuild.version)
      || null
    : requests[0] || null;
  const pendingRequests = requests.filter((request) => request.status === 'pending' || request.status === 'approved');
  const currentEvents = currentBuild
    ? events.filter((event) => !event.version || event.version === currentBuild.version).slice(0, 6)
    : events.slice(0, 6);

  function openDraft() {
    setDraft({
      provider: 'eas',
      environment: 'preview',
      version: currentBuild?.version || '',
      profile: 'preview',
      changelog: '',
    });
    setConfirmingRequest(false);
  }

  async function runExecute(requestId: string) {
    if (executingId) return;
    setExecutionError(null);
    setExecutingId(requestId);
    try {
      await execute(requestId);
    } catch (caught) {
      setExecutionError(caught instanceof Error ? caught.message : 'Não foi possível executar o build aprovado.');
    } finally {
      setExecutingId(null);
    }
  }

  return (
    <section className="page-stack max-w-[1094px]" aria-labelledby="builds-title">
      <form
        id="build-request-form"
        className="hidden"
        onSubmit={(event) => {
          event.preventDefault();
          if (can('build.request')) openDraft();
        }}
      />

      <header>
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Entrega contínua</p>
        <h1 id="builds-title" className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.025em]">Builds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe filas, artefatos e falhas sem perder o contexto da versão.
        </p>
        {can('build.request') && (
          <Button className="mt-4 sm:hidden" onClick={openDraft}>
            <Plus />
            Solicitar build
          </Button>
        )}
      </header>

      <AsyncBoundary
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={Boolean(query.data && !builds.length && !requests.length)}
        emptyTitle="Sem builds"
        emptyDescription="Nenhuma solicitação ou execução foi registrada."
      >
        {query.data && (
          <>
            <CurrentBuildHero build={currentBuild} request={currentRequest} />
            <PipelineStages build={currentBuild} request={currentRequest} />

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
              <BuildHistory builds={builds.slice(0, 6)} />
              <BuildLogPanel events={currentEvents} build={currentBuild} />
            </div>

            <ApprovalQueue
              requests={pendingRequests}
              canApprove={can('build.approve')}
              currentUserId={profile?.userId}
              onDecision={setDecision}
              executingId={executingId}
              onExecute={(id) => void runExecute(id)}
            />
            {executionError ? (
              <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive-soft p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p>{executionError}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setExecutionError(null)}>Fechar aviso</Button>
              </div>
            ) : null}
          </>
        )}
      </AsyncBoundary>

      <BuildDraftDialog
        draft={draft}
        open={Boolean(draft && !confirmingRequest)}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onContinue={() => setConfirmingRequest(true)}
      />

      {draft && (
        <HighRiskDialog
          open={confirmingRequest}
          title="Confirmar solicitação de build"
          description="A solicitação exige MFA e ficará auditada antes da execução."
          confirmLabel="Solicitar build"
          onClose={() => setConfirmingRequest(false)}
          onConfirm={async (reason) => {
            const result = await requestMutation.mutateAsync({ draft, reason });
            if (!result.ok) throw new Error(result.error);
            setConfirmingRequest(false);
            setDraft(null);
          }}
        />
      )}

      {decision && (
        <HighRiskDialog
          open
          title={decision.approve ? 'Aprovar build de produção' : 'Rejeitar build de produção'}
          description="A decisão exige MFA, separação de funções e justificativa."
          confirmLabel={decision.approve ? 'Aprovar e executar' : 'Rejeitar'}
          onClose={() => setDecision(null)}
          onConfirm={async (reason) => {
            const result = await decideMutation.mutateAsync({ ...decision, reason });
            if (!result.ok) throw new Error(result.error);
            setDecision(null);
          }}
        />
      )}
    </section>
  );
}

function CurrentBuildHero({ build, request }: { build: BuildRow | null; request: BuildRequestRow | null }) {
  const progress = buildProgress(build?.status);
  return (
    <section className="grid min-h-[150px] gap-6 rounded-lg border border-border bg-muted p-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)] lg:items-center">
      <div>
        <StatusBadge value={build?.status || request?.status || 'waiting'} />
        <h2 className="mt-4 text-[22px] font-bold">
          {build ? `${build.profile} · ${build.version}` : request ? `${request.profile} · ${request.version}` : 'Aguardando primeira execução'}
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {build
            ? `${build.provider.toUpperCase()} · iniciado por ${build.initiated_by_name || build.initiated_by?.slice(0, 8) || 'staff'} ${formatRelative(build.created_at)}`
            : request
              ? `Solicitação ${request.status} ${formatRelative(request.created_at)}`
              : 'Nenhum build persistido.'}
        </p>
      </div>
      <div>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-card">
            <div
              className={cn('h-full rounded-full', build?.status === 'failed' ? 'bg-destructive' : 'bg-primary')}
              style={{ width: `${progress}%` }}
            />
          </div>
          <strong className="text-xs text-foreground">{progress}%</strong>
        </div>
        <p className="mt-3 text-xs font-semibold text-foreground">{buildStageLabel(build?.status, request?.status)}</p>
      </div>
    </section>
  );
}

function PipelineStages({ build, request }: { build: BuildRow | null; request: BuildRequestRow | null }) {
  const stages = pipelineState(build, request);
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Etapas persistidas do pipeline">
      {stages.map((stage) => (
        <Card key={stage.label} className="min-h-[104px] shadow-none">
          <CardContent className="flex items-start gap-3 p-4">
            <PipelineIcon state={stage.state} />
            <div>
              <p className="text-sm font-bold">{stage.label}</p>
              <p className={cn(
                'mt-2 text-[10px] font-semibold',
                stage.state !== 'waiting' && 'text-foreground',
                stage.state === 'waiting' && 'text-muted-foreground',
              )}>
                {stage.detail}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function PipelineIcon({ state }: { state: 'done' | 'active' | 'waiting' | 'error' }) {
  const classes = {
    done: 'bg-success-soft text-success',
    active: 'bg-success-soft text-primary',
    waiting: 'bg-secondary text-muted-foreground',
    error: 'bg-destructive-soft text-destructive',
  };
  const Icon = state === 'done' ? Check : state === 'active' ? LoaderCircle : state === 'error' ? X : Circle;
  return (
    <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full', classes[state])}>
      <Icon className={cn('h-3.5 w-3.5', state === 'active' && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
    </span>
  );
}

function BuildHistory({ builds }: { builds: BuildRow[] }) {
  return (
    <Card className="min-w-0 shadow-none">
      <CardContent className="px-0 pb-4 pt-5">
        <h2 className="px-6 text-[17px] font-bold">Histórico recente</h2>
        {builds.length ? (
          <div className="mt-4">
            <DataTable headers={['Build', 'Perfil', 'Versão', 'Status', 'Duração']} minWidth={620}>
              {builds.map((build, index) => (
                <tr key={build.id} className="border-t">
                  <td className="p-3 pl-6 font-mono text-xs">#{shortBuildId(build, index)}</td>
                  <td className="p-3 font-semibold">{build.profile}</td>
                  <td className="p-3">{build.version}</td>
                  <td className="p-3"><StatusBadge value={build.status} /></td>
                  <td className="p-3 pr-6 text-xs text-muted-foreground">{buildDuration(build)}</td>
                </tr>
              ))}
            </DataTable>
          </div>
        ) : (
          <p className="px-6 py-8 text-sm text-muted-foreground">Nenhuma execução persistida.</p>
        )}
      </CardContent>
    </Card>
  );
}

function BuildLogPanel({ events, build }: { events: BuildEvent[]; build: BuildRow | null }) {
  return (
    <aside className="rounded-lg border border-border bg-card p-6" aria-labelledby="build-log-title">
      <p id="build-log-title" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Eventos permitidos</p>
      <div className="mt-7 min-h-[210px] space-y-5">
        {events.map((event) => (
          <div key={event.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 text-[10px]">
            <time className="text-muted-foreground">{formatTime(event.occurredAt)}</time>
            <p className={cn(event.severity === 'error' || event.severity === 'critical' ? 'text-destructive' : 'text-foreground')}>
              {event.summary}
            </p>
          </div>
        ))}
        {!events.length && <p className="text-xs leading-5 text-muted-foreground">Nenhum evento sanitizado foi retornado para este build.</p>}
      </div>
      <div className="mt-6 border-t border-border pt-5">
        <p className="truncate text-xs font-bold">{artifactName(build)}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-[10px]">
          {build?.apk_url && <ArtifactLink href={build.apk_url}>Abrir APK</ArtifactLink>}
          {build?.drive_folder_url && <ArtifactLink href={build.drive_folder_url}>Pasta permitida</ArtifactLink>}
          {!build?.apk_url && !build?.drive_folder_url && <span className="text-muted-foreground">Artefato ainda indisponível</span>}
        </div>
      </div>
    </aside>
  );
}

function ArtifactLink({ href, children }: { href: string; children: ReactNode }) {
  if (!validArtifactUrl(href)) {
    return <span className="font-semibold text-foreground">Artefato bloqueado</span>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-primary">
      {children}<ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

function ApprovalQueue({
  requests,
  canApprove,
  currentUserId,
  executingId,
  onDecision,
  onExecute,
}: {
  requests: BuildRequestRow[];
  canApprove: boolean;
  currentUserId?: string;
  executingId: string | null;
  onDecision: (decision: { id: string; approve: boolean }) => void;
  onExecute: (id: string) => void;
}) {
  if (!requests.length) return null;
  return (
    <Card className="min-w-0 shadow-none">
      <CardContent className="px-0 pb-4 pt-5">
        <div className="flex items-center justify-between gap-4 px-6">
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Separação de funções</p>
            <h2 className="mt-1 text-[17px] font-bold">Solicitações e aprovações</h2>
          </div>
          <span className="text-xs text-muted-foreground">{requests.length} pendentes</span>
        </div>
        <div className="mt-4">
          <DataTable headers={['Versão/Ambiente', 'Solicitante', 'Provedor', 'Criação', 'Status', 'Ações']} minWidth={880}>
            {requests.map((request) => (
              <tr key={request.id} className="border-t">
                <td className="p-3 pl-6"><b>{request.version}</b><p className="text-xs text-muted-foreground">{ptBrLabel(request.environment)} · {request.profile}</p></td>
                <td className="p-3 font-mono text-xs">{request.requested_by.slice(0, 8)}</td>
                <td className="p-3">{request.provider}</td>
                <td className="p-3 text-xs">{formatDateTime(request.created_at)}</td>
                <td className="p-3"><StatusBadge value={request.status} /></td>
                <td className="p-3 pr-6">
                  <div className="flex gap-2">
                    {request.status === 'pending' && canApprove && request.requested_by !== currentUserId && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onDecision({ id: request.id, approve: true })}>Aprovar</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDecision({ id: request.id, approve: false })}>Rejeitar</Button>
                      </>
                    )}
                    {request.status === 'approved' && canApprove && (
                      <Button size="sm" variant="outline" disabled={executingId === request.id} onClick={() => onExecute(request.id)}>
                        {executingId === request.id ? 'Executando…' : 'Executar'} <ArrowUpRight />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      </CardContent>
    </Card>
  );
}

function BuildDraftDialog({
  draft,
  open,
  onChange,
  onClose,
  onContinue,
}: {
  draft: Draft | null;
  open: boolean;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  if (!draft) return null;
  const valid = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(draft.version.trim()) && draft.profile.trim().length > 0;
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Solicitar build</DialogTitle>
          <DialogDescription>
            Produção exige aprovação de outro owner e todas as ações são auditadas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Provedor" value={draft.provider} onChange={(value) => onChange({ ...draft, provider: value as Draft['provider'] })}>
            <option value="eas">EAS</option>
            <option value="github">GitHub Actions</option>
          </SelectField>
          <SelectField label="Ambiente" value={draft.environment} onChange={(value) => onChange({ ...draft, environment: value as Draft['environment'] })}>
            <option value="development">Desenvolvimento</option>
            <option value="preview">Preview</option>
            <option value="production">Produção</option>
          </SelectField>
          <Field label="Versão" value={draft.version} onChange={(value) => onChange({ ...draft, version: value })} />
          <Field label="Profile" value={draft.profile} onChange={(value) => onChange({ ...draft, profile: value })} />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="build-changelog">Changelog</Label>
            <Textarea id="build-changelog" value={draft.changelog} onChange={(event) => onChange({ ...draft, changelog: event.target.value })} rows={5} />
          </div>
        </div>
        {draft.environment === 'production' && (
          <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning-soft-foreground">
            O solicitante não pode aprovar a própria solicitação de produção.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!valid} onClick={onContinue}>Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = `build-${label.toLocaleLowerCase('pt-BR').replace(/\s+/g, '-')}`;
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = `build-${label.toLocaleLowerCase('pt-BR').replace(/\s+/g, '-')}`;
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20">{children}</select></div>;
}

function parseBuildEvents(value: import('@/types/supabase').Json | null): BuildEvent[] {
  return jsonArray(value).map(jsonObject).filter(Boolean).map((row) => ({
    id: jsonString(row?.id) || jsonString(row?.event_key) || crypto.randomUUID(),
    version: jsonString(row?.app_version),
    severity: jsonString(row?.severity) || 'info',
    correlation: jsonString(row?.correlation_id),
    summary: jsonString(row?.summary) || 'Evento técnico',
    occurredAt: jsonString(row?.occurred_at) || new Date(0).toISOString(),
  }));
}

function pipelineState(build: BuildRow | null, request: BuildRequestRow | null) {
  const requestRejected = request?.status === 'rejected' || request?.status === 'failed';
  const buildFailed = build?.status === 'failed';
  return [
    { label: 'Solicitação', detail: request ? 'Concluída' : 'Aguardando', state: request ? 'done' : 'waiting' },
    {
      label: 'Aprovação',
      detail: requestRejected ? 'Rejeitada' : request?.status === 'pending' ? 'Em análise' : request ? 'Concluída' : 'Aguardando',
      state: requestRejected ? 'error' : request?.status === 'pending' ? 'active' : request ? 'done' : 'waiting',
    },
    { label: 'Enfileiramento', detail: build ? 'Concluído' : 'Aguardando', state: build ? 'done' : 'waiting' },
    {
      label: 'Execução',
      detail: buildFailed ? 'Falhou' : build?.status === 'building' ? 'Executando' : build?.status === 'succeeded' ? 'Concluída' : 'Aguardando',
      state: buildFailed ? 'error' : build?.status === 'building' ? 'active' : build?.status === 'succeeded' ? 'done' : 'waiting',
    },
    {
      label: 'Artefato',
      detail: buildFailed ? 'Indisponível' : build?.apk_url || build?.drive_folder_url ? 'Disponível' : 'Aguardando',
      state: buildFailed ? 'error' : build?.apk_url || build?.drive_folder_url ? 'done' : 'waiting',
    },
  ] as { label: string; detail: string; state: 'done' | 'active' | 'waiting' | 'error' }[];
}

function buildProgress(status: string | undefined) {
  if (status === 'succeeded' || status === 'failed') return 100;
  if (status === 'building') return 66;
  if (status === 'queued') return 34;
  return 0;
}

function buildStageLabel(buildStatus?: string, requestStatus?: string) {
  if (buildStatus === 'succeeded') return 'Artefato disponível';
  if (buildStatus === 'failed') return 'Execução encerrada com falha';
  if (buildStatus === 'building') return 'Execução no provedor';
  if (buildStatus === 'queued') return 'Aguardando o provedor';
  if (requestStatus === 'pending') return 'Aguardando aprovação';
  return 'Aguardando execução';
}

function shortBuildId(build: BuildRow, index: number) {
  return build.github_run_id || build.eas_build_id?.slice(0, 8) || build.id.slice(0, 8) || String(index + 1);
}

function buildDuration(build: BuildRow) {
  if (!build.created_at) return '—';
  const end = build.completed_at ? new Date(build.completed_at).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - new Date(build.created_at).getTime()) / 60000));
  return build.completed_at ? `${minutes} min` : `${minutes} min em curso`;
}

function artifactName(build: BuildRow | null) {
  if (!build) return 'Nenhum artefato';
  return build.apk_url ? `app-${build.profile}-${build.version}.apk` : `${build.profile} · ${build.version}`;
}

function validArtifactUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatRelative(value: string | null) {
  if (!value) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))}`;
}
