import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarDays, Download, FileCheck2, KeyRound, LockKeyhole, LogOut, MapPin, ShieldCheck, UnlockKeyhole } from 'lucide-react';
import { CustomerMap } from '@/components/customers/CustomerMap';
import { PageHeader } from '@/components/domain/PageHeader';
import { CustomerContextBar } from '@/components/domain/CustomerContextBar';
import { MetricCard } from '@/components/domain/MetricCard';
import { RiskBadge, StatusBadge } from '@/components/domain/Badges';
import { DataTableToolbar } from '@/components/data/DataTablePrimitives';
import { EmptyState, ErrorState, LoadingState, DataTable } from '@/components/ui/AsyncState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { useAuth } from '@/contexts/AuthContext';
import { agentKeys, useAgentInspections, useAgentMap, useAgentOperations, useAgentSummary } from '@/hooks/useAgentDetail';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AgentDocument, AgentFilters, AgentInspectionPage, AgentMapResult, AgentOperations, AgentSummary } from '@/types/agent';
import type { CustomerMapPoint } from '@/types/domain';

const sections = [
  ['resumo', 'Visão geral'], ['vistorias', 'Vistorias'], ['mapa', 'Mapa'],
  ['agendamentos', 'Agendamentos'], ['documentos', 'Documentos'], ['acesso', 'Acesso/atividade'],
] as const;
type AgentSection = typeof sections[number][0];
type AccessAction = { action: 'block' | 'unblock' | 'terminate_session' | 'reset_password'; sessionId?: string };

function dateInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function resolveAgentFilters(params: URLSearchParams): AgentFilters {
  const period = params.get('period') || '30';
  const to = params.get('to') || dateInput(new Date(Date.now() + 86_400_000));
  const days = period === '7' ? 7 : period === '90' ? 90 : 30;
  const from = period === 'custom' && params.get('from')
    ? params.get('from')!
    : dateInput(new Date(new Date(to).getTime() - days * 86_400_000));
  return {
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T00:00:00`).toISOString(),
    risk: params.get('risk') || '', status: params.get('status') || '',
    formId: params.get('form') || '', search: params.get('q') || '',
  };
}

export function AgentDetailPage() {
  const { customerId = '', userId = '', userSection } = useParams();
  const decodedCustomerId = decodeURIComponent(customerId);
  const activeSection: AgentSection = sections.some(([key]) => key === userSection) ? userSection as AgentSection : 'resumo';
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => resolveAgentFilters(params), [params]);
  const pageSize = [25, 50, 100].includes(Number(params.get('size'))) ? Number(params.get('size')) : 25;
  const cursorAt = params.get('cursorAt');
  const cursorId = params.get('cursorId');
  const summary = useAgentSummary(decodedCustomerId, userId, filters);
  const inspections = useAgentInspections(decodedCustomerId, userId, filters, cursorAt, cursorId, pageSize, activeSection === 'vistorias');
  const map = useAgentMap(decodedCustomerId, userId, filters, activeSection === 'mapa');
  const operations = useAgentOperations(decodedCustomerId, userId, ['agendamentos', 'documentos', 'acesso'].includes(activeSection));

  function updateFilter(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete('cursorAt'); next.delete('cursorId');
    if (name === 'period' && value !== 'custom') { next.delete('from'); next.delete('to'); }
    setParams(next, { replace: true });
  }

  if (summary.isLoading) return <LoadingState label="Carregando agente…" />;
  if (summary.isError || !summary.data) return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  const data = summary.data;
  const base = `/app/clientes/${encodeURIComponent(decodedCustomerId)}/usuarios/${userId}`;
  return (
    <section className="page-stack">
      <CustomerContextBar
        customerId={decodedCustomerId}
        name={data.agent.customerName}
        detail={data.agent.planName || 'Plano não informado'}
      />
      <PageHeader
        eyebrow={data.agent.customerName}
        title={data.agent.name}
        description={`${ptBrLabel(data.agent.role, 'Papel não informado')} · ${data.agent.planName || 'Plano não informado'} · último acesso ${formatDate(data.agent.lastLogin)}`}
        actions={<><StatusBadge value={data.agent.membershipStatus} /><StatusBadge value={data.agent.effectiveAccess} /></>}
      />
      <Button asChild variant="ghost" size="sm" className="w-fit px-0">
        <Link to={`/app/clientes/${encodeURIComponent(decodedCustomerId)}/usuarios`}><ArrowLeft />Voltar aos usuários</Link>
      </Button>
      {!data.canViewSensitive && (
        <Alert variant="warning" role="status">
          <AlertTriangle className="h-4 w-4" /><AlertTitle>Dados sensíveis protegidos</AlertTitle>
          <AlertDescription>Endereços, coordenadas, contato e downloads exigem acesso de suporte auditado.</AlertDescription>
        </Alert>
      )}
      <AgentFilterBar params={params} onChange={updateFilter} />
      <nav
        className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 sm:flex-nowrap sm:overflow-x-auto"
        aria-label="Módulos do agente"
      >
        {sections.map(([key, label]) => (
          <Link
            key={key}
            to={{ pathname: `${base}/${key}`, search: params.toString() }}
            aria-current={activeSection === key ? 'page' : undefined}
            className={cn(
              'min-h-10 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeSection === key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {activeSection === 'resumo' && <Overview summary={data} />}
      {activeSection === 'vistorias' && <Inspections query={inspections} params={params} setParams={setParams} />}
      {activeSection === 'mapa' && <MapModule query={map} />}
      {activeSection === 'agendamentos' && <OperationsState query={operations}>{(value) => <Appointments operations={value} />}</OperationsState>}
      {activeSection === 'documentos' && <OperationsState query={operations}>{(value) => <Documents customerId={decodedCustomerId} userId={userId} operations={value} />}</OperationsState>}
      {activeSection === 'acesso' && <OperationsState query={operations}>{(value) => <Access customerId={decodedCustomerId} userId={userId} summary={data} operations={value} />}</OperationsState>}
    </section>
  );
}

function AgentFilterBar({ params, onChange }: { params: URLSearchParams; onChange: (name: string, value: string) => void }) {
  const period = params.get('period') || '30';
  return (
    <div
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-6"
      aria-label="Filtros compartilhados do agente"
    >
      <Filter label="Período">
        <select value={period} onChange={(event) => onChange('period', event.target.value)}>
          <option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="custom">Personalizado</option>
        </select>
      </Filter>
      {period === 'custom' && (
        <>
          <Filter label="De"><input type="date" value={params.get('from') || ''} onChange={(event) => onChange('from', event.target.value)} /></Filter>
          <Filter label="Até"><input type="date" value={params.get('to') || ''} onChange={(event) => onChange('to', event.target.value)} /></Filter>
        </>
      )}
      <Filter label="Risco">
        <select value={params.get('risk') || ''} onChange={(event) => onChange('risk', event.target.value)}>
          <option value="">Todos</option>{['r1', 'r2', 'r3', 'r4'].map((risk) => <option key={risk}>{risk}</option>)}
        </select>
      </Filter>
      <Filter label="Status"><input value={params.get('status') || ''} onChange={(event) => onChange('status', event.target.value)} placeholder="Todos" /></Filter>
      <Filter label="Formulário"><input value={params.get('form') || ''} onChange={(event) => onChange('form', event.target.value)} placeholder="Todos" /></Filter>
      <Filter label="Protocolo ou endereço"><input value={params.get('q') || ''} onChange={(event) => onChange('q', event.target.value)} placeholder="Buscar" /></Filter>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <label className="text-xs font-semibold text-muted-foreground">
      <span className="mb-1.5 block">{label}</span>
      <span className="[&>*]:h-10 [&>*]:w-full [&>*]:rounded-lg [&>*]:border [&>*]:border-input [&>*]:bg-background [&>*]:px-3 [&>*]:text-sm [&>*]:outline-none [&>*]:focus:ring-2 [&>*]:focus:ring-ring">{children}</span>
    </label>
  );
}

function Overview({ summary }: { summary: AgentSummary }) {
  const { metrics } = summary;
  const change = metrics.previousInspections === 0 ? null : Math.round((metrics.inspections - metrics.previousInspections) * 100 / metrics.previousInspections);
  const maxDay = Math.max(1, ...summary.activityByDay.map((item) => item.total));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Vistorias" value={metrics.inspections} icon={FileCheck2} trend={change ?? undefined} hint={change === null ? 'Sem base anterior' : 'vs. período anterior'} />
        <MetricCard label="Dias ativos" value={metrics.activeDays} icon={CalendarDays} hint={`Última: ${formatDate(metrics.lastInspectionAt)}`} />
        <MetricCard label="Geolocalizadas" value={`${metrics.geolocatedPercent}%`} icon={MapPin} hint={`${metrics.geolocated} registros`} />
        <MetricCard label="Documentos completos" value={`${metrics.documentCompletePercent}%`} icon={ShieldCheck} hint={`${metrics.documentComplete} vistorias`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Distribuição de risco">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['r1', 'r2', 'r3', 'r4'] as const).map((risk) => (
              <div key={risk} className="rounded-lg bg-muted p-3 text-center">
                <RiskBadge risk={risk.toUpperCase() as 'R1' | 'R2' | 'R3' | 'R4'} />
                <p className="mt-3 text-xl font-bold">{metrics.risks[risk]}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Atividade por dia">
          {!summary.activityByDay.length ? (
            <p className="text-sm text-muted-foreground">Sem atividade no período.</p>
          ) : (
            <div className="flex h-32 items-end gap-1" aria-label="Atividade diária">
              {summary.activityByDay.map((item) => (
                <div
                  key={item.day}
                  className="min-w-2 flex-1 rounded-t bg-primary"
                  style={{ height: `${Math.max(8, item.total * 100 / maxDay)}%` }}
                  title={`${item.day}: ${item.total}`}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Sessão recente">
          <Definition label="Dispositivo" value={summary.lastSession?.deviceName || summary.lastSession?.platform} />
          <Definition label="Última atividade" value={formatDate(summary.lastSession?.lastHeartbeatAt)} />
          <Definition label="Situação" value={ptBrLabel(summary.lastSession?.status)} />
        </Panel>
        <Panel title="Atividade técnica">
          <Definition label="Versão" value={summary.lastTechnicalActivity?.appVersion || 'Não informado'} />
          <Definition label="Plataforma" value={summary.lastTechnicalActivity?.platform || 'Desconhecido'} />
          <Definition label="Último evento" value={formatDate(summary.lastTechnicalActivity?.occurredAt)} />
        </Panel>
      </div>
    </div>
  );
}

function Inspections({ query, params, setParams }: { query: ReturnType<typeof useAgentInspections>; params: URLSearchParams; setParams: ReturnType<typeof useSearchParams>[1] }) {
  if (query.isLoading) return <LoadingState label="Carregando vistorias…" />;
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const page: AgentInspectionPage = query.data;
  if (!page.items.length) return <EmptyState title="Nenhuma vistoria" description="Não há registros para os filtros e a página selecionados." />;
  function next() { if (!page.nextCursor) return; const next = new URLSearchParams(params); next.set('cursorAt', page.nextCursor.occurredAt); next.set('cursorId', page.nextCursor.id); setParams(next); }
  function first() { const next = new URLSearchParams(params); next.delete('cursorAt'); next.delete('cursorId'); setParams(next); }
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <DataTableToolbar
            query={params.get('q') || ''}
            onQueryChange={(value) => {
              const nextParams = new URLSearchParams(params);
              if (value) nextParams.set('q', value); else nextParams.delete('q');
              nextParams.delete('cursorAt'); nextParams.delete('cursorId');
              setParams(nextParams, { replace: true });
            }}
            placeholder="Buscar protocolo ou endereço…"
            filters={(
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Itens
                <select
                  aria-label="Itens por página"
                  value={page.pageSize}
                  onChange={(event) => {
                    const nextParams = new URLSearchParams(params);
                    nextParams.set('size', event.target.value);
                    nextParams.delete('cursorAt'); nextParams.delete('cursorId');
                    setParams(nextParams);
                  }}
                  className="h-9 rounded-lg border border-input bg-background px-2 text-foreground"
                >
                  <option>25</option><option>50</option><option>100</option>
                </select>
              </label>
            )}
          />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{page.total} vistorias no conjunto filtrado</p>
      <DataTable headers={['Protocolo', 'Risco', 'Data', 'Formulário', 'Endereço', 'Documentos']} minWidth={900}>
        {page.items.map((item) => (
          <tr key={item.id} className="border-t">
            <td className="p-3 font-mono text-xs">{item.protocol || item.id.slice(0, 8)}</td>
            <td className="p-3">{item.risk ? <RiskBadge risk={item.risk.toUpperCase() as 'R1' | 'R2' | 'R3' | 'R4'} /> : <StatusBadge value={item.risk} />}</td>
            <td className="p-3">{formatDate(item.occurredAt)}</td>
            <td className="p-3">{item.formId || 'Não informado'}</td>
            <td className="p-3">{item.address || 'Dado protegido'}</td>
            <td className="p-3 text-xs">{Object.entries(item.documents).filter(([, ready]) => ready).map(([kind]) => kind).join(', ') || 'Nenhum'}</td>
          </tr>
        ))}
      </DataTable>
      <div className="flex justify-end gap-2">
        {params.has('cursorAt') && <Button variant="outline" onClick={first}>Primeira página</Button>}
        <Button disabled={!page.nextCursor} onClick={next}>Próxima</Button>
      </div>
    </div>
  );
}

function MapModule({ query }: { query: ReturnType<typeof useAgentMap> }) {
  if (query.isLoading) return <LoadingState label="Carregando mapa…" />;
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data: AgentMapResult = query.data;
  if (!data.canViewSensitive) return <EmptyState title="Coordenadas protegidas" description={`${data.geolocatedTotal} vistorias possuem localização, mas o acesso sensível precisa ser renovado para exibir o mapa.`} />;
  const points: CustomerMapPoint[] = data.points.map((point) => ({ id: point.id, protocol: `${point.count} vistoria${point.count === 1 ? '' : 's'}`, risk: dominantRisk(point.risks), status: 'cluster', occurred_at: point.occurredAt, latitude: point.latitude, longitude: point.longitude, address: null }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-success-soft px-3 py-2 text-primary">{data.geolocatedTotal} com localização</span>
        <span className="rounded-lg bg-warning-soft px-3 py-2 text-warning">{data.withoutCoordinates} sem localização</span>
      </div>
      {points.length ? <CustomerMap points={points} /> : <EmptyState title="Sem pontos no mapa" description="Nenhuma vistoria filtrada possui coordenadas válidas." />}
      <Panel title="Alternativa textual ao mapa">
        <div className="space-y-2">
          {data.points.map((point) => (
            <div key={point.id} className="flex flex-col justify-between gap-1 border-b py-2 text-sm sm:flex-row">
              <span>{point.count} vistoria(s) · risco predominante {dominantRisk(point.risks)}</span>
              <span className="font-mono text-xs text-muted-foreground">{point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function OperationsState({ query, children }: { query: ReturnType<typeof useAgentOperations>; children: (value: AgentOperations) => React.ReactNode }) {
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return children(query.data);
}

function Appointments({ operations }: { operations: AgentOperations }) {
  if (!operations.appointments.length) return <EmptyState title="Sem agendamentos" description="Nenhum agendamento está vinculado ao agente." />;
  return (
    <DataTable headers={['Agendamento', 'Data', 'Endereço', 'Status']}>
      {operations.appointments.map((item) => (
        <tr key={item.id} className="border-t">
          <td className="p-3 font-semibold">{item.title}</td>
          <td className="p-3">{formatDate(item.scheduledAt)}</td>
          <td className="p-3">{item.address || 'Dado protegido'}</td>
          <td className="p-3"><StatusBadge value={item.status} /></td>
        </tr>
      ))}
    </DataTable>
  );
}

function Documents({ customerId, userId, operations }: { customerId: string; userId: string; operations: AgentOperations }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [authorizedDocument, setAuthorizedDocument] = useState<{ documentId: string; url: string } | null>(null);
  async function authorizeDocument(document: AgentDocument) {
    setBusy(document.documentId); setError(null);
    setAuthorizedDocument(null);
    const { data, error: invokeError } = await supabase.functions.invoke('internal-agent-document', { body: { customer_id: customerId, user_id: userId, inspection_id: document.inspectionId, kind: document.kind, mode: 'view' } });
    setBusy(null);
    const url = validAuthorizedDocumentUrl(data, 'view');
    if (invokeError || !url) { setError(invokeError?.message || 'Não foi possível autorizar o documento.'); return; }
    setAuthorizedDocument({ documentId: document.documentId, url });
  }
  if (!operations.documents.length) return <EmptyState title="Sem documentos" description="Nenhum laudo, relatório ou termo foi gerado." />;
  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertTitle>Documento indisponível</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <DataTable headers={['Documento', 'Protocolo', 'Geração', 'Armazenamento', 'Ação']}>
        {operations.documents.map((item) => (
          <tr key={item.documentId} className="border-t">
            <td className="p-3 font-semibold capitalize">{item.kind}</td>
            <td className="p-3 font-mono text-xs">{item.protocol || item.inspectionId.slice(0, 8)}</td>
            <td className="p-3">{formatDate(item.generatedAt)}</td>
            <td className="p-3">{item.storageLocation || 'Não informado'}</td>
            <td className="p-3">
              {authorizedDocument?.documentId === item.documentId ? (
                <Button asChild variant="outline" size="sm">
                  <a href={authorizedDocument.url} target="_blank" rel="noopener noreferrer"><Download />Abrir link autorizado</a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled={!item.downloadable || busy === item.documentId} onClick={() => void authorizeDocument(item)}>
                  <Download />{busy === item.documentId ? 'Autorizando…' : item.downloadable ? 'Autorizar por 60s' : 'Indisponível'}
                </Button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

function Access({ customerId, userId, summary, operations }: { customerId: string; userId: string; summary: AgentSummary; operations: AgentOperations }) {
  const { can } = useAuth();
  const [password, setPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<AccessAction | null>(null);
  const mutation = useAdministrativeMutation<AccessAction & { reason: string }, unknown>({
    mutationFn: async (input, operationId) => {
      const { data, error } = await supabase.rpc('mutate_internal_agent_access', {
        p_customer_id: customerId, p_user_id: userId, p_action: input.action,
        p_session_id: input.sessionId || null, p_new_password: input.action === 'reset_password' ? password : null,
        p_reason: input.reason, p_operation_id: operationId,
      });
      if (error) throw error;
      return data;
    },
    invalidate: [agentKeys.root(customerId, userId)],
  });
  const ownerActions = can('customer.write');
  const passwordPolicy = {
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const validPassword = Object.values(passwordPolicy).every(Boolean);

  async function runAction(reason: string) {
    if (!pendingAction) throw new Error('Ação de acesso não selecionada.');
    const result = await mutation.mutateAsync({ ...pendingAction, reason });
    if (!result.ok) throw new Error(result.error);
    toast.success(pendingAction.action === 'reset_password' ? 'Senha redefinida e sessões encerradas.' : 'Acesso atualizado e registrado na auditoria.');
    if (pendingAction.action === 'reset_password') setPassword('');
  }
  const dialogCopy = accessActionCopy(pendingAction);
  return (
    <div className="space-y-4">
      <Panel title="Acesso efetivo">
        <Definition label="Situação" value={ptBrLabel(summary.agent.effectiveAccess)} />
        <Definition label="Vínculo" value={ptBrLabel(summary.agent.membershipStatus)} />
        <Definition label="Contato" value={summary.agent.email || 'Dado protegido'} />
        {ownerActions && (
          <div className="mt-4 flex flex-wrap gap-2">
            {summary.agent.effectiveAccess === 'active'
              ? <Action icon={<LockKeyhole className="h-4 w-4" />} label="Bloquear acesso" onClick={() => setPendingAction({ action: 'block' })} />
              : <Action icon={<UnlockKeyhole className="h-4 w-4" />} label="Liberar acesso" onClick={() => setPendingAction({ action: 'unblock' })} />}
            <div className="min-w-64 flex-1 rounded-lg border border-border bg-muted/30 p-3">
              <label className="block">
                <span className="text-xs font-semibold text-foreground">Nova senha</span>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Defina uma senha temporária" autoComplete="new-password" className="mt-2" />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">Mínimo de 12 caracteres, com maiúscula, minúscula e número.</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-live="polite">
                <span className={passwordPolicy.length ? 'text-success' : undefined}>{passwordPolicy.length ? '✓' : '•'} 12 caracteres</span>
                <span className={passwordPolicy.upper ? 'text-success' : undefined}>{passwordPolicy.upper ? '✓' : '•'} Maiúscula</span>
                <span className={passwordPolicy.lower ? 'text-success' : undefined}>{passwordPolicy.lower ? '✓' : '•'} Minúscula</span>
                <span className={passwordPolicy.number ? 'text-success' : undefined}>{passwordPolicy.number ? '✓' : '•'} Número</span>
              </div>
              <div className="mt-3"><Action disabled={!validPassword || mutation.isPending} icon={<KeyRound className="h-4 w-4" />} label={mutation.isPending ? 'Salvando...' : 'Redefinir senha'} onClick={() => setPendingAction({ action: 'reset_password' })} /></div>
            </div>
          </div>
        )}
      </Panel>
      <Panel title="Sessões e dispositivos">
        {!operations.sessions.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>
        ) : (
          <div className="space-y-3">
            {operations.sessions.map((session) => (
              <div key={session.id} className="flex flex-wrap items-center gap-3 border-b pb-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{session.deviceName || session.platform}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(session.lastHeartbeatAt)}</p>
                </div>
                <StatusBadge value={session.status} />
                {ownerActions && session.status === 'active' && <Action icon={<LogOut className="h-4 w-4" />} label="Encerrar" onClick={() => setPendingAction({ action: 'terminate_session', sessionId: session.id })} />}
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Atividade técnica permitida">
        {!operations.technicalActivity.length ? (
          <p className="text-sm text-muted-foreground">Não informado.</p>
        ) : (
          <div className="space-y-2">
            {operations.technicalActivity.map((event) => (
              <div key={`${event.id}-${event.occurredAt}`} className="flex flex-wrap gap-2 border-b py-2 text-sm">
                <StatusBadge value={event.severity} />
                <span>{event.category} · {event.summary || 'Evento técnico'}</span>
                <time className="ml-auto text-xs text-muted-foreground">{formatDate(event.occurredAt)}</time>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <HighRiskDialog
        open={Boolean(pendingAction)}
        title={dialogCopy.title}
        description={dialogCopy.description}
        confirmLabel={dialogCopy.confirmLabel}
        onClose={() => setPendingAction(null)}
        onConfirm={runAction}
      />
    </div>
  );
}

function validAuthorizedDocumentUrl(value: unknown, disposition: 'view' | 'download') {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { ok?: unknown; signed_url?: unknown; disposition?: unknown; expires_in?: unknown };
  if (candidate.ok !== true || candidate.disposition !== disposition || typeof candidate.signed_url !== 'string') return null;
  if (typeof candidate.expires_in !== 'number' || !Number.isFinite(candidate.expires_in) || candidate.expires_in < 1 || candidate.expires_in > 60) return null;
  try {
    const url = new URL(candidate.signed_url);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function accessActionCopy(action: AccessAction | null) {
  switch (action?.action) {
    case 'block': return { title: 'Bloquear acesso do agente?', description: 'O agente perderá acesso e as sessões ativas serão encerradas. A justificativa ficará na auditoria.', confirmLabel: 'Bloquear acesso' };
    case 'unblock': return { title: 'Liberar acesso do agente?', description: 'O agente voltará a acessar o escopo autorizado. Registre por que a liberação é necessária.', confirmLabel: 'Liberar acesso' };
    case 'reset_password': return { title: 'Redefinir senha do agente?', description: 'A senha será substituída e todas as sessões ativas serão encerradas.', confirmLabel: 'Redefinir senha' };
    case 'terminate_session': return { title: 'Encerrar esta sessão?', description: 'O registro selecionado será encerrado. Tokens de acesso já emitidos podem permanecer válidos até expirar.', confirmLabel: 'Encerrar sessão' };
    default: return { title: 'Confirmar ação', description: 'Revise a operação antes de continuar.', confirmLabel: 'Confirmar' };
  }
}

function Action({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <Button type="button" variant="outline" disabled={disabled} onClick={onClick}>{icon}{label}</Button>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Definition({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value || 'Não informado'}</p>
    </div>
  );
}

function formatDate(value: string | null | undefined) { return value ? new Date(value).toLocaleString('pt-BR') : 'Não informado'; }
function dominantRisk(risks: Record<'r1' | 'r2' | 'r3' | 'r4', number>) { return (Object.entries(risks) as [keyof typeof risks, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] || 'r1'; }
