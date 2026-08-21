import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  CheckCircle2,
  Clock3,
  CloudDownload,
  ExternalLink,
  FileCheck2,
  HardDrive,
  Loader2,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/domain/PageHeader';
import { StatusBadge } from '@/components/domain/Badges';
import { HighAssuranceDialog } from '@/components/security/HighAssuranceDialog';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useAuth } from '@/contexts/AuthContext';
import { jsonArray, jsonBoolean, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/supabase';

type ArchiveConfig = { mode: 'auto' | 'manual'; enabled: boolean; daysThreshold: number };
type Inspection = {
  id: string;
  protocol: string | null;
  municipality: string | null;
  risk: string | null;
  inspectionAt: string | null;
  storageLocation: string;
  driveFolderUrl?: string | null;
  archivedAt?: string | null;
  restoredAt?: string | null;
  manifestVerified?: boolean;
};
type RestoreRequest = {
  id: string;
  batchId: string;
  inspectionId: string;
  protocol: string | null;
  municipality: string | null;
  status: string;
  reason: string;
  requiresSecondApproval: boolean;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  approvedByName: string | null;
  attemptCount: number;
  lastError: string | null;
  completedAt: string | null;
};
type LifecycleState = {
  config: ArchiveConfig;
  pending: Inspection[];
  history: Inspection[];
  restoreRequests: RestoreRequest[];
};

function parseInspection(value: Json): Inspection | null {
  const row = jsonObject(value);
  const id = jsonString(row?.id);
  if (!id) return null;
  return {
    id,
    protocol: jsonString(row?.protocol),
    municipality: jsonString(row?.municipality),
    risk: jsonString(row?.risk),
    inspectionAt: jsonString(row?.inspection_at),
    storageLocation: jsonString(row?.storage_location) || 'supabase',
    driveFolderUrl: jsonString(row?.drive_folder_url),
    archivedAt: jsonString(row?.archived_at),
    restoredAt: jsonString(row?.restored_at),
    manifestVerified: jsonBoolean(row?.manifest_verified) ?? false,
  };
}

function parseLifecycle(value: Json): LifecycleState {
  const root = jsonObject(value);
  const config = jsonObject(root?.config);
  const restoreRequests = jsonArray(root?.restore_requests).map((value) => {
    const row = jsonObject(value);
    const id = jsonString(row?.id);
    const inspectionId = jsonString(row?.inspection_id);
    if (!id || !inspectionId) return null;
    return {
      id,
      batchId: jsonString(row?.batch_id) || id,
      inspectionId,
      protocol: jsonString(row?.protocol),
      municipality: jsonString(row?.municipality),
      status: jsonString(row?.status) || 'pending',
      reason: jsonString(row?.reason) || '',
      requiresSecondApproval: jsonBoolean(row?.requires_second_approval) ?? false,
      requestedBy: jsonString(row?.requested_by) || '',
      requestedByName: jsonString(row?.requested_by_name) || 'Equipe interna',
      requestedAt: jsonString(row?.requested_at) || new Date(0).toISOString(),
      approvedByName: jsonString(row?.approved_by_name),
      attemptCount: jsonNumber(row?.attempt_count) ?? 0,
      lastError: jsonString(row?.last_error),
      completedAt: jsonString(row?.completed_at),
    } satisfies RestoreRequest;
  }).filter((item): item is RestoreRequest => Boolean(item));
  return {
    config: {
      mode: jsonString(config?.mode) === 'auto' ? 'auto' : 'manual',
      enabled: jsonBoolean(config?.enabled) ?? false,
      daysThreshold: jsonNumber(config?.days_threshold) ?? 7,
    },
    pending: jsonArray(root?.pending).map(parseInspection).filter((item): item is Inspection => Boolean(item)),
    history: jsonArray(root?.history).map(parseInspection).filter((item): item is Inspection => Boolean(item)),
    restoreRequests,
  };
}

export function ArquivamentoPage() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<Set<string>>(new Set());
  const [selectedRestoreIds, setSelectedRestoreIds] = useState<Set<string>>(new Set());
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState<ArchiveConfig | null>(null);
  const [pendingConfig, setPendingConfig] = useState<ArchiveConfig | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<{ request: RestoreRequest; approve: boolean } | null>(null);

  const lifecycle = useQuery({
    queryKey: ['archive-lifecycle', user?.id, profile?.role],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_internal_archive_lifecycle', { p_limit: 250 });
      if (error) throw error;
      return parseLifecycle(data);
    },
  });
  const state = lifecycle.data;
  const config = configDraft ?? state?.config ?? { mode: 'manual', enabled: false, daysThreshold: 7 };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['archive-lifecycle'] });
  const archiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.functions.invoke('archive-lifecycle', {
        body: { vistoria_ids: ids },
      });
      if (error) throw error;
      const root = jsonObject(data);
      if (root?.ok !== true) throw new Error(jsonString(root?.error) || 'O serviço não confirmou o arquivamento.');
      const results = jsonArray(root.results).map(jsonObject).filter(Boolean);
      const archived = results.filter((row) => jsonString(row?.status) === 'drive').length;
      const failed = results.filter((row) => jsonString(row?.status) === 'failed').length;
      if (archived + failed !== ids.length) throw new Error('A resposta do arquivamento não corresponde aos itens solicitados.');
      return { archived, failed };
    },
    onSuccess: async ({ archived, failed }) => {
      setSelectedArchiveIds(new Set());
      await refresh();
      if (failed) toast.error(`${failed} item(ns) falharam; ${archived} foram arquivados.`);
      else toast.success(`${archived} item(ns) arquivados.`);
    },
  });
  const saveConfig = useMutation({
    mutationFn: async ({ next, reason }: { next: ArchiveConfig; reason: string }) => {
      if (!Number.isInteger(next.daysThreshold) || next.daysThreshold < 1 || next.daysThreshold > 365) {
        throw new Error('A retenção deve ser um número inteiro entre 1 e 365 dias.');
      }
      const { error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>)('update_internal_archive_configuration', {
        p_mode: next.mode,
        p_enabled: next.enabled,
        p_days_threshold: next.daysThreshold,
        p_reason: reason,
        p_operation_id: crypto.randomUUID(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setConfigDraft(null);
      setPendingConfig(null);
      setConfigurationOpen(false);
      await refresh();
      toast.success('Política de retenção atualizada.');
    },
  });
  const restoreMutation = useMutation({
    mutationFn: async (reason: string) => {
      const inspectionIds = [...selectedRestoreIds];
      const { data, error } = await supabase.rpc('request_internal_archive_restore', {
        p_inspection_ids: inspectionIds,
        p_reason: reason,
        p_operation_id: crypto.randomUUID(),
      });
      if (error) throw error;
      const result = jsonObject(data);
      const requestIds = jsonArray(result?.request_ids).map((value) => typeof value === 'string' ? value : '').filter(Boolean);
      const needsApproval = jsonBoolean(result?.requires_second_approval);
      const status = jsonString(result?.status);
      if (needsApproval === null || requestIds.length !== inspectionIds.length || status !== (needsApproval ? 'pending' : 'approved')) {
        throw new Error('O servidor não confirmou todos os pedidos de restauração.');
      }
      if (!needsApproval && requestIds[0]) {
        await invokeRestore(requestIds[0]);
      }
      return { needsApproval };
    },
    onSuccess: async ({ needsApproval }) => {
      setSelectedRestoreIds(new Set());
      await refresh();
      toast.success(needsApproval ? 'Lote enviado para aprovação de outro owner.' : 'Restauração concluída.');
    },
  });
  const decisionMutation = useMutation({
    mutationFn: async ({ request, approve, reason }: { request: RestoreRequest; approve: boolean; reason: string }) => {
      const { data, error } = await supabase.rpc('decide_internal_archive_restore', {
        p_request_id: request.id,
        p_approve: approve,
        p_reason: reason,
      });
      if (error) throw error;
      const result = jsonObject(data);
      const requestIds = jsonArray(result?.request_ids)
        .map((value) => typeof value === 'string' ? value : '')
        .filter(Boolean);
      const expectedStatus = approve ? 'approved' : 'rejected';
      if (jsonString(result?.status) !== expectedStatus || !requestIds.length) {
        throw new Error('O servidor não confirmou a decisão do lote.');
      }
      if (approve) {
        for (const requestId of requestIds) await invokeRestore(requestId);
      }
      return { approve };
    },
    onSuccess: async ({ approve }) => {
      setDecisionTarget(null);
      await refresh();
      toast.success(approve ? 'Lote aprovado e restauração executada.' : 'Lote rejeitado e registrado na auditoria.');
    },
  });
  const retryMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await invokeRestore(requestId);
    },
    onSuccess: async () => {
      await refresh();
      toast.success('Nova tentativa concluída.');
    },
  });

  const stats = useMemo(() => ({
    ready: state?.pending.length ?? 0,
    archived: state?.history.filter((item) => item.storageLocation === 'drive').length ?? 0,
    queue: state?.restoreRequests.filter((item) => ['pending', 'approved', 'restoring'].includes(item.status)).length ?? 0,
    failed: state?.restoreRequests.filter((item) => item.status === 'failed').length ?? 0,
  }), [state]);
  const archived = state?.history.filter((item) => item.storageLocation === 'drive') ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Governança de dados"
        title="Arquivamento"
        description={`Retenção no Google Drive após ${config.daysThreshold} dias, com restauração verificada e auditável.`}
        actions={(
          <>
            <Button variant="outline" disabled={lifecycle.isFetching} onClick={() => void lifecycle.refetch()}><RefreshCw className={lifecycle.isFetching ? 'h-4 w-4 animate-spin motion-reduce:animate-none' : 'h-4 w-4'} />{lifecycle.isFetching ? 'Atualizando…' : 'Atualizar'}</Button>
            <Button variant="outline" onClick={() => setConfigurationOpen((open) => !open)}><Settings2 className="h-4 w-4" />Política</Button>
          </>
        )}
      />

      <ArchivePulse stats={stats} />

      {configurationOpen && (
        <Card className="border-primary/15 bg-muted/45 shadow-none">
          <CardHeader><CardTitle>Política de retenção</CardTitle></CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-3">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/85 bg-card p-4">
              <div><Label htmlFor="archive-enabled">Lifecycle ativo</Label><p className="mt-1 text-xs text-muted-foreground">Permite execução programada.</p></div>
              <Switch id="archive-enabled" checked={config.enabled} onCheckedChange={(enabled) => setConfigDraft({ ...config, enabled })} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/85 bg-card p-4">
              <div><Label htmlFor="archive-mode">Modo automático</Label><p className="mt-1 text-xs text-muted-foreground">Cron pode executar o lote elegível.</p></div>
              <Switch id="archive-mode" checked={config.mode === 'auto'} onCheckedChange={(auto) => setConfigDraft({ ...config, mode: auto ? 'auto' : 'manual' })} />
            </div>
            <div className="rounded-2xl border border-border/85 bg-card p-4">
              <Label htmlFor="archive-days">Retenção no Storage (dias)</Label>
              <Input id="archive-days" className="mt-2" type="number" min={1} max={365} value={config.daysThreshold} onChange={(event) => setConfigDraft({ ...config, daysThreshold: Number(event.target.value) })} />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-3">
              <Button onClick={() => setPendingConfig(config)} disabled={saveConfig.isPending || !configDraft || !Number.isInteger(config.daysThreshold) || config.daysThreshold < 1 || config.daysThreshold > 365}>Salvar política</Button>
              <Button variant="ghost" onClick={() => { setConfigDraft(null); setConfigurationOpen(false); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Alert className="border-primary/15 bg-success-soft/55">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Restauração protegida</AlertTitle>
        <AlertDescription>
          Toda solicitação exige MFA e justificativa. Lotes exigem aprovação de outro owner; checksum e tamanho são verificados antes da troca de origem.
        </AlertDescription>
      </Alert>

      {[archiveMutation.error, saveConfig.error, restoreMutation.error, decisionMutation.error, retryMutation.error].find(Boolean) ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive-soft p-4 text-sm text-foreground">
          {mutationMessage([archiveMutation.error, saveConfig.error, restoreMutation.error, decisionMutation.error, retryMutation.error].find(Boolean))}
        </p>
      ) : null}

      <AsyncBoundary
        loading={lifecycle.isLoading}
        error={lifecycle.error}
        onRetry={() => void lifecycle.refetch()}
        empty={false}
      >
        {state && (
          <Tabs defaultValue="archive">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto sm:grid-cols-none">
              <TabsTrigger value="archive">Arquivar ({state.pending.length})</TabsTrigger>
              <TabsTrigger value="restore">Restaurar ({archived.length})</TabsTrigger>
              <TabsTrigger value="queue">Fila ({state.restoreRequests.length})</TabsTrigger>
              <TabsTrigger value="history">Histórico ({state.history.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="archive" className="mt-4">
              <InspectionSection
                title="Elegíveis para retenção"
                description="Selecione as vistorias que podem sair do Storage operacional."
                items={state.pending}
                selected={selectedArchiveIds}
                onToggle={(id) => toggleSet(setSelectedArchiveIds, id)}
                action={<Button disabled={!selectedArchiveIds.size || archiveMutation.isPending} onClick={() => void archiveMutation.mutateAsync([...selectedArchiveIds]).catch(() => undefined)}>{archiveMutation.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Archive />}Arquivar selecionados</Button>}
              />
            </TabsContent>

            <TabsContent value="restore" className="mt-4">
              <InspectionSection
                title="Retidos no Google Drive"
                description="A unidade volta imediatamente; lotes aguardam dupla aprovação."
                items={archived}
                selected={selectedRestoreIds}
                onToggle={(id) => toggleSet(setSelectedRestoreIds, id)}
                action={<Button disabled={!selectedRestoreIds.size} onClick={() => setRestoreDialogOpen(true)}><RotateCcw />Solicitar restauração ({selectedRestoreIds.size})</Button>}
                showManifest
              />
            </TabsContent>

            <TabsContent value="queue" className="mt-4 space-y-3">
              {!state.restoreRequests.length ? <EmptyPanel title="Fila vazia" description="Nenhuma restauração foi solicitada." /> : state.restoreRequests.map((request) => (
                <RestoreRequestCard
                  key={request.id}
                  request={request}
                  currentUserId={user?.id ?? ''}
                  busy={decisionMutation.isPending || retryMutation.isPending}
                  onDecision={(approve) => setDecisionTarget({ request, approve })}
                  onRetry={() => void retryMutation.mutateAsync(request.id).catch(() => undefined)}
                />
              ))}
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-3">
              {!state.history.length ? <EmptyPanel title="Sem histórico" description="Nenhum ciclo foi registrado." /> : state.history.map((inspection) => (
                <InspectionCard key={inspection.id} inspection={inspection} />
              ))}
            </TabsContent>
          </Tabs>
        )}
      </AsyncBoundary>

      <HighAssuranceDialog
        open={Boolean(pendingConfig)}
        onOpenChange={(open) => { if (!open) setPendingConfig(null); }}
        title="Atualizar política de arquivamento"
        impact="A alteração muda quando a retenção programada pode mover dados operacionais. Ela exigirá MFA, justificativa e ficará registrada na auditoria."
        confirmLabel="Salvar política"
        onConfirm={(reason) => {
          if (!pendingConfig) return Promise.resolve();
          return saveConfig.mutateAsync({ next: pendingConfig, reason }).then(() => undefined);
        }}
      />
      <HighAssuranceDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        title={selectedRestoreIds.size > 1 ? 'Solicitar restauração em lote' : 'Restaurar vistoria'}
        impact={selectedRestoreIds.size > 1 ? 'Outro owner precisará aprovar o lote antes da execução.' : 'Os arquivos serão verificados e devolvidos ao Storage operacional.'}
        confirmLabel="Confirmar solicitação"
        onConfirm={async (reason) => { await restoreMutation.mutateAsync(reason); }}
      />
      <HighAssuranceDialog
        open={Boolean(decisionTarget)}
        onOpenChange={(open) => { if (!open) setDecisionTarget(null); }}
        title={decisionTarget?.approve ? 'Aprovar restauração em lote' : 'Rejeitar restauração em lote'}
        impact={decisionTarget?.approve ? 'Você será registrado como segundo owner e a restauração será executada após a aprovação.' : 'O lote não será restaurado e a justificativa ficará registrada na auditoria.'}
        confirmLabel={decisionTarget?.approve ? 'Aprovar e executar' : 'Rejeitar lote'}
        onConfirm={(reason) => {
          if (!decisionTarget) return Promise.resolve();
          return decisionMutation.mutateAsync({ ...decisionTarget, reason }).then(() => undefined);
        }}
      />
    </div>
  );
}

function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
}

function ArchivePulse({ stats }: { stats: { ready: number; archived: number; queue: number; failed: number } }) {
  const metrics = [
    { label: 'Prontos para arquivar', value: stats.ready, icon: Archive, tone: 'bg-info-soft text-info' },
    { label: 'Retidos no Drive', value: stats.archived, icon: HardDrive, tone: 'bg-success-soft text-success' },
    { label: 'Na fila de restauração', value: stats.queue, icon: CloudDownload, tone: 'bg-warning-soft text-warning' },
    { label: 'Restaurações com falha', value: stats.failed, icon: TriangleAlert, tone: 'bg-destructive-soft text-destructive' },
  ];
  return (
    <section className="rounded-2xl border border-border/85 bg-muted/45 p-3 sm:p-4" aria-label="Panorama do arquivamento">
      <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-5 xl:first:pl-2">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.03em]">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InspectionSection({
  title,
  description,
  items,
  selected,
  onToggle,
  action,
  showManifest = false,
}: {
  title: string;
  description: string;
  items: Inspection[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  action: React.ReactNode;
  showManifest?: boolean;
}) {
  return (
    <Card className="bg-muted/35 shadow-none">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div><CardTitle>{title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
        {action}
      </CardHeader>
      <CardContent className="space-y-2">
        {!items.length ? <EmptyPanel title="Nenhum item disponível" description="Não há vistorias neste estado." /> : items.map((inspection) => (
          <div key={inspection.id} className="flex items-start gap-3 rounded-2xl border border-border/85 bg-card p-4">
            <Checkbox checked={selected.has(inspection.id)} onCheckedChange={() => onToggle(inspection.id)} aria-label={`Selecionar ${inspection.protocol || inspection.id}`} className="mt-1" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{inspection.protocol || inspection.id.slice(0, 8)}</p>
                <StatusBadge value={inspection.storageLocation} />
                {showManifest && <StatusBadge value={inspection.manifestVerified ? 'completed' : 'warning'} fallback={inspection.manifestVerified ? 'Manifesto verificado' : 'Arquivo legado'} />}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{inspection.municipality || 'Município não informado'} · {inspection.risk || 'Sem risco'} · {formatDate(inspection.inspectionAt)}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function InspectionCard({ inspection }: { inspection: Inspection }) {
  return (
    <Card className="shadow-none"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{inspection.protocol || inspection.id.slice(0, 8)}</p><StatusBadge value={inspection.storageLocation} /></div>
        <p className="mt-1 text-sm text-muted-foreground">{inspection.municipality || 'Município não informado'} · Arquivado em {formatDate(inspection.archivedAt)}</p>
      </div>
      {inspection.driveFolderUrl && validDriveUrl(inspection.driveFolderUrl) ? (
        <Button asChild variant="ghost" size="sm"><a href={inspection.driveFolderUrl} target="_blank" rel="noopener noreferrer">Abrir Drive<ExternalLink /></a></Button>
      ) : inspection.driveFolderUrl ? <span className="text-xs font-semibold text-foreground">Link do Drive bloqueado</span> : null}
    </CardContent></Card>
  );
}

function RestoreRequestCard({ request, currentUserId, busy, onDecision, onRetry }: { request: RestoreRequest; currentUserId: string; busy: boolean; onDecision: (approve: boolean) => void; onRetry: () => void }) {
  const canApprove = Boolean(currentUserId) && request.status === 'pending' && request.requestedBy !== currentUserId;
  return (
    <Card className="border-primary/10 bg-muted/30 shadow-none"><CardContent className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{request.protocol || request.inspectionId.slice(0, 8)}</p><StatusBadge value={request.status} /></div>
          <p className="mt-1 text-sm text-muted-foreground">{request.municipality || 'Município não informado'} · Solicitado por {request.requestedByName} em {formatDateTime(request.requestedAt)}</p>
          <p className="mt-3 rounded-xl border border-border/80 bg-card px-3 py-2 text-sm">“{request.reason}”</p>
          {request.lastError && <p className="mt-2 text-sm text-destructive" role="alert">{request.lastError}</p>}
          {request.approvedByName && <p className="mt-2 text-xs text-muted-foreground">Aprovado por {request.approvedByName}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {canApprove && <Button size="sm" onClick={() => onDecision(true)} disabled={busy}><CheckCircle2 />Aprovar</Button>}
          {canApprove && <Button size="sm" variant="outline" onClick={() => onDecision(false)} disabled={busy}><XCircle />Rejeitar</Button>}
          {request.status === 'pending' && request.requestedBy === currentUserId && <Button size="sm" variant="outline" disabled><Clock3 />Outro owner</Button>}
          {request.status === 'failed' && <Button size="sm" variant="outline" onClick={onRetry} disabled={busy}><RefreshCw />Tentar novamente</Button>}
          {request.status === 'restoring' && <Button size="sm" variant="outline" disabled><Loader2 className="animate-spin motion-reduce:animate-none" />Restaurando</Button>}
          {request.status === 'restored' && <Button size="sm" variant="outline" disabled><FileCheck2 />Concluído</Button>}
          {request.status === 'rejected' && <Button size="sm" variant="outline" disabled><XCircle />Rejeitado</Button>}
        </div>
      </div>
    </CardContent></Card>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed p-8 text-center"><Archive className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : 'data não informada';
}
function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

async function invokeRestore(requestId: string) {
  const { data, error } = await supabase.functions.invoke('restore-archive', {
    body: { request_id: requestId },
  });
  if (error) throw error;
  const root = jsonObject(data);
  if (root?.ok !== true || jsonString(root.request_id) !== requestId) {
    throw new Error(jsonString(root?.error) || 'O serviço não confirmou a restauração.');
  }
}

function mutationMessage(value: unknown) {
  return value instanceof Error ? value.message : 'A operação não foi concluída. Tente novamente.';
}

function validDriveUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'drive.google.com' && url.pathname.startsWith('/drive/folders/');
  } catch {
    return false;
  }
}
