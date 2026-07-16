import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, Circle, Pencil } from 'lucide-react';
import { OrganizationFormDialog } from '@/components/customers/OrganizationFormDialog';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui/AsyncState';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerDetail } from '@/hooks/useCustomerDetail';
import { useCustomerOperations } from '@/hooks/useCustomerOperations';
import { CustomerMap } from '@/components/customers/CustomerMap';
import { DataTable } from '@/components/ui/AsyncState';
import type { CustomerDetail, CustomerOperations } from '@/types/domain';

const sections = [
  ['resumo', 'Resumo'], ['assinatura', 'Assinatura'], ['consumo', 'Consumo'],
  ['usuarios', 'Usuários'], ['sessoes', 'Sessões'], ['vistorias', 'Vistorias'],
  ['chamados', 'Chamados'], ['implantacao', 'Implantação'], ['auditoria', 'Auditoria'],
  ['agendamentos', 'Agendamentos'], ['mapa', 'Mapa'], ['laudos', 'Laudos'], ['relatorios', 'Relatórios'],
] as const;

export function CustomerDetailPage() {
  const [editing, setEditing] = useState(false);
  const { can } = useAuth();
  const { customerId = '', section = 'resumo' } = useParams();
  const decoded = decodeURIComponent(customerId);
  const query = useCustomerDetail(decoded);
  const operations = useCustomerOperations(decoded);
  if (query.isLoading) return <LoadingState label="Carregando cliente…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <EmptyState title="Cliente não encontrado" description="O identificador não existe ou seu perfil não possui acesso." />;
  const detail = query.data;
  const customer = detail.customer;
  const activeSection = sections.some(([key]) => key === section) ? section : 'resumo';

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{customer.kind}</p>
          <h2 className="text-2xl font-bold text-slate-950">{customer.display_name}</h2>
          <p className="mt-1 text-sm text-slate-500">{customer.municipality_name || 'Conta individual'}{customer.state_code ? ` · ${customer.state_code}` : ''}</p>
        </div>
        <div className="flex items-center gap-2"><StatusBadge value={customer.status} /><StatusBadge value={detail.subscription?.status ?? null} />{customer.kind === 'organization' && can('customer.write') && <button onClick={() => setEditing(true)} className="ml-2 flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Pencil className="h-4 w-4" />Editar</button>}</div>
      </div>
      {!detail.can_view_sensitive && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="mr-2 inline h-4 w-4" />Dados pessoais estão ocultos. Abra um acesso de suporte auditado para visualizá-los.</div>}
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b" aria-label="Seções do cliente">
        {sections.map(([key, label]) => <Link key={key} to={`/clientes/${encodeURIComponent(decoded)}/${key}`} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${activeSection === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>{label}</Link>)}
      </nav>
      <CustomerSection section={activeSection} detail={detail} operations={operations.data} operationsLoading={operations.isLoading} operationsError={operations.error} />
      <OrganizationFormDialog open={editing} customer={customer.kind === 'organization' ? customer : undefined} onboarding={detail.onboarding} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void query.refetch(); }} />
    </section>
  );
}

function CustomerSection({ section, detail, operations, operationsLoading, operationsError }: { section: string; detail: CustomerDetail; operations?: CustomerOperations; operationsLoading: boolean; operationsError: Error | null }) {
  if (section === 'resumo') return <Summary detail={detail} />;
  if (section === 'assinatura') return <Subscription detail={detail} />;
  if (section === 'consumo') return <Usage detail={detail} />;
  if (section === 'usuarios') return <Users detail={detail} />;
  if (section === 'sessoes') return <Sessions detail={detail} />;
  if (section === 'vistorias') return <Inspections detail={detail} />;
  if (section === 'chamados') return <Tickets detail={detail} />;
  if (section === 'implantacao') return <Onboarding detail={detail} />;
  if (['agendamentos','mapa','laudos','relatorios'].includes(section)) {
    if (operationsLoading) return <LoadingState label="Carregando operações do cliente…" />;
    if (operationsError || !operations) return <ErrorState error={operationsError} />;
    if (section === 'agendamentos') return <Appointments operations={operations} />;
    if (section === 'mapa') return <MapSection operations={operations} />;
    if (section === 'laudos') return <Documents operations={operations} />;
    return <Reports operations={operations} />;
  }
  return <Audit detail={detail} />;
}

function Summary({ detail }: { detail: CustomerDetail }) {
  const { customer, subscription } = detail;
  return <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card label="Plano" value={subscription?.plan_name || 'Sem plano'} /><Card label="Assinatura" value={subscription?.status || 'Não atribuída'} /><Card label="Usuários" value={String(detail.users.length)} /><Card label="Sessões ativas" value={String(detail.sessions.filter((item) => item.status === 'active').length)} /><Card label="Vistorias recentes" value={String(detail.inspections.length)} /><Card label="Chamados abertos" value={String(detail.tickets.filter((item) => !['resolved', 'closed'].includes(item.status)).length)} /><Card label="Política de sessão" value={customer.session_policy || 'Padrão'} /><Card label="Última atualização" value={formatDate(customer.updated_at)} /></div><div className="grid gap-4 lg:grid-cols-2"><Panel title="Cadastro"><Definition label="Razão social" value={customer.legal_name} /><Definition label="Contato" value={customer.contact_name} /><Definition label="E-mail" value={customer.contact_email} /><Definition label="Contrato" value={customer.contract_reference} /></Panel><Panel title="Saúde operacional"><Definition label="Timeout de sessão" value={customer.session_timeout_minutes ? `${customer.session_timeout_minutes} minutos` : null} /><Definition label="Tolerância offline" value={customer.offline_tolerance_minutes ? `${customer.offline_tolerance_minutes} minutos` : null} /><Definition label="Revisão da implantação" value={formatDate(detail.onboarding?.review_due_at)} /><Definition label="Chamados críticos" value={String(detail.tickets.filter((item) => item.priority === 'critical' && !['resolved', 'closed'].includes(item.status)).length)} /></Panel></div></div>;
}

function Subscription({ detail }: { detail: CustomerDetail }) {
  const subscription = detail.subscription;
  if (!subscription) return <EmptyState title="Sem assinatura" description="Este cliente ainda não possui plano atribuído." />;
  return <Panel title={`${subscription.plan_name} · ${subscription.status}`}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Definition label="Início" value={formatDate(subscription.starts_at)} /><Definition label="Trial até" value={formatDate(subscription.trial_ends_at)} /><Definition label="Período atual" value={`${formatDate(subscription.current_period_start)} — ${formatDate(subscription.current_period_end)}`} /><Definition label="Carência até" value={formatDate(subscription.grace_ends_at)} /></div></Panel>;
}

function Usage({ detail }: { detail: CustomerDetail }) {
  if (!detail.usage.length) return <EmptyState title="Sem consumo registrado" description="Nenhum contador de uso foi criado para o período atual." />;
  return <div className="grid gap-4 lg:grid-cols-2">{detail.usage.map((item) => { const percent = item.hard_limit && item.hard_limit > 0 ? Math.min(100, Math.round(item.consumed * 100 / item.hard_limit)) : 0; return <div key={`${item.resource_code}-${item.period_start}`} className="rounded-xl border bg-white p-5"><div className="flex justify-between"><h3 className="font-semibold">{resourceLabel(item.resource_code)}</h3><span className="text-sm text-slate-500">{item.consumed} / {item.hard_limit ?? 'ilimitado'}</span></div>{item.hard_limit !== null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${percent >= (item.warning_percent ?? 80) ? 'bg-amber-500' : 'bg-blue-600'}`} style={{ width: `${percent}%` }} /></div>}<p className="mt-2 text-xs text-slate-500">{formatDate(item.period_start)} até {formatDate(item.period_end)}</p></div>; })}</div>;
}

function Users({ detail }: { detail: CustomerDetail }) {
  if (!detail.users.length) return <EmptyState title="Nenhum usuário" description="Não há membros vinculados a este cliente." />;
  return <Table headers={['Usuário', 'Papel', 'Status', 'Último acesso']}>{detail.users.map((user) => <tr key={user.user_id} className="border-t"><td className="p-3"><b>{user.name || 'Sem nome'}</b><p className="text-xs text-slate-500">{user.email || 'E-mail protegido'}</p></td><td className="p-3">{user.role || '—'}</td><td className="p-3"><StatusBadge value={user.status} /></td><td className="p-3">{formatDate(user.last_login)}</td></tr>)}</Table>;
}

function Sessions({ detail }: { detail: CustomerDetail }) {
  if (!detail.sessions.length) return <EmptyState title="Nenhuma sessão" description="Este cliente não possui sessões registradas." />;
  return <Table headers={['Dispositivo', 'Plataforma', 'Heartbeat', 'Status']}>{detail.sessions.map((session) => <tr key={session.id} className="border-t"><td className="p-3 font-medium">{session.device_name || session.user_id.slice(0, 8)}</td><td className="p-3">{session.platform}</td><td className="p-3">{formatDate(session.last_heartbeat_at)}</td><td className="p-3"><StatusBadge value={session.status} /></td></tr>)}</Table>;
}

function Inspections({ detail }: { detail: CustomerDetail }) {
  if (!detail.inspections.length) return <EmptyState title="Nenhuma vistoria" description="Não há vistorias recentes vinculadas ao cliente." />;
  return <Table headers={['Protocolo', 'Risco', 'Agente/endereço', 'Data', 'Status']}>{detail.inspections.map((inspection) => <tr key={inspection.id} className="border-t"><td className="p-3 font-mono text-xs">{inspection.protocol || inspection.id.slice(0, 8)}</td><td className="p-3"><StatusBadge value={inspection.risk} /></td><td className="p-3"><b>{inspection.agent_name || '—'}</b><p className="text-xs text-slate-500">{inspection.address || 'Endereço protegido'}</p></td><td className="p-3">{formatDate(inspection.occurred_at)}</td><td className="p-3"><StatusBadge value={inspection.status} /></td></tr>)}</Table>;
}

function Tickets({ detail }: { detail: CustomerDetail }) {
  if (!detail.tickets.length) return <EmptyState title="Nenhum chamado" description="Este cliente não possui chamados de suporte." />;
  return <Table headers={['Chamado', 'Assunto', 'Prioridade', 'SLA', 'Status']}>{detail.tickets.map((ticket) => { const breached = Boolean(ticket.response_due_at && new Date(ticket.response_due_at) < new Date() && !['resolved', 'closed'].includes(ticket.status)); return <tr key={ticket.id} className="border-t"><td className="p-3 font-mono text-xs">{ticket.public_code}</td><td className="p-3 font-medium">{ticket.subject}</td><td className="p-3"><StatusBadge value={ticket.priority} /></td><td className={`p-3 ${breached ? 'font-semibold text-red-600' : ''}`}>{breached ? 'Violado' : formatDate(ticket.response_due_at)}</td><td className="p-3"><StatusBadge value={ticket.status} /></td></tr>; })}</Table>;
}

function Onboarding({ detail }: { detail: CustomerDetail }) {
  if (detail.customer.kind === 'individual') return <EmptyState title="Não aplicável" description="Implantação municipal é exibida apenas para organizações." />;
  const onboarding = detail.onboarding;
  if (!onboarding) return <EmptyState title="Implantação não iniciada" description="O registro será criado na primeira atualização do cliente." />;
  return <div className="grid gap-4 lg:grid-cols-2"><Panel title="Marcos"><Milestone label="Piloto iniciado" date={onboarding.pilot_started_at} /><Milestone label="Coordenação treinada" date={onboarding.coordinator_trained_at} /><Milestone label="Revisão prevista" date={onboarding.review_due_at} pending /><Milestone label="Revisão concluída" date={onboarding.review_completed_at} /></Panel><Panel title="Checklist"><pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(onboarding.checklist, null, 2)}</pre></Panel></div>;
}

function Audit({ detail }: { detail: CustomerDetail }) {
  if (!detail.audit.length) return <EmptyState title="Sem eventos" description="Nenhuma alteração auditada foi registrada para este cliente." />;
  return <div className="space-y-3">{detail.audit.map((event) => <article key={`${event.id}-${event.created_at}`} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap gap-2"><StatusBadge value={event.event_type} /><span className="text-xs text-slate-500">{event.entity_type}{event.entity_id ? ` · ${event.entity_id.slice(0, 12)}` : ''}</span><time className="ml-auto text-xs text-slate-500">{formatDate(event.created_at)}</time></div></article>)}</div>;
}

function Appointments({operations}:{operations:CustomerOperations}){if(!operations.appointments.length)return <EmptyState title="Sem agendamentos" description="Nenhum agendamento está vinculado a este cliente."/>;return <DataTable headers={['Agendamento','Agente','Data','Endereço','Status']}>{operations.appointments.map(item=><tr key={item.id} className="border-t"><td className="p-3 font-semibold">{item.title}</td><td className="p-3">{item.agent_name||'—'}</td><td className="p-3">{formatDate(item.scheduled_at)}</td><td className="p-3">{item.address||'Dado protegido'}</td><td className="p-3"><StatusBadge value={item.status}/></td></tr>)}</DataTable>;}
function MapSection({operations}:{operations:CustomerOperations}){const located=operations.mapPoints.filter(item=>item.latitude!==null&&item.longitude!==null);if(!located.length)return <EmptyState title="Mapa indisponível" description="Não há coordenadas autorizadas para este cliente. Dados sensíveis exigem permissão ou acesso de suporte."/>;return <CustomerMap points={located}/>;}
function Documents({operations}:{operations:CustomerOperations}){if(!operations.documents.length)return <EmptyState title="Sem laudos" description="Nenhum laudo gerado está vinculado ao cliente."/>;return <DataTable headers={['Protocolo','Risco','Geração','Armazenamento','Arquivo']}>{operations.documents.map(item=><tr key={item.id} className="border-t"><td className="p-3 font-mono text-xs">{item.protocol||item.id.slice(0,8)}</td><td className="p-3"><StatusBadge value={item.risk}/></td><td className="p-3">{formatDate(item.generated_at)}</td><td className="p-3">{item.storage_location||'Supabase'}</td><td className="p-3"><a href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-blue-700">Abrir</a></td></tr>)}</DataTable>;}
function Reports({operations}:{operations:CustomerOperations}){if(!operations.reports.length)return <EmptyState title="Sem relatórios" description="Nenhum relatório está vinculado ao cliente."/>;return <DataTable headers={['Protocolo','Formulário','Versão','Pontuação','Risco','Geração']}>{operations.reports.map(item=><tr key={item.id} className="border-t"><td className="p-3 font-mono text-xs">{item.protocol||item.id.slice(0,8)}</td><td className="p-3">{item.form_id||'—'}</td><td className="p-3">{item.form_version??'—'}</td><td className="p-3">{item.score??'—'}</td><td className="p-3"><StatusBadge value={item.risk}/></td><td className="p-3">{formatDate(item.generated_at)}</td></tr>)}</DataTable>;}

function Card({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-lg font-bold text-slate-950">{value}</p></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-xl border bg-white p-5"><h3 className="mb-4 font-bold">{title}</h3>{children}</div>; }
function Definition({ label, value }: { label: string; value: string | null | undefined }) { return <div className="mb-3"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-medium">{value || '—'}</p></div>; }
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{headers.map((header) => <th key={header} className="p-3">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Milestone({ label, date, pending }: { label: string; date: string | null; pending?: boolean }) { const Icon = date ? CheckCircle2 : pending ? CalendarClock : Circle; return <div className="mb-4 flex items-center gap-3"><Icon className={`h-5 w-5 ${date ? 'text-emerald-600' : 'text-slate-300'}`} /><div><p className="text-sm font-medium">{label}</p><p className="text-xs text-slate-500">{formatDate(date)}</p></div></div>; }
function formatDate(value: string | null | undefined) { return value ? new Date(value).toLocaleString('pt-BR') : '—'; }
function resourceLabel(code: string) { return ({ users: 'Usuários', inspections: 'Vistorias', invitations: 'Convites', storage_bytes: 'Armazenamento', sessions: 'Sessões' } as Record<string, string>)[code] || code; }
