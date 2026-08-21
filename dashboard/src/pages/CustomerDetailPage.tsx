import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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
  KeyRound,
  LockKeyhole,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  UnlockKeyhole,
  UserPlus,
} from 'lucide-react';
import { OrganizationFormDialog } from '@/components/customers/OrganizationFormDialog';
import { IndividualEditDialog } from '@/components/customers/IndividualEditDialog';
import { CustomerMap } from '@/components/customers/CustomerMap';
import { AccountPermissionBadge, StatusBadge } from '@/components/domain/Badges';
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/Sheet';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { useCustomerDetail } from '@/hooks/useCustomerDetail';
import {
  useCreateCustomerAppointment,
  useCustomerOperations,
} from '@/hooks/useCustomerOperations';
import { useSubscriptionMutation } from '@/hooks/useSubscriptionMutation';
import { supabase } from '@/lib/supabase';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { cn } from '@/lib/utils';
import { customerDetailPath, customerIdFromRoute, type CustomerRouteKind } from '@/lib/customerRoutes';
import { toast } from 'sonner';
import type { CustomerDetail, CustomerOperations, CustomerUsage, CustomerUser } from '@/types/domain';

const individualPrimarySections = [
  ['resumo', 'Resumo'],
  ['assinatura', 'Assinatura'],
  ['consumo', 'Uso do plano'],
  ['sessoes', 'Sessões'],
  ['vistorias', 'Vistorias'],
  ['chamados', 'Chamados'],
] as const;

const organizationPrimarySections = [
  ['resumo', 'Resumo'],
  ['operacao', 'Operação'],
  ['equipe', 'Equipe'],
  ['assinatura', 'Assinatura'],
  ['consumo', 'Uso do plano'],
  ['sessoes', 'Sessões'],
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

function decodeLegacyCustomerId(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

export function CustomerDetailPage({ kind }: { kind?: CustomerRouteKind }) {
  const { can } = useAuth();
  const { customerId = '', recordId = '', section = 'resumo' } = useParams();
  const decodedCustomerId = kind ? customerIdFromRoute(kind, recordId) ?? '' : decodeLegacyCustomerId(customerId);
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
      onRetryOperations={() => void operations.refetch()}
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
  onRetryOperations,
  canEdit = false,
  onSaved,
}: {
  detail: CustomerDetail;
  customerId: string;
  section?: string;
  operations?: CustomerOperations;
  operationsLoading?: boolean;
  operationsError?: Error | null;
  onRetryOperations?: () => void;
  canEdit?: boolean;
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const customer = detail.customer;
  const primarySections = customer.kind === 'organization' ? organizationPrimarySections : individualPrimarySections;
  const requestedSection = section === 'usuarios' && customer.kind === 'organization' ? 'equipe' : section;
  const sections = [...primarySections, ...moreSections] as const;
  const activeSection = sections.some(([key]) => key === requestedSection) ? requestedSection : 'resumo';
  const isMoreSection = moreSections.some(([key]) => key === activeSection);
  const customerBasePath = customerDetailPath(customerId);

  return (
    <section className="page-stack mx-auto w-full max-w-[1240px]">
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
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
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
            {customer.kind === 'individual' && <AccountPermissionBadge role={detail.users[0]?.role} />}
            {canEdit && (
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
          className="rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          <AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" />
          Dados pessoais estão ocultos. Abra um acesso de suporte auditado para visualizá-los.
        </div>
      )}

      <nav
        className="flex min-h-[56px] items-stretch overflow-x-auto rounded-2xl border border-border/70 bg-card/85 px-2 shadow-sm"
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
            <Button
              variant="ghost"
              className={cn(
                'inline-flex min-h-[50px] shrink-0 items-center gap-1 border-b-2 px-4 text-xs font-medium',
                isMoreSection
                  ? 'border-primary font-bold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              Mais
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-52">
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
        onRetryOperations={onRetryOperations}
        onCustomerChanged={onSaved}
        canEdit={canEdit}
        onSaved={onSaved}
      />

      <OrganizationFormDialog
        open={editing && customer.kind === 'organization'}
        customer={customer.kind === 'organization' ? customer : undefined}
        onboarding={detail.onboarding}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onSaved?.();
        }}
      />

      <IndividualEditDialog
        open={editing && customer.kind === 'individual'}
        customer={customer}
        canViewSensitive={detail.can_view_sensitive}
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
  onRetryOperations,
  onCustomerChanged,
  canEdit,
  onSaved,
}: {
  section: string;
  detail: CustomerDetail;
  operations?: CustomerOperations;
  operationsLoading: boolean;
  operationsError: Error | null;
  onRetryOperations?: () => void;
  onCustomerChanged?: () => void;
  canEdit?: boolean;
  onSaved?: () => void;
}) {
  if (section === 'resumo') return <Summary detail={detail} />;
  if (section === 'assinatura') return <Subscription detail={detail} canEdit={canEdit} onSaved={onSaved} />;
  if (section === 'consumo') return <Usage detail={detail} />;
  if (section === 'equipe') return <Team detail={detail} onCustomerChanged={onCustomerChanged} />;
  if (section === 'operacao') return <OperationsOverview detail={detail} />;
  if (section === 'sessoes') return <Sessions detail={detail} />;
  if (section === 'vistorias') return <Inspections detail={detail} />;
  if (section === 'chamados') return <Tickets detail={detail} />;
  if (section === 'implantacao') return <Onboarding detail={detail} />;
  if (section === 'auditoria') return <Audit detail={detail} />;

  return (
    <AsyncBoundary
      loading={operationsLoading}
      error={operationsError}
      onRetry={onRetryOperations}
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
  const lastAccessAt = latestDate([customer.last_access_at, ...detail.users.map((item) => item.last_login)]);
  const latestInspection = [...detail.inspections]
    .filter((item) => item.occurred_at)
    .sort((left, right) => new Date(right.occurred_at ?? 0).getTime() - new Date(left.occurred_at ?? 0).getTime())[0];

  return (
    <div className="space-y-6">
      <section className="surface-muted grid gap-6 p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Visão geral do cliente</p>
            <span className="h-1 w-1 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-medium text-primary">Atualizado com dados operacionais</span>
          </div>
          <h2 className="mt-3 text-[26px] font-bold leading-8 tracking-[-0.025em]">
            {subscription?.plan_name || 'Cliente sem plano atribuído'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{health.description}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Contexto da conta">
            <SummaryFact label="Último acesso" value={lastAccessAt ? formatRelative(lastAccessAt) : 'Sem acesso registrado'} />
            <SummaryFact label="Próxima renovação" value={subscription?.current_period_end ? formatShortDate(subscription.current_period_end) : 'Não informada'} />
            <SummaryFact label={customer.kind === 'organization' ? 'Equipe ativa' : 'Conta ativa'} value={customer.kind === 'organization' ? `${customer.active_users} pessoas` : customer.status === 'active' ? 'Sim' : 'Não'} />
          </div>
        </div>
        <div className="flex min-w-40 flex-col items-center justify-center border-t border-border/60 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div
            className="grid h-[124px] w-[124px] place-items-center rounded-full"
            style={{
              background: `conic-gradient(hsl(var(--chart-1)) ${health.score * 3.6}deg, hsl(var(--card)) 0deg)`,
            }}
            role="img"
            aria-label={`Saúde operacional calculada em ${health.score} de 100`}
          >
            <div className="grid h-[100px] w-[100px] place-items-center rounded-full bg-card text-center">
              <span>
                <strong className="block text-[30px] leading-8">{health.score}</strong>
                <span className="text-[9px] font-bold uppercase text-muted-foreground">Saúde</span>
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold text-primary">{health.label}</p>
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

      <section className="grid gap-5 xl:grid-cols-[minmax(300px,0.9fr)_minmax(360px,1.15fr)_minmax(280px,0.85fr)]">
        <Card className="shadow-none">
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
              />
              <DefinitionRow label="Cliente desde" value={customer.created_at ? formatMonthYear(customer.created_at) : 'Não informado'} />
              <DefinitionRow label="Último acesso" value={lastAccessAt ? formatRelative(lastAccessAt) : 'Sem acesso registrado'} last />
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3"><CardTitle className="text-[17px]">Atividade recente</CardTitle><span className="text-xs text-muted-foreground">{activities.length} evento(s)</span></div>
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
                        index === 0 ? 'bg-primary' : 'bg-muted-foreground',
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

        <aside className="surface-panel flex flex-col gap-4 p-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contato principal</p>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials(customer.contact_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{customer.contact_name || 'Não informado'}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {customer.kind === 'organization' ? 'Contato municipal cadastrado' : 'Contato cadastrado'}
              </p>
            </div>
          </div>
          <div className="h-px bg-border" />
          {detail.can_view_sensitive ? (
            <p className="break-all text-xs text-muted-foreground">{customer.contact_email || 'E-mail não informado'}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Dados protegidos por permissão</p>
          )}
          <Link
            to={customerDetailPath(customer.customer_id, 'implantacao')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
          >
            Abrir dados completos
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <div className="h-px bg-border" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Operação e acesso</p>
            <dl className="mt-3 space-y-2.5 text-xs">
              <SnapshotRow label="Sessões ativas" value={String(activeSessions)} />
              <SnapshotRow label="Política de sessão" value={ptBrLabel(customer.session_policy, 'Não informada')} />
              <SnapshotRow label="Última vistoria" value={latestInspection?.occurred_at ? formatRelative(latestInspection.occurred_at) : 'Nenhuma'} />
              {latestInspection?.risk ? <SnapshotRow label="Risco mais recente" value={latestInspection.risk.toUpperCase()} /> : null}
            </dl>
          </div>
        </aside>
      </section>
    </div>
  );
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/60 bg-card/55 px-3.5 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-semibold">{value}</p></div>;
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium text-foreground">{value}</dd></div>;
}

function Subscription({ detail, canEdit, onSaved }: { detail: CustomerDetail; canEdit?: boolean; onSaved?: () => void }) {
  const subscription = detail.subscription;
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(false);

  if (!subscription) {
    return (
      <>
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">Sem assinatura</p>
          <p className="text-sm text-muted-foreground">Este cliente ainda não possui plano atribuído.</p>
          {canEdit && (
            <Button variant="outline" onClick={() => setAssigning(true)}>
              <Plus className="h-4 w-4" />
              Atribuir plano
            </Button>
          )}
        </div>
        <AssignPlanDialog
          open={assigning}
          customerId={detail.customer.customer_id}
          customerKind={detail.customer.kind}
          onClose={() => setAssigning(false)}
          onSaved={() => { setAssigning(false); onSaved?.(); }}
        />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Assinatura atual</p>
            <h2 className="mt-2 text-2xl font-bold">{subscription.plan_name}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {subscriptionStatusDescription(subscription.status)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3">
            <StatusBadge value={subscription.status} />
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Editar assinatura
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <EditSubscriptionDialog
        open={editing}
        customerId={detail.customer.customer_id}
        customerKind={detail.customer.kind}
        subscription={subscription}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); onSaved?.(); }}
      />
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
      <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
        <Info className="mr-2 inline h-4 w-4" aria-hidden="true" />
        <strong className="text-foreground">Como interpretar:</strong> a situação indica se o plano está liberado; o período mostra o ciclo atual.
      </div>
    </div>
  );
}

function EditSubscriptionDialog({
  open,
  customerId,
  customerKind,
  subscription,
  onClose,
  onSaved,
}: {
  open: boolean;
  customerId: string;
  customerKind: string;
  subscription: CustomerDetail['subscription'];
  onClose: () => void;
  onSaved: () => void;
}) {
  if (!subscription) return null;
  const audience = customerKind === 'organization' ? 'organization' : 'individual';

  const toDateInput = (iso: string | null | undefined) => iso ? iso.slice(0, 10) : '';

  const [planId, setPlanId] = useState(subscription.plan_id);
  const [status, setStatus] = useState(subscription.status);
  const [startsAt, setStartsAt] = useState(toDateInput(subscription.starts_at));
  const [trialEndsAt, setTrialEndsAt] = useState(toDateInput(subscription.trial_ends_at));
  const [periodStart, setPeriodStart] = useState(toDateInput(subscription.current_period_start));
  const [periodEnd, setPeriodEnd] = useState(toDateInput(subscription.current_period_end));
  const [graceEndsAt, setGraceEndsAt] = useState(toDateInput(subscription.grace_ends_at));
  const [overridesText, setOverridesText] = useState(() =>
    subscription.overrides && typeof subscription.overrides === 'object' && Object.keys(subscription.overrides).length
      ? JSON.stringify(subscription.overrides, null, 2)
      : ''
  );
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useSubscriptionMutation();

  const plans = useQuery({
    queryKey: ['commercial-plans-options'],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('plans')
        .select('id,name,audience,status')
        .neq('audience', 'compatibility')
        .neq('status', 'retired')
        .order('name');
      if (err) throw err;
      return data;
    },
    enabled: open,
  });
  const compatiblePlans = (plans.data ?? []).filter((p) => p.audience === audience);

  useEffect(() => {
    if (!open) return;
    setPlanId(subscription.plan_id);
    setStatus(subscription.status);
    setStartsAt(toDateInput(subscription.starts_at));
    setTrialEndsAt(toDateInput(subscription.trial_ends_at));
    setPeriodStart(toDateInput(subscription.current_period_start));
    setPeriodEnd(toDateInput(subscription.current_period_end));
    setGraceEndsAt(toDateInput(subscription.grace_ends_at));
    setOverridesText(
      subscription.overrides && typeof subscription.overrides === 'object' && Object.keys(subscription.overrides).length
        ? JSON.stringify(subscription.overrides, null, 2)
        : ''
    );
    setError(null);
    setConfirming(false);
  }, [open, subscription]);

  function requestSave() {
    if (!planId) { setError('Selecione um plano.'); return; }
    if (!startsAt || !periodStart) { setError('Informe as datas de início.'); return; }
    if (status === 'trial' && !trialEndsAt) { setError('Status trial exige data de término do trial.'); return; }
    if (overridesText.trim()) {
      try { JSON.parse(overridesText); } catch { setError('Overrides deve ser JSON válido.'); return; }
    }
    setError(null);
    setConfirming(true);
  }

  if (!open) return null;

  return (
    <>
      <Dialog open={!confirming} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-w-2xl gap-0 p-0">
          <div className="sticky top-0 z-10 border-b bg-card px-6 py-4">
            <DialogHeader>
              <DialogTitle>Editar assinatura</DialogTitle>
              <DialogDescription className="mt-1">
                Altere plano, status, datas e permissões da assinatura. A operação será auditada.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-6 overflow-y-auto p-6" style={{ maxHeight: '70vh' }}>
            {/* Plano */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Plano</h3>
              <div className="mt-3 space-y-2">
                <Label htmlFor="edit-sub-plan">Plano contratado</Label>
                {plans.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando planos…</p>
                ) : (
                  <Select value={planId} onValueChange={setPlanId}>
                    <SelectTrigger id="edit-sub-plan">
                      <SelectValue placeholder="Selecione o plano" />
                    </SelectTrigger>
                    <SelectContent>
                    {compatiblePlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.status === 'draft' ? ' (rascunho)' : ''}
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </section>

            {/* Status */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Status</h3>
              <div className="mt-3 space-y-2">
                <Label htmlFor="edit-sub-status">Situação da assinatura</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="edit-sub-status">
                    <SelectValue placeholder="Selecione a situação" />
                  </SelectTrigger>
                  <SelectContent>
                  {(['trial', 'active', 'grace', 'past_due', 'suspended', 'canceled', 'expired'] as const).map((s) => (
                    <SelectItem key={s} value={s}>{ptBrLabel(s)}</SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* Datas */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Datas</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-starts-at">Início da assinatura</Label>
                  <Input id="edit-starts-at" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-period-start">Início do período atual</Label>
                  <Input id="edit-period-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-period-end">Próxima renovação</Label>
                  <Input id="edit-period-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
                {(status === 'trial' || trialEndsAt) && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-trial-ends">
                      Fim do trial{status === 'trial' && <span className="ml-0.5 text-destructive">*</span>}
                    </Label>
                    <Input id="edit-trial-ends" type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="edit-grace-ends">Carência até</Label>
                  <Input id="edit-grace-ends" type="date" value={graceEndsAt} onChange={(e) => setGraceEndsAt(e.target.value)} placeholder="Sem carência" />
                </div>
              </div>
            </section>

            {/* Overrides / Permissões do plano */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Permissões e limites (overrides)</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                JSON que sobrepõe os limites padrão do plano. Deixe vazio para usar os limites do plano sem customização.
              </p>
              <div className="mt-3 space-y-2">
                <Label htmlFor="edit-overrides">Overrides (JSON)</Label>
                <Textarea
                  id="edit-overrides"
                  value={overridesText}
                  onChange={(e) => setOverridesText(e.target.value)}
                  placeholder={'{\n  "inspections": 500,\n  "users": 20\n}'}
                  className="font-mono text-xs"
                  rows={6}
                />
              </div>
            </section>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-card px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={requestSave} disabled={mutation.isPending || !planId}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <HighRiskDialog
        open={confirming}
        title="Confirmar edição de assinatura"
        description="A operação exige MFA, justificativa e será registrada na auditoria."
        confirmLabel="Salvar assinatura"
        onClose={() => setConfirming(false)}
        onConfirm={async (reason) => {
          const overrides = overridesText.trim() ? JSON.parse(overridesText) : {};
          const result = await mutation.mutateAsync({
            customerId,
            subscriptionId: subscription.id,
            action: 'update',
            payload: {
              plan_id: planId,
              status,
              starts_at: startsAt ? new Date(startsAt).toISOString() : '',
              trial_ends_at: trialEndsAt ? new Date(trialEndsAt).toISOString() : '',
              current_period_start: periodStart ? new Date(periodStart).toISOString() : '',
              current_period_end: periodEnd ? new Date(periodEnd).toISOString() : '',
              grace_ends_at: graceEndsAt ? new Date(graceEndsAt).toISOString() : '',
              overrides,
            },
            reason,
          });
          if (!result.ok) throw new Error(result.error || 'Não foi possível salvar a assinatura.');
          setConfirming(false);
          onSaved();
        }}
      />
    </>
  );
}

function AssignPlanDialog({
  open,
  customerId,
  customerKind,
  onClose,
  onSaved,
}: {
  open: boolean;
  customerId: string;
  customerKind: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const audience = customerKind === 'organization' ? 'organization' : 'individual';
  const today = new Date().toISOString().slice(0, 10);

  const [planId, setPlanId] = useState('');
  const [status, setStatus] = useState('trial');
  const [startsAt, setStartsAt] = useState(today);
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [periodStart, setPeriodStart] = useState(today);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useSubscriptionMutation();

  const plans = useQuery({
    queryKey: ['commercial-plans-options'],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('plans')
        .select('id,name,audience,status')
        .neq('audience', 'compatibility')
        .neq('status', 'retired')
        .order('name');
      if (err) throw err;
      return data;
    },
    enabled: open,
  });

  const compatiblePlans = (plans.data ?? []).filter((p) => p.audience === audience);

  useEffect(() => {
    if (!open) return;
    setStatus('trial');
    setStartsAt(today);
    setTrialEndsAt('');
    setPeriodStart(today);
    setError(null);
    setConfirming(false);
  }, [open]);

  useEffect(() => {
    if (compatiblePlans.length && !compatiblePlans.some((p) => p.id === planId)) {
      setPlanId(compatiblePlans[0].id);
    }
  }, [compatiblePlans, planId]);

  function requestSave() {
    if (!planId) { setError('Selecione um plano.'); return; }
    if (!startsAt || !periodStart) { setError('Informe as datas de início.'); return; }
    if (status === 'trial' && !trialEndsAt) { setError('Status trial exige data de término do trial.'); return; }
    setError(null);
    setConfirming(true);
  }

  if (!open) return null;

  return (
    <>
      <Dialog open={!confirming} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-w-lg gap-0 p-0">
          <div className="sticky top-0 z-10 border-b bg-card px-6 py-4">
            <DialogHeader>
              <DialogTitle>Atribuir plano</DialogTitle>
              <DialogDescription className="mt-1">
                Crie a assinatura inicial para este cliente. A operação será auditada.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-6 p-6">
            <div className="space-y-2">
              <Label htmlFor="assign-plan">Plano</Label>
              {plans.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando planos…</p>
              ) : compatiblePlans.length === 0 ? (
                <p className="text-sm text-destructive">Nenhum plano disponível para este tipo de cliente.</p>
              ) : (
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger id="assign-plan">
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                  {compatiblePlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.status === 'draft' ? ' (rascunho)' : ''}
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assign-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="assign-status">
                    <SelectValue placeholder="Selecione a situação" />
                  </SelectTrigger>
                  <SelectContent>
                  {(['trial', 'active', 'grace', 'past_due', 'suspended', 'canceled', 'expired'] as const).map((s) => (
                    <SelectItem key={s} value={s}>{ptBrLabel(s)}</SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-starts-at">Início da assinatura</Label>
                <Input id="assign-starts-at" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              {status === 'trial' && (
                <div className="space-y-2">
                  <Label htmlFor="assign-trial-ends">Fim do trial <span className="text-destructive">*</span></Label>
                  <Input id="assign-trial-ends" type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="assign-period-start">Início do período</Label>
                <Input id="assign-period-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-card px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={requestSave} disabled={mutation.isPending || !planId}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
              Criar assinatura
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <HighRiskDialog
        open={confirming}
        title="Confirmar criação de assinatura"
        description="A operação exige MFA, justificativa e será registrada na auditoria."
        confirmLabel="Criar assinatura"
        onClose={() => setConfirming(false)}
        onConfirm={async (reason) => {
          const result = await mutation.mutateAsync({
            customerId,
            subscriptionId: null,
            action: 'create',
            payload: {
              plan_id: planId,
              status,
              starts_at: startsAt ? new Date(startsAt).toISOString() : '',
              trial_ends_at: trialEndsAt ? new Date(trialEndsAt).toISOString() : '',
              current_period_start: periodStart ? new Date(periodStart).toISOString() : '',
              current_period_end: '',
              grace_ends_at: '',
              overrides: {},
            },
            reason,
          });
          if (!result.ok) throw new Error(result.error || 'Não foi possível criar a assinatura.');
          setConfirming(false);
          onSaved();
        }}
      />
    </>
  );
}

function Usage({ detail }: { detail: CustomerDetail }) {
  const today = new Date().toISOString().slice(0, 10);
  const fallbackCounters: CustomerUsage[] = detail.usage.length ? [] : [
    { resource_code: 'users', consumed: detail.users.length, hard_limit: null, warning_percent: null, period_start: today, period_end: today },
    { resource_code: 'sessions', consumed: detail.sessions.length, hard_limit: null, warning_percent: null, period_start: today, period_end: today },
    { resource_code: 'inspections', consumed: detail.inspections.length, hard_limit: null, warning_percent: null, period_start: today, period_end: today },
  ];
  const items = detail.usage.length ? detail.usage : fallbackCounters;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted p-5">
        <div className="flex gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-muted-foreground"><Info className="h-5 w-5" /></span>
          <div>
            <h2 className="font-bold">Uso do plano</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {detail.usage.length
                ? 'Consumo persistido no período atual comparado aos limites contratados.'
                : 'Contadores independentes do plano — refletem o total acumulado da conta.'}
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => {
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
                      {detail.usage.length
                        ? `${formatShortDate(item.period_start)} a ${formatShortDate(item.period_end)}`
                        : 'Total da conta'}
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
    </div>
  );
}

function OperationsOverview({ detail }: { detail: CustomerDetail }) {
  const cards = [
    ['Vistorias recentes', detail.inspections.length, 'Acompanhe atividade e risco no fluxo de vistorias.'],
    ['Chamados em acompanhamento', detail.tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length, 'Priorize solicitações que ainda exigem retorno.'],
    ['Sessões ativas', detail.sessions.filter((session) => session.status === 'active').length, 'Revise dispositivos e atividade vinculados à organização.'],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map(([label, value, description]) => (
        <Card key={label} className="shadow-none">
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Team({ detail, onCustomerChanged }: { detail: CustomerDetail; onCustomerChanged?: () => void }) {
  const { profile } = useAuth();
  const [selected, setSelected] = useState<CustomerUser | null>(null);
  const [linking, setLinking] = useState(false);
  const [params, setParams] = useSearchParams();
  const selectedMemberId = params.get('membro');
  const managedMember = selected ?? detail.users.find((user) => user.user_id === selectedMemberId) ?? null;
  const openMember = (user: CustomerUser) => {
    const next = new URLSearchParams(params);
    next.set('membro', user.user_id);
    setParams(next, { replace: true });
    setSelected(user);
  };
  const closeMember = () => {
    const next = new URLSearchParams(params);
    next.delete('membro');
    setParams(next, { replace: true });
    setSelected(null);
  };
  const canLinkIndividual = profile?.role === 'owner' || profile?.role === 'support';

  return (
    <>
    {canLinkIndividual && <div className="flex justify-end"><Button type="button" variant="outline" onClick={() => setLinking(true)}><UserPlus />Vincular agente existente</Button></div>}
    {detail.users.length ? <DataTable headers={['Membro', 'Papel', 'Status', 'Último acesso', 'Acesso']}>
      {detail.users.map((user) => {
        return (
          <tr
            key={user.user_id}
            tabIndex={0}
            onClick={() => openMember(user)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openMember(user);
              }
            }}
            className="cursor-pointer border-t hover:bg-secondary/60 focus-visible:bg-secondary"
          >
            <td className="p-3">
              <strong>{user.name || 'Sem nome'}</strong>
              <p className="text-xs text-muted-foreground">{user.email || 'E-mail protegido'}</p>
            </td>
            <td className="p-3"><AccountPermissionBadge role={user.role} /></td>
            <td className="p-3"><StatusBadge value={user.status} /></td>
            <td className="p-3">{formatDate(user.last_login)}</td>
            <td className="p-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(event) => { event.stopPropagation(); openMember(user); }}
              >
                Gerenciar membro
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </td>
          </tr>
        );
      })}
    </DataTable> : <AsyncEmpty title="Nenhum membro" description="Não há pessoas vinculadas a esta organização." />}
    <MemberAccessSheet
      customerId={detail.customer.customer_id}
      user={managedMember}
      onOpenChange={(open) => { if (!open) closeMember(); }}
    />
    <LinkExistingAgentDialog open={linking} organizationId={detail.customer.subject_id} onOpenChange={setLinking} onLinked={onCustomerChanged} />
    </>
  );
}

function LinkExistingAgentDialog({ open, organizationId, onOpenChange, onLinked }: {
  open: boolean;
  organizationId: string;
  onOpenChange: (open: boolean) => void;
  onLinked?: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('agent');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc('internal_link_customer_to_organization', {
      p_user_id: userId.trim(),
      p_organization_id: organizationId,
      p_role: role,
    });
    setSaving(false);
    if (error) {
      setMessage('Não foi possível concluir o vínculo. Confira o ID da conta e tente novamente.');
      return;
    }
    toast.success('Agente vinculado à prefeitura e registro auditado.');
    setUserId('');
    onOpenChange(false);
    onLinked?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular agente existente</DialogTitle>
          <DialogDescription>Use o ID da conta individual confirmado pelo suporte. A operação fica registrada na auditoria e não permite buscar pessoas pelo município.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="existing-agent-user-id">ID da conta individual</Label>
            <Input id="existing-agent-user-id" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="UUID do usuário" required />
          </div>
          <div>
            <Label htmlFor="existing-agent-role">Papel municipal</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="existing-agent-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agente</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="master">Master</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {message && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">{message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Vinculando…' : 'Confirmar vínculo'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberAccessSheet({ customerId, user, onOpenChange }: {
  customerId: string;
  user: CustomerUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { can } = useAuth();
  const [password, setPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<'block' | 'unblock' | 'reset_password' | null>(null);
  const mutation = useAdministrativeMutation<{ action: 'block' | 'unblock' | 'reset_password'; reason: string }, unknown>({
    mutationFn: async ({ action, reason }, operationId) => {
      if (!user) throw new Error('Membro não selecionado.');
      const { data, error } = await supabase.rpc('mutate_internal_agent_access', {
        p_customer_id: customerId,
        p_user_id: user.user_id,
        p_action: action,
        p_session_id: null,
        p_new_password: action === 'reset_password' ? password : null,
        p_reason: reason,
        p_operation_id: operationId,
      });
      if (error) throw error;
      return data;
    },
    invalidate: [['internal-customer-detail', customerId]],
  });
  if (!user) return null;
  const passwordValid = password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
  const canManage = can('customer.write');

  async function execute(reason: string) {
    if (!pendingAction) throw new Error('Ação de acesso não selecionada.');
    const result = await mutation.mutateAsync({ action: pendingAction, reason });
    if (!result.ok) throw new Error(result.error);
    toast.success(pendingAction === 'reset_password' ? 'Senha redefinida e sessões encerradas.' : 'Acesso atualizado e auditado.');
    if (pendingAction === 'reset_password') setPassword('');
  }
  const dialogCopy = accessActionCopy(pendingAction);

  return (
    <>
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-8">
          <SheetTitle>{user.name || 'Membro sem nome'}</SheetTitle>
          <SheetDescription>{user.email || 'E-mail protegido'} · Equipe da organização</SheetDescription>
        </SheetHeader>
        <div className="mt-7 space-y-6">
          <section className="rounded-2xl border border-border/80 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identidade e acesso</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><StatusBadge value={user.status} /><AccountPermissionBadge role={user.role} /></div><span className="text-xs text-muted-foreground">Último acesso: {formatDate(user.last_login)}</span></div>
            {canManage && <div className="mt-4">{user.status === 'active' ? <Button variant="outline" onClick={() => setPendingAction('block')} disabled={mutation.isPending}><LockKeyhole />Bloquear acesso</Button> : <Button onClick={() => setPendingAction('unblock')} disabled={mutation.isPending}><UnlockKeyhole />Liberar acesso</Button>}</div>}
          </section>
          {canManage && <section className="rounded-2xl border border-border/85 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credencial temporária</p>
            <Label htmlFor="customer-user-password" className="mt-3 block">Nova senha temporária</Label>
            <Input id="customer-user-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="mt-2" />
            <p className="mt-2 text-xs text-muted-foreground">Mínimo de 12 caracteres, com maiúscula, minúscula e número.</p>
            <p className={cn('mt-2 text-xs', passwordValid ? 'text-success' : 'text-muted-foreground')}>{passwordValid ? '✓ Senha atende à política de segurança' : '• Complete todos os requisitos para continuar'}</p>
            <Button className="mt-4" disabled={!passwordValid || mutation.isPending} onClick={() => setPendingAction('reset_password')}><KeyRound />Redefinir senha</Button>
          </section>}
          <p className="text-xs leading-5 text-muted-foreground">Alterações de papel, acesso e credencial são registradas automaticamente na auditoria do console.</p>
        </div>
        </SheetContent>
      </Sheet>
      <HighRiskDialog
        open={Boolean(pendingAction)}
        title={dialogCopy.title}
        description={dialogCopy.description}
        confirmLabel={dialogCopy.confirmLabel}
        onClose={() => setPendingAction(null)}
        onConfirm={execute}
      />
    </>
  );
}

function accessActionCopy(action: 'block' | 'unblock' | 'reset_password' | null) {
  switch (action) {
    case 'block': return { title: 'Bloquear acesso deste membro?', description: 'O acesso será bloqueado e as sessões ativas serão encerradas. Informe uma justificativa auditável.', confirmLabel: 'Bloquear acesso' };
    case 'unblock': return { title: 'Liberar acesso deste membro?', description: 'A pessoa voltará a acessar o escopo autorizado. Informe uma justificativa auditável.', confirmLabel: 'Liberar acesso' };
    case 'reset_password': return { title: 'Redefinir senha deste membro?', description: 'A credencial será substituída e todas as sessões ativas serão encerradas.', confirmLabel: 'Redefinir senha' };
    default: return { title: 'Confirmar ação', description: 'Revise a operação antes de continuar.', confirmLabel: 'Confirmar' };
  }
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
          <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs text-foreground">
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
              {event.summary && <p className="basis-full text-sm font-medium text-foreground sm:basis-auto">{event.summary}</p>}
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
      toast.success('Agendamento criado', {
        description: 'Ele já está disponível para sincronização no aplicativo.',
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
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-info">
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
                A atividade será identificada como criada na Web e aparecerá no aplicativo como pendente de sincronização.
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
                {createAppointment.isPending && <Loader2 className="animate-spin motion-reduce:animate-none" />}
                Criar agendamento
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
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('Laudo técnico');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [appRequiredDocument, setAppRequiredDocument] = useState<CustomerOperations['documents'][number] | null>(null);
  const availableCount = operations.documents.filter(item => item.document_status === 'available').length;
  const pendingCount = operations.documents.length - availableCount;

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
    const authorizedUrl = validCustomerDocumentUrl(data, 'view');
    if (invokeError || !authorizedUrl) {
      setError(invokeError?.message || 'Não foi possível autorizar a visualização do laudo.');
      return;
    }
    setPreviewTitle(document.protocol ? `Laudo ${document.protocol}` : 'Laudo técnico');
    setPreviewUrl(authorizedUrl);
  }

  function documentStatus(item: CustomerOperations['documents'][number]) {
    if (item.document_status === 'available') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
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
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning">
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
          {busy === item.id ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Eye />}
          Visualizar laudo
        </Button>
      );
    }
    return (
      <Button
        variant="outline"
        size="sm"
        className={fullWidth ? 'w-full' : undefined}
        disabled={busy === item.id}
        onClick={() => setAppRequiredDocument(item)}
      >
        <RefreshCw />
        Gerar no aplicativo
      </Button>
    );
  }

  if (!operations.documents.length) {
    return <AsyncEmpty title="Sem vistorias concluídas" description="Os laudos aparecerão aqui assim que uma vistoria for concluída." />;
  }
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            Laudos das vistorias concluídas
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            O aplicativo gera a versão oficial. A web visualiza e baixa exatamente o arquivo sincronizado.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
              {availableCount} disponível{availableCount === 1 ? '' : 'is'}
            </span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
                {pendingCount} pendente{pendingCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Laudo indisponível</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Dialog open={Boolean(appRequiredDocument)} onOpenChange={(open) => !open && setAppRequiredDocument(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Documento oficial ainda não gerado</DialogTitle>
            <DialogDescription>
              Para manter o padrão institucional, gere primeiro o laudo pelo aplicativo.
              Após o envio e a sincronização, o mesmo arquivo ficará disponível para
              visualização e download neste portal.
            </DialogDescription>
          </DialogHeader>
          {appRequiredDocument?.protocol && (
            <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs">
              Protocolo {appRequiredDocument.protocol}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAppRequiredDocument(null)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            <iframe src={previewUrl} title={previewTitle} className="h-full min-h-[520px] w-full rounded-lg border bg-card" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function validCustomerDocumentUrl(value: unknown, disposition: 'view' | 'download') {
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
    info: 'bg-info-soft text-info',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    neutral: 'bg-secondary text-primary',
  };
  return (
    <Card className="min-h-[126px] shadow-none">
      <CardContent className="p-[18px]">
        <span className={cn('grid h-9 w-9 place-items-center rounded-lg text-[13px] font-bold', tones[tone])} aria-hidden="true">
          {code}
        </span>
        <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-8 gap-y-1">
          <strong className="text-[22px] leading-7">{value}</strong>
          <span className={cn('text-[11px] font-medium', tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : tone === 'info' ? 'text-info' : 'text-muted-foreground')}>
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
