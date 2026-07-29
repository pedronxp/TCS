import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Circle,
  Eye,
  FileClock,
  FileText,
  Globe2,
  Info,
  Loader2,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { OrganizationFormDialog } from '@/components/customers/OrganizationFormDialog';
import { CustomerMap } from '@/components/customers/CustomerMap';
import { StatusBadge } from '@/components/domain/Badges';
import { AsyncBoundary, AsyncEmpty, AsyncError, AsyncLoading } from '@/components/states/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/AsyncState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Progress } from '@/components/ui/Progress';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerDetail } from '@/hooks/useCustomerDetail';
import {
  useCreateCustomerAppointment,
  useCustomerOperations,
  useGenerateCustomerLaudo,
} from '@/hooks/useCustomerOperations';
import { supabase } from '@/lib/supabase';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { cn } from '@/lib/utils';
import type { CustomerDetail, CustomerOperations } from '@/types/domain';

const primarySections = [
  ['resumo', 'Resumo'],
  ['assinatura', 'Assinatura'],
  ['consumo', 'Uso do plano'],
  ['usuarios', 'Usuários'],
  ['sessoes', 'Sessões'],
  ['vistorias', 'Vistorias'],
  ['chamados', 'Chamados'],
] as const;

const moreSections = [
  ['implantacao', 'Implantação'],
  ['auditoria', 'Auditoria'],
  ['agendamentos', 'Agendamentos'],
  ['mapa', 'Mapa'],
  ['laudos', 'Laudos'],
  ['relatorios', 'Relatórios'],
] as const;

const sections = [...primarySections, ...moreSections] as const;

export function CustomerDetailPage() {
  const { can } = useAuth();
  const { customerId = '', section = 'resumo' } = useParams();
  const decodedCustomerId = decodeURIComponent(customerId);
  const query = useCustomerDetail(decodedCustomerId);
  const operations = useCustomerOperations(decodedCustomerId);

  if (query.isLoading) return <AsyncLoading label="Carregando cliente…" />;
  if (query.isError) return <AsyncError error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) {
    return (
      <AsyncEmpty
        title="Cliente não encontrado"
        description="O identificador não existe ou seu perfil não possui acesso."
      />
    );
  }

  return (
    <CustomerDetailWorkspace
      detail={query.data}
      customerId={decodedCustomerId}
      section={section}
      operations={operations.data}
      operationsLoading={operations.isLoading}
      operationsError={operations.error}
      canEdit={can('customer.write')}
      onSaved={() => void query.refetch()}
    />
  );
}

export function CustomerDetailWorkspace({
  detail,
  customerId,
  section = 'resumo',
  operations,
  operationsLoading = false,
  operationsError = null,
  canEdit = false,
  onSaved,
}: {
  detail: CustomerDetail;
  customerId: string;
  section?: string;
  operations?: CustomerOperations;
  operationsLoading?: boolean;
  operationsError?: Error | null;
  canEdit?: boolean;
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const customer = detail.customer;
  const activeSection = sections.some(([key]) => key === section) ? section : 'resumo';
  const isMoreSection = moreSections.some(([key]) => key === activeSection);
  const customerBasePath = `/app/clientes/${encodeURIComponent(customerId)}`;

  return (
    <section className="page-stack max-w-[1094px]">
      <form
        id="customer-edit-form"
        className="hidden"
        onSubmit={(event) => {
          event.preventDefault();
          setEditing(true);
        }}
      />

      <div className="space-y-4">
        <nav aria-label="Breadcrumb do cliente" className="text-[11px] font-medium text-muted-foreground">
          <Link to="/app/clientes" className="hover:text-foreground">Clientes</Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <span aria-current="page">{customer.display_name}</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-info-strong">
              {customer.kind === 'organization' ? 'Organização municipal' : 'Cliente individual'}
            </p>
            <h1 className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.025em]">
              {customer.display_name}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {customer.municipality_name || 'Conta individual'}
              {customer.state_code ? ` · ${customer.state_code}` : ''}
              {customer.created_at ? ` · Cliente desde ${formatMonthYear(customer.created_at)}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge value={customer.status} />
            <StatusBadge
              value={detail.subscription?.status ?? null}
              fallback="Sem assinatura"
            />
            {customer.kind === 'organization' && canEdit && (
              <Button variant="outline" className="h-11 min-w-24" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            )}
          </div>
        </div>
      </div>

      {!detail.can_view_sensitive && (
        <div
          role="status"
          className="rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning-foreground"
        >
          <AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" />
          Dados pessoais estão ocultos. Abra um acesso de suporte auditado para visualizá-los.
        </div>
      )}

      <nav
        className="flex min-h-[52px] items-stretch overflow-x-auto rounded-xl border bg-card px-2"
        aria-label="Seções do cliente"
      >
        {primarySections.map(([key, label]) => (
          <CustomerTab
            key={key}
            active={activeSection === key}
            href={`${customerBasePath}/${key}`}
          >
            {label}
          </CustomerTab>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'inline-flex min-h-[50px] shrink-0 items-center gap-1 border-b-2 px-4 text-xs font-medium',
                isMoreSection
                  ? 'border-primary font-bold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              Mais
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {moreSections.map(([key, label]) => (
              <DropdownMenuItem key={key} asChild>
                <Link to={`${customerBasePath}/${key}`} aria-current={activeSection === key ? 'page' : undefined}>
                  {label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <CustomerSection
        section={activeSection}
        detail={detail}
        operations={operations}
        operationsLoading={operationsLoading}
        operationsError={operationsError}
      />

      <OrganizationFormDialog
        open={editing}
        customer={customer.kind === 'organization' ? customer : undefined}
        onboarding={detail.onboarding}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onSaved?.();
        }}
      />
    </section>
  );
}

function CustomerTab({ active, href, children }: { active: boolean; href: string; children: ReactNode }) {
  return (
    <Link
      to={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-[50px] shrink-0 items-center border-b-2 px-4 text-xs font-medium',
        active
          ? 'border-primary font-bold text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}

function CustomerSection({
  section,
  detail,
  operations,
  operationsLoading,
  operationsError,
}: {
  section: string;
  detail: CustomerDetail;
  operations?: CustomerOperations;
  operationsLoading: boolean;
  operationsError: Error | null;
}) {
  if (section === 'resumo') return <Summary detail={detail} />;
  if (section === 'assinatura') return <Subscription detail={detail} />;
  if (section === 'consumo') return <Usage detail={detail} />;
  if (section === 'usuarios') return <Users detail={detail} />;
  if (section === 'sessoes') return <Sessions detail={detail} />;
  if (section === 'vistorias') return <Inspections detail={detail} />;
  if (section === 'chamados') return <Tickets detail={detail} />;
  if (section === 'implantacao') return <Onboarding detail={detail} />;
  if (section === 'auditoria') return <Audit detail={detail} />;

  return (
    <AsyncBoundary
      loading={operationsLoading}
      error={operationsError}
      empty={!operations}
      emptyTitle="Operações indisponíveis"
      emptyDescription="A fonte não retornou dados operacionais para este cliente."
    >
      {operations && section === 'agendamentos' && <Appointments operations={operations} detail={detail} />}
      {operations && section === 'mapa' && <MapSection operations={operations} />}
      {operations && section === 'laudos' && <Documents operations={operations} customerId={detail.customer.customer_id} />}
      {operations && section === 'relatorios' && <Reports operations={operations} />}
    </AsyncBoundary>
  );
}

function Summary({ detail }: { detail: CustomerDetail }) {
  const { customer, subscription } = detail;
  const activeSessions = detail.sessions.filter((item) => item.status === 'active').length;
  const openTickets = detail.tickets.filter((item) => !['resolved', 'closed'].includes(item.status));
  const breachedTickets = openTickets.filter((item) =>
    Boolean(item.response_due_at && new Date(item.response_due_at).getTime() < Date.now()),
  );
  const lastInspectionAt = latestDate(detail.inspections.map((item) => item.occurred_at));
  const usagePercent = highestUsagePercent(detail);
  const health = calculateCustomerHealth(detail);
  const activities = useMemo(() => buildRecentActivity(detail), [detail]);

  return (
    <div className="space-y-6">
      <section className="grid min-h-[210px] gap-8 rounded-2xl border border-info-strong/20 bg-info-soft p-7 md:grid-cols-[1fr_auto] md:items-center">
        <div className="self-start md:self-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-info-strong">
            Visão geral do cliente
          </p>
          <h2 className="mt-4 text-[25px] font-bold leading-8">
            {subscription?.plan_name || 'Cliente sem plano atribuído'}
          </h2>
          <p className="mt-2 max-w-[600px] text-sm leading-5 text-muted-foreground">
            {health.description}
          </p>
        </div>
        <div className="flex min-w-40 flex-col items-center justify-center">
          <div
            className="grid h-[118px] w-[118px] place-items-center rounded-full"
            style={{
              background: `conic-gradient(hsl(var(--chart-1)) ${health.score * 3.6}deg, hsl(var(--card)) 0deg)`,
            }}
            role="img"
            aria-label={`Saúde operacional calculada em ${health.score} de 100`}
          >
            <div className="grid h-[96px] w-[96px] place-items-center rounded-full bg-info-soft text-center">
              <span>
                <strong className="block text-[30px] leading-8">{health.score}</strong>
                <span className="text-[9px] font-bold uppercase text-info-strong">Saúde</span>
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold text-info-strong">{health.label}</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores do cliente">
        <SummaryMetric
          code="V"
          tone="info"
          label="Vistorias recentes"
          value={String(detail.inspections.length)}
          detail={lastInspectionAt ? `Última ${formatRelative(lastInspectionAt)}` : 'Sem atividade recente'}
        />
        <SummaryMetric
          code="S"
          tone="success"
          label="Sessões ativas"
          value={String(activeSessions)}
          detail={`de ${detail.sessions.length} no histórico`}
        />
        <SummaryMetric
          code="C"
          tone="warning"
          label="Chamados abertos"
          value={String(openTickets.length)}
          detail={breachedTickets.length ? `${breachedTickets.length} fora do SLA` : 'Nenhum SLA violado'}
        />
        <SummaryMetric
          code="U"
          tone="neutral"
          label="Uso do plano"
          value={usagePercent === null ? '—' : `${usagePercent}%`}
          detail={usagePercent === null ? 'Sem medição no período' : usagePercent <= 100 ? 'Dentro do contratado' : 'Acima do contratado'}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[336px_minmax(0,430px)_minmax(250px,288px)]">
        <Card className="min-h-[246px] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-[17px]">Conta e plano</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <DefinitionRow label="Tipo de cliente" value={ptBrLabel(customer.kind)} />
              <DefinitionRow label="Plano atual" value={subscription?.plan_name || 'Sem plano'} />
              <DefinitionRow label="Assinatura" value={ptBrLabel(subscription?.status, 'Não atribuída')} />
              <DefinitionRow
                label="Próxima renovação"
                value={subscription?.current_period_end ? formatShortDate(subscription.current_period_end) : 'Não informada'}
                last
              />
            </dl>
          </CardContent>
        </Card>

        <Card className="min-h-[246px] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-[17px]">Atividade recente</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length ? (
              <ol className="space-y-4">
                {activities.map((activity, index) => (
                  <li key={activity.key} className="relative pl-6">
                    {index < activities.length - 1 && (
                      <span className="absolute left-[5px] top-3 h-[calc(100%+1rem)] w-px bg-border" aria-hidden="true" />
                    )}
                    <span
                      className={cn(
                        'absolute left-0 top-1 h-2.5 w-2.5 rounded-full',
                        index === 0 ? 'bg-info-strong' : 'bg-warm',
                      )}
                      aria-hidden="true"
                    />
                    <time className="block text-[10px] font-semibold text-muted-foreground">
                      {formatRelative(activity.at)}
                    </time>
                    <p className="mt-1 text-xs font-medium">{activity.label}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma atividade recente foi retornada.</p>
            )}
          </CardContent>
        </Card>

        <aside className="min-h-[246px] rounded-[14px] bg-ink-panel p-6 text-white">
          <p className="text-[10px] font-bold uppercase text-warm">Contato principal</p>
          <div className="mt-5 flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-warm text-xs font-bold text-warm-foreground">
              {initials(customer.contact_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{customer.contact_name || 'Não informado'}</p>
              <p className="mt-0.5 text-[11px] text-white/65">
                {customer.kind === 'organization' ? 'Contato municipal cadastrado' : 'Contato cadastrado'}
              </p>
            </div>
          </div>
          <div className="my-5 h-px bg-white/10" />
          {detail.can_view_sensitive ? (
            <p className="break-all text-[11px] text-white/80">{customer.contact_email || 'E-mail não informado'}</p>
          ) : (
            <p className="text-[11px] text-white/65">Dados protegidos por permissão</p>
          )}
          <Link
            to={`/app/clientes/${encodeURIComponent(customer.customer_id)}/implantacao`}
            className="mt-7 inline-flex items-center gap-1 text-xs font-semibold text-warm hover:text-white"
          >
            Abrir dados completos
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </aside>
      </section>
    </div>
  );
}

function Subscription({ detail }: { detail: CustomerDetail }) {
  const subscription = detail.subscription;
  if (!subscription) {
    return <AsyncEmpty title="Sem assinatura" description="Este cliente ainda não possui plano atribuído." />;
  }

  return (
    <div className="space-y-5">
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-info-strong">Assinatura atual</p>
            <h2 className="mt-2 text-2xl font-bold">{subscription.plan_name}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {subscriptionStatusDescription(subscription.status)}
            </p>
          </div>
          <StatusBadge value={subscription.status} />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <DefinitionCard title="Ciclo da assinatura">
          <DefinitionRow label="Início da assinatura" value={formatDate(subscription.starts_at)} />
          <DefinitionRow label="Início do período atual" value={formatDate(subscription.current_period_start)} />
          <DefinitionRow
            label="Próxima renovação"
            value={subscription.current_period_end ? formatDate(subscription.current_period_end) : 'Não informada'}
            last
          />
        </DefinitionCard>
        <DefinitionCard title="Condições especiais">
          <DefinitionRow label="Período de teste até" value={subscription.trial_ends_at ? formatDate(subscription.trial_ends_at) : 'Não se aplica'} />
          <DefinitionRow label="Carência até" value={subscription.grace_ends_at ? formatDate(subscription.grace_ends_at) : 'Sem carência ativa'} />
          <DefinitionRow label="Cancelamento" value={subscription.canceled_at ? formatDate(subscription.canceled_at) : 'Não cancelada'} last />
        </DefinitionCard>
      </div>
      <div className="rounded-xl border border-info-strong/20 bg-info-soft p-4 text-sm text-info-strong">
        <Info className="mr-2 inline h-4 w-4" aria-hidden="true" />
        <strong>Como interpretar:</strong> a situação indica se o plano está liberado; o período mostra o ciclo atual.
      </div>
    </div>
  );
}

function Usage({ detail }: { detail: CustomerDetail }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-info-strong/20 bg-info-soft p-5">
        <div className="flex gap-3">
          <span className="rounded-lg bg-info-strong p-2 text-white"><Info className="h-5 w-5" /></span>
          <div>
            <h2 className="font-bold">Uso do plano</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Consumo persistido no período atual comparado aos limites contratados.
            </p>
          </div>
        </div>
      </div>
      {!detail.usage.length ? (
        <AsyncEmpty title="Ainda não há medição de uso" description="Nenhum contador foi criado para este período." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {detail.usage.map((item) => {
            const percent = item.hard_limit && item.hard_limit > 0
              ? Math.round(item.consumed * 100 / item.hard_limit)
              : null;
            return (
              <Card key={`${item.resource_code}-${item.period_start}`} className="shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{resourceLabel(item.resource_code)}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatShortDate(item.period_start)} a {formatShortDate(item.period_end)}
                      </p>
                    </div>
                    <span className="text-sm font-bold">
                      {item.consumed} de {item.hard_limit ?? 'ilimitado'}
                    </span>
                  </div>
                  {percent === null ? (
                    <p className="mt-4 text-xs text-muted-foreground">Uso monitorado, sem limite contratado.</p>
                  ) : (
                    <>
                      <Progress value={Math.min(percent, 100)} className="mt-4" />
                      <p className="mt-2 text-xs text-muted-foreground">{percent}% utilizado</p>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Users({ detail }: { detail: CustomerDetail }) {
  const navigate = useNavigate();
  if (!detail.users.length) {
    return <AsyncEmpty title="Nenhum usuário" description="Não há membros vinculados a este cliente." />;
  }

  return (
    <DataTable headers={['Usuário', 'Papel', 'Status', 'Último acesso', 'Ação']}>
      {detail.users.map((user) => {
        const href = `/app/clientes/${encodeURIComponent(detail.customer.customer_id)}/usuarios/${user.user_id}/resumo`;
        return (
          <tr
            key={user.user_id}
            tabIndex={0}
            onClick={() => navigate(href)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate(href);
              }
            }}
            className="cursor-pointer border-t hover:bg-secondary/60 focus-visible:bg-secondary"
          >
            <td className="p-3">
              <strong>{user.name || 'Sem nome'}</strong>
              <p className="text-xs text-muted-foreground">{user.email || 'E-mail protegido'}</p>
            </td>
            <td className="p-3">{ptBrLabel(user.role, 'Não informado')}</td>
            <td className="p-3"><StatusBadge value={user.status} /></td>
            <td className="p-3">{formatDate(user.last_login)}</td>
            <td className="p-3">
              <Button asChild variant="outline" size="sm">
                <Link to={href} onClick={(event) => event.stopPropagation()}>
                  Ver agente
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}

function Sessions({ detail }: { detail: CustomerDetail }) {
  if (!detail.sessions.length) {
    return <AsyncEmpty title="Nenhuma sessão" description="Este cliente não possui sessões registradas." />;
  }
  return (
    <DataTable headers={['Dispositivo', 'Plataforma', 'Última atividade', 'Situação']}>
      {detail.sessions.map((session) => (
        <tr key={session.id} className="border-t">
          <td className="p-3 font-medium">{session.device_name || session.user_id.slice(0, 8)}</td>
          <td className="p-3">{ptBrLabel(session.platform)}</td>
          <td className="p-3">{formatDate(session.last_heartbeat_at)}</td>
          <td className="p-3"><StatusBadge value={session.status} /></td>
        </tr>
      ))}
    </DataTable>
  );
}

function Inspections({ detail }: { detail: CustomerDetail }) {
  if (!detail.inspections.length) {
    return <AsyncEmpty title="Nenhuma vistoria" description="Não há vistorias recentes vinculadas ao cliente." />;
  }
  const individualAgentName = detail.customer.kind === 'individual' ? detail.users[0]?.name : null;
  return (
    <DataTable headers={['Protocolo', 'Risco', 'Agente/endereço', 'Data', 'Status']}>
      {detail.inspections.map((inspection) => (
        <tr key={inspection.id} className="border-t">
          <td className="p-3 font-mono text-xs">{inspection.protocol || inspection.id.slice(0, 8)}</td>
          <td className="p-3"><StatusBadge value={inspection.risk} /></td>
          <td className="p-3">
            <strong>{inspection.agent_name || individualAgentName || '—'}</strong>
            <p className="text-xs text-muted-foreground">{inspection.address || 'Endereço protegido'}</p>
          </td>
          <td className="p-3">{formatDate(inspection.occurred_at)}</td>
          <td className="p-3"><StatusBadge value={inspection.status} /></td>
        </tr>
      ))}
    </DataTable>
  );
}

function Tickets({ detail }: { detail: CustomerDetail }) {
  if (!detail.tickets.length) {
    return <AsyncEmpty title="Nenhum chamado" description="Este cliente não possui chamados de suporte." />;
  }
  return (
    <DataTable headers={['Chamado', 'Assunto', 'Prioridade', 'SLA', 'Status']}>
      {detail.tickets.map((ticket) => {
        const breached = Boolean(
          ticket.response_due_at
          && new Date(ticket.response_due_at).getTime() < Date.now()
          && !['resolved', 'closed'].includes(ticket.status),
        );
        return (
          <tr key={ticket.id} className="border-t">
            <td className="p-3 font-mono text-xs">{ticket.public_code}</td>
            <td className="p-3 font-medium">{ticket.subject}</td>
            <td className="p-3"><StatusBadge value={ticket.priority} /></td>
            <td className={cn('p-3', breached && 'font-semibold text-destructive')}>
              {breached ? 'Violado' : formatDate(ticket.response_due_at)}
            </td>
            <td className="p-3"><StatusBadge value={ticket.status} /></td>
          </tr>
        );
      })}
    </DataTable>
  );
}

function Onboarding({ detail }: { detail: CustomerDetail }) {
  if (detail.customer.kind === 'individual') {
    return <AsyncEmpty title="Não aplicável" description="Implantação municipal é exibida apenas para organizações." />;
  }
  const onboarding = detail.onboarding;
  if (!onboarding) {
    return <AsyncEmpty title="Implantação não iniciada" description="O registro será criado na primeira atualização do cliente." />;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="shadow-none">
        <CardHeader><CardTitle>Marcos</CardTitle></CardHeader>
        <CardContent>
          <Milestone label="Piloto iniciado" date={onboarding.pilot_started_at} />
          <Milestone label="Coordenação treinada" date={onboarding.coordinator_trained_at} />
          <Milestone label="Revisão prevista" date={onboarding.review_due_at} pending />
          <Milestone label="Revisão concluída" date={onboarding.review_completed_at} />
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader><CardTitle>Checklist</CardTitle></CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-lg bg-ink-panel p-4 text-xs text-white">
            {JSON.stringify(onboarding.checklist, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function Audit({ detail }: { detail: CustomerDetail }) {
  if (!detail.audit.length) {
    return <AsyncEmpty title="Sem eventos" description="Nenhuma alteração auditada foi registrada para este cliente." />;
  }
  return (
    <ol className="space-y-3">
      {detail.audit.map((event) => (
        <li key={`${event.id}-${event.created_at}`}>
          <Card className="shadow-none">
            <CardContent className="flex flex-wrap items-center gap-2 p-4">
              <StatusBadge value={event.event_type} />
              <span className="text-xs text-muted-foreground">
                {event.entity_type}{event.entity_id ? ` · ${event.entity_id.slice(0, 12)}` : ''}
              </span>
              <time className="ml-auto text-xs text-muted-foreground">{formatDate(event.created_at)}</time>
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}

function Appointments({ operations, detail }: { operations: CustomerOperations; detail: CustomerDetail }) {
  const { can } = useAuth();
  const createAppointment = useCreateCustomerAppointment();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [address, setAddress] = useState('');
  const [agentId, setAgentId] = useState('unassigned');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const agents = detail.users.filter(
    (user) => user.role === 'agent' && user.status === 'active',
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const date = new Date(scheduledAt);
    if (!title.trim() || Number.isNaN(date.getTime())) {
      setFormError('Informe um título e uma data válida.');
      return;
    }
    try {
      await createAppointment.mutateAsync({
        customerId: detail.customer.customer_id,
        title: title.trim(),
        scheduledAt: date.toISOString(),
        address,
        agentId: agentId === 'unassigned' ? undefined : agentId,
        notes,
        operationId: crypto.randomUUID(),
      });
      setOpen(false);
      setTitle('');
      setScheduledAt('');
      setAddress('');
      setAgentId('unassigned');
      setNotes('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível criar o agendamento.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Agenda compartilhada</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O que for criado aqui aparece no aplicativo com a identificação “Feito na Web”.
          </p>
        </div>
        {can('customer.write') && (
          <Button onClick={() => setOpen(true)}>
            <CalendarPlus className="h-4 w-4" />
            Novo agendamento
          </Button>
        )}
      </div>

      {!operations.appointments.length ? (
        <AsyncEmpty title="Sem agendamentos" description="Nenhum agendamento está vinculado a este cliente." />
      ) : (
        <DataTable headers={['Agendamento', 'Origem', 'Agente', 'Data', 'Endereço', 'Status']} minWidth={860}>
          {operations.appointments.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="p-3 font-semibold">{item.title}</td>
              <td className="p-3">
                {item.origin === 'web' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-info-strong">
                    <Globe2 className="h-3 w-3" />
                    Web
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Aplicativo</span>
                )}
              </td>
              <td className="p-3">{item.agent_name || '—'}</td>
              <td className="p-3">{formatDate(item.scheduled_at)}</td>
              <td className="p-3">{item.address || 'Dado protegido'}</td>
              <td className="p-3"><StatusBadge value={item.status} /></td>
            </tr>
          ))}
        </DataTable>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Novo agendamento pela web</DialogTitle>
              <DialogDescription>
                A atividade será sincronizada com o aplicativo e identificada pela origem.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appointment-title">Título</Label>
                <Input id="appointment-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="Ex.: Vistoria preventiva" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment-date">Data e hora</Label>
                <Input id="appointment-date" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} min={minimumLocalDateTime()} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment-address">Endereço</Label>
                <Input id="appointment-address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={500} placeholder="Rua, número e bairro" />
              </div>
              {agents.length > 0 && (
                <div className="space-y-2">
                  <Label>Agente responsável</Label>
                  <Select value={agentId} onValueChange={setAgentId}>
                    <SelectTrigger><SelectValue placeholder="Sem agente atribuído" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Sem agente atribuído</SelectItem>
                      {agents.map((agent) => (
                        <SelectItem key={agent.user_id} value={agent.user_id}>
                          {agent.name || agent.email || agent.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="appointment-notes">Observações</Label>
                <Textarea id="appointment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={4} placeholder="Orientações para a equipe de campo" />
              </div>
              {formError && (
                <Alert variant="destructive">
                  <AlertTitle>Agendamento não criado</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createAppointment.isPending}>
                {createAppointment.isPending && <Loader2 className="animate-spin" />}
                Criar e sincronizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MapSection({ operations }: { operations: CustomerOperations }) {
  const located = operations.mapPoints.filter((item) => item.latitude !== null && item.longitude !== null);
  if (!located.length) {
    return <AsyncEmpty title="Mapa indisponível" description="Não há coordenadas autorizadas para este cliente." />;
  }
  return <CustomerMap points={located} />;
}

function Documents({ operations, customerId }: { operations: CustomerOperations; customerId: string }) {
  const generateLaudo = useGenerateCustomerLaudo();
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('Laudo técnico');
  const [busy, setBusy] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState('');
  const availableCount = operations.documents.filter(item => item.document_status === 'available').length;
  const pendingCount = operations.documents.length - availableCount;
  const pendingDocuments = operations.documents.filter(
    item => item.document_status !== 'available' && item.can_generate,
  );

  async function previewDocument(document: CustomerOperations['documents'][number]) {
    setBusy(document.id);
    setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('internal-agent-document', {
      body: {
        customer_id: customerId,
        inspection_id: document.inspection_id,
        kind: 'laudo',
        mode: 'view',
      },
    });
    setBusy('');
    if (invokeError || !data?.signed_url) {
      setError(invokeError?.message || 'Não foi possível autorizar a visualização do laudo.');
      return;
    }
    setPreviewTitle(document.protocol ? `Laudo ${document.protocol}` : 'Laudo técnico');
    setPreviewUrl(data.signed_url);
  }

  async function generateDocument(document: CustomerOperations['documents'][number]) {
    setBusy(document.id);
    setError('');
    try {
      const result = await generateLaudo.mutateAsync({
        customerId,
        inspectionId: document.inspection_id,
        force: document.document_status === 'missing_file',
      });
      setPreviewTitle(document.protocol ? `Laudo ${document.protocol}` : 'Laudo técnico');
      setPreviewUrl(result.signed_url);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Não foi possível gerar o laudo desta vistoria.',
      );
    } finally {
      setBusy('');
    }
  }

  async function generatePendingDocuments() {
    setBulkBusy(true);
    setError('');
    let failures = 0;
    for (const document of pendingDocuments) {
      try {
        await generateLaudo.mutateAsync({
          customerId,
          inspectionId: document.inspection_id,
          force: document.document_status === 'missing_file',
        });
      } catch {
        failures += 1;
      }
    }
    setBulkBusy(false);
    if (failures > 0) {
      setError(`${failures} laudo${failures === 1 ? '' : 's'} permaneceram pendentes. Tente novamente ou consulte os eventos técnicos.`);
    }
  }

  function documentStatus(item: CustomerOperations['documents'][number]) {
    if (item.document_status === 'available') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-strong">
          <CheckCircle2 className="h-4 w-4" />
          Disponível
        </span>
      );
    }
    if (item.document_status === 'missing_file') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Arquivo ausente
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning-foreground">
        <FileClock className="h-4 w-4" />
        Aguardando geração
      </span>
    );
  }

  function documentAction(item: CustomerOperations['documents'][number], fullWidth = false) {
    if (item.downloadable) {
      return (
        <Button
          variant="outline"
          size="sm"
          className={fullWidth ? 'w-full' : undefined}
          disabled={busy === item.id}
          onClick={() => void previewDocument(item)}
        >
          {busy === item.id ? <Loader2 className="animate-spin" /> : <Eye />}
          Visualizar laudo
        </Button>
      );
    }
    return (
      <Button
        variant="outline"
        size="sm"
        className={fullWidth ? 'w-full' : undefined}
        disabled={!item.can_generate || busy === item.id}
        onClick={() => void generateDocument(item)}
      >
        {busy === item.id ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {item.can_generate
          ? item.document_status === 'missing_file' ? 'Gerar novamente' : 'Gerar laudo'
          : 'Requer acesso'}
      </Button>
    );
  }

  if (!operations.documents.length) {
    return <AsyncEmpty title="Sem vistorias concluídas" description="Os laudos aparecerão aqui assim que uma vistoria for concluída." />;
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            Laudos das vistorias concluídas
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Toda vistoria concluída aparece aqui. Arquivos ausentes podem ser gerados novamente com autorização auditada.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-strong">
              {availableCount} disponível{availableCount === 1 ? '' : 'is'}
            </span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning-foreground">
                {pendingCount} pendente{pendingCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {pendingDocuments.length > 0 && (
            <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => void generatePendingDocuments()}>
              {bulkBusy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Gerar pendentes
            </Button>
          )}
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Laudo indisponível</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:hidden">
        {operations.documents.map(item => (
          <Card key={item.id}>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">Protocolo</p>
                  <p className="mt-1 font-semibold">{item.protocol || item.id.slice(0, 8)}</p>
                </div>
                {documentStatus(item)}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Risco</dt>
                  <dd className="mt-1"><StatusBadge value={item.risk} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Vistoria</dt>
                  <dd className="mt-1">{formatDate(item.occurred_at)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Geração do laudo</dt>
                  <dd className="mt-1">{item.generated_at ? formatDate(item.generated_at) : 'Ainda não gerado'}</dd>
                </div>
              </dl>
              {documentAction(item, true)}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="hidden xl:block">
        <DataTable headers={['Protocolo', 'Risco', 'Vistoria', 'Situação do laudo', 'Geração', 'Ação']}>
          {operations.documents.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="p-3 font-mono text-xs">{item.protocol || item.id.slice(0, 8)}</td>
              <td className="p-3"><StatusBadge value={item.risk} /></td>
              <td className="p-3">{formatDate(item.occurred_at)}</td>
              <td className="p-3">{documentStatus(item)}</td>
              <td className="p-3">{item.generated_at ? formatDate(item.generated_at) : 'Ainda não gerado'}</td>
              <td className="p-3">{documentAction(item)}</td>
            </tr>
          ))}
        </DataTable>
      </div>
      <Dialog open={Boolean(previewUrl)} onOpenChange={(value) => !value && setPreviewUrl('')}>
        <DialogContent className="h-[min(88vh,900px)] max-w-5xl grid-rows-[auto_minmax(0,1fr)]">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
            <DialogDescription>
              Visualização protegida. O link expira automaticamente em 60 segundos.
            </DialogDescription>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} title={previewTitle} className="h-full min-h-[520px] w-full rounded-xl border bg-card" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Reports({ operations }: { operations: CustomerOperations }) {
  if (!operations.reports.length) {
    return <AsyncEmpty title="Sem relatórios" description="Nenhum relatório está vinculado ao cliente." />;
  }
  return (
    <DataTable headers={['Protocolo', 'Formulário', 'Versão', 'Pontuação', 'Risco', 'Geração']}>
      {operations.reports.map((item) => (
        <tr key={item.id} className="border-t">
          <td className="p-3 font-mono text-xs">{item.protocol || item.id.slice(0, 8)}</td>
          <td className="p-3">{item.form_id || '—'}</td>
          <td className="p-3">{item.form_version ?? '—'}</td>
          <td className="p-3">{item.score ?? '—'}</td>
          <td className="p-3"><StatusBadge value={item.risk} /></td>
          <td className="p-3">{formatDate(item.generated_at)}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function SummaryMetric({
  code,
  tone,
  label,
  value,
  detail,
}: {
  code: string;
  tone: 'info' | 'success' | 'warning' | 'neutral';
  label: string;
  value: string;
  detail: string;
}) {
  const tones = {
    info: 'bg-info-soft text-info-strong',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    neutral: 'bg-secondary text-primary',
  };
  return (
    <Card className="min-h-[126px] shadow-none">
      <CardContent className="p-[18px]">
        <span className={cn('grid h-9 w-9 place-items-center rounded-[10px] text-[13px] font-bold', tones[tone])} aria-hidden="true">
          {code}
        </span>
        <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-8 gap-y-1">
          <strong className="text-[22px] leading-7">{value}</strong>
          <span className={cn('text-[11px] font-medium', tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : tone === 'info' ? 'text-info-strong' : 'text-muted-foreground')}>
            {detail}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function DefinitionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="shadow-none">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent><dl>{children}</dl></CardContent>
    </Card>
  );
}

function DefinitionRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn('grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 py-3 text-xs', !last && 'border-b')}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function Milestone({ label, date, pending }: { label: string; date: string | null; pending?: boolean }) {
  const Icon = date ? CheckCircle2 : pending ? CalendarClock : Circle;
  return (
    <div className="mb-4 flex items-center gap-3 last:mb-0">
      <Icon className={cn('h-5 w-5', date ? 'text-success' : 'text-muted-foreground/50')} />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
      </div>
    </div>
  );
}

function highestUsagePercent(detail: CustomerDetail) {
  const percentages = detail.usage
    .filter((item) => item.hard_limit !== null && item.hard_limit > 0)
    .map((item) => Math.round(item.consumed * 100 / (item.hard_limit as number)));
  return percentages.length ? Math.max(...percentages) : null;
}

function calculateCustomerHealth(detail: CustomerDetail) {
  const openTickets = detail.tickets.filter((item) => !['resolved', 'closed'].includes(item.status));
  const criticalTickets = openTickets.filter((item) => item.priority === 'critical').length;
  const breachedTickets = openTickets.filter((item) =>
    Boolean(item.response_due_at && new Date(item.response_due_at).getTime() < Date.now()),
  ).length;
  const latestActivity = latestDate([
    detail.customer.last_access_at,
    ...detail.inspections.map((item) => item.occurred_at),
    ...detail.users.map((item) => item.last_login),
  ]);

  let score = 100;
  if (detail.customer.status !== 'active') score -= 25;
  if (!detail.subscription || !['active', 'trial', 'trialing'].includes(detail.subscription.status)) score -= 20;
  score -= Math.min(20, criticalTickets * 10);
  score -= Math.min(20, breachedTickets * 10);
  if (!latestActivity || Date.now() - new Date(latestActivity).getTime() > 30 * 24 * 60 * 60 * 1000) score -= 10;
  score = Math.max(0, score);

  if (score >= 85) {
    return {
      score,
      label: 'Operação estável',
      description: 'A conta, a assinatura, a atividade recente e os chamados não apresentam sinais críticos nos dados disponíveis.',
    };
  }
  if (score >= 60) {
    return {
      score,
      label: 'Operação em atenção',
      description: 'Há condições operacionais que merecem acompanhamento nos dados disponíveis.',
    };
  }
  return {
    score,
    label: 'Operação crítica',
    description: 'Há sinais críticos na conta, na assinatura ou no atendimento que exigem acompanhamento.',
  };
}

function buildRecentActivity(detail: CustomerDetail) {
  const activities: Array<{ key: string; at: string; label: string }> = [];

  detail.inspections.forEach((inspection) => {
    if (!inspection.occurred_at) return;
    activities.push({
      key: `inspection-${inspection.id}`,
      at: inspection.occurred_at,
      label: `Vistoria ${inspection.protocol || inspection.id.slice(0, 8)} registrada${inspection.agent_name ? ` por ${inspection.agent_name}` : ''}`,
    });
  });
  detail.users.forEach((user) => {
    if (!user.last_login) return;
    activities.push({
      key: `user-${user.user_id}`,
      at: user.last_login,
      label: `${user.name || 'Usuário'} acessou a plataforma`,
    });
  });
  detail.tickets.forEach((ticket) => {
    activities.push({
      key: `ticket-${ticket.id}`,
      at: ticket.created_at,
      label: `Chamado ${ticket.public_code} registrado`,
    });
  });

  return activities
    .filter((activity) => Number.isFinite(new Date(activity.at).getTime()))
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .slice(0, 3);
}

function initials(value: string | null) {
  return value
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '—';
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

function minimumLocalDateTime() {
  const date = new Date(Date.now() + 5 * 60_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMonthYear(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatRelative(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Hoje, ${time}`;
  if (isYesterday) return `Ontem, ${time}`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + `, ${time}`;
}

function latestDate(values: Array<string | null | undefined>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function subscriptionStatusDescription(status: string) {
  return ({
    active: 'O plano está ativo e o cliente pode utilizar os recursos contratados.',
    trial: 'O cliente está no período de teste do plano.',
    trialing: 'O cliente está no período de teste do plano.',
    grace: 'O plano está em carência temporária; confira a data limite abaixo.',
    past_due: 'Há uma pendência de pagamento que precisa de acompanhamento.',
    suspended: 'O acesso ao plano está suspenso.',
    canceled: 'A assinatura foi cancelada.',
  } as Record<string, string>)[status] || `Situação atual: ${ptBrLabel(status)}.`;
}

function resourceLabel(code: string) {
  return ({
    users: 'Usuários',
    inspections: 'Vistorias',
    invitations: 'Convites',
    storage_bytes: 'Armazenamento',
    sessions: 'Sessões',
  } as Record<string, string>)[code] || code;
}
