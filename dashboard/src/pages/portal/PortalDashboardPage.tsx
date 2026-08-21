import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Gauge,
  LockKeyhole,
  RefreshCw,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { PortalOnboardingChecklist } from '@/components/portal/PortalOnboardingChecklist';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalDashboard, portalHome } from '@/lib/portal';
import type { PortalDashboardData } from '@/types/portal';

const metricIcons: Record<string, LucideIcon> = {
  inspections: ClipboardCheck,
  appointments: CalendarDays,
  documents: FileText,
  usage: Gauge,
  team: Users,
  high_risk: AlertTriangle,
};

const roleLabels = {
  master: 'Master',
  admin: 'Administração',
  supervisor: 'Supervisão',
  agent: 'Agente',
} as const;

export function PortalDashboardPage() {
  const { access } = usePortalAuth();
  const authorizationProfile = access
    ? [
        access.membershipStatus ?? 'no-membership',
        access.subscriptionStatus,
        access.planVersionId ?? 'no-plan-version',
        access.creationAllowed ? 'creation-allowed' : 'creation-blocked',
        access.restrictionCause ?? 'no-restriction',
        [...access.permissions].sort().join('|'),
      ].join('::')
    : 'unresolved';
  const query = useQuery({
    queryKey: [
      'portal',
      'dashboard',
      access?.userId,
      access?.accountKind,
      access?.organizationId,
      access?.role ?? 'individual',
      authorizationProfile,
    ],
    queryFn: fetchPortalDashboard,
    enabled: Boolean(access),
  });
  if (!access) return null;
  const root = portalHome(access.accountKind);
  const permissions = new Set(access.permissions);
  const canCreateInspection = access.creationAllowed && permissions.has('inspection.create');
  const isMunicipal = access.accountKind === 'organization';
  const expectedMetrics = isMunicipal && access.role !== 'agent' ? 6 : 4;

  return (
    <div className="page-stack">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground">
            {isMunicipal ? 'Panorama municipal' : 'Seu trabalho'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em]">
            {isMunicipal ? `Operação de ${access.organizationName ?? access.displayName}` : `Olá, ${access.displayName.split(' ')[0]}`}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isMunicipal
              ? 'Acompanhe o que exige coordenação agora: vistorias, compromissos e capacidade da equipe.'
              : 'Veja seus próximos compromissos e retome o trabalho de onde parou.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Contexto do acesso">
            <Badge variant="outline">{access.planName ?? 'Plano não definido'}</Badge>
            {access.role && <Badge variant="secondary">{roleLabels[access.role]}</Badge>}
          </div>
        </div>
        {canCreateInspection && (
          <Button asChild className="shrink-0"><Link to={`${root}/vistorias?nova=1`}>Iniciar nova vistoria <ArrowRight aria-hidden="true" /></Link></Button>
        )}
      </header>

      <PortalOnboardingChecklist />

      {query.isLoading && !query.data && <DashboardSkeleton metricCount={expectedMetrics} />}
      {query.isError && !query.data && <DashboardError onRetry={() => void query.refetch()} retrying={query.isFetching} />}
      {query.isError && query.data && <DashboardRefreshWarning onRetry={() => void query.refetch()} retrying={query.isFetching} />}
      {query.data && (
        <DashboardContent
          data={query.data}
          root={root}
          canReadInspections={permissions.has('inspection.read')}
          canReadAppointments={permissions.has('appointment.read')}
          updateFailed={query.isError}
        />
      )}
    </div>
  );
}

function DashboardContent({
  data,
  root,
  canReadInspections,
  canReadAppointments,
  updateFailed,
}: {
  data: PortalDashboardData;
  root: string;
  canReadInspections: boolean;
  canReadAppointments: boolean;
  updateFailed: boolean;
}) {
  return (
    <>
      <section aria-labelledby="metrics-title">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="metrics-title" className="text-lg font-semibold">Indicadores do seu escopo</h2>
          <p className="text-xs text-muted-foreground">{updateFailed ? 'Últimos dados disponíveis' : 'Dados atualizados pelo portal'}</p>
        </div>
        {data.metrics.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {data.metrics.map((metric) => (
              <MetricCard key={metric.key} icon={metricIcons[metric.key] ?? Gauge} label={metric.label} value={metric.value} detail={metric.detail} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Gauge} title="Indicadores ainda não disponíveis" description="O portal não recebeu métricas para este escopo. Nenhum valor foi estimado." />
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]" aria-label="Próximos itens">
        {canReadInspections ? (
          <RecentInspections inspections={data.recentInspections} root={root} />
        ) : (
          <PermissionState title="Vistorias fora do seu acesso" description="Seu papel atual não inclui a consulta ao módulo de vistorias." />
        )}
        {canReadAppointments ? (
          <UpcomingAppointments appointments={data.upcoming} root={root} />
        ) : (
          <PermissionState title="Agenda fora do seu acesso" description="Seu papel atual não inclui a consulta à agenda." />
        )}
      </section>
    </>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: number; detail?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-primary"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
        <p className="mt-5 text-3xl font-bold tabular-nums">{value.toLocaleString('pt-BR')}</p>
        <p className="mt-1 text-sm font-medium">{label}</p>
        {detail && <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function RecentInspections({ inspections, root }: { inspections: PortalDashboardData['recentInspections']; root: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Atividade recente</p>
          <CardTitle className="mt-2">Vistorias</CardTitle>
        </div>
        <Button asChild variant="ghost" size="sm" className="min-h-11"><Link to={`${root}/vistorias`}>Ver todas</Link></Button>
      </CardHeader>
      <CardContent>
        {inspections.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nenhuma vistoria neste escopo" description="Quando uma vistoria for registrada, ela aparecerá aqui." compact />
        ) : (
          <ul className="divide-y divide-border">
            {inspections.map((inspection) => (
              <li key={inspection.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{inspection.protocol}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(inspection.occurredAt)}</p>
                </div>
                <Badge className="shrink-0">{inspection.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingAppointments({ appointments, root }: { appointments: PortalDashboardData['upcoming']; root: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">A seguir</p>
          <CardTitle className="mt-2">Próximos compromissos</CardTitle>
        </div>
        <Button asChild variant="ghost" size="sm" className="min-h-11"><Link to={`${root}/agenda`}>Abrir agenda</Link></Button>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nenhum compromisso próximo" description="Sua agenda não tem itens futuros neste escopo." compact />
        ) : (
          <ul className="space-y-3">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="rounded-md border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{appointment.title}</p>
                  <Badge variant="outline" className="shrink-0">{appointment.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(appointment.scheduledAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <Card role="alert">
      <CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-destructive-soft text-destructive"><AlertTriangle className="h-5 w-5" aria-hidden="true" /></span>
        <p className="font-semibold">Não foi possível carregar o panorama</p>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">Os dados não foram substituídos por estimativas. Tente buscar novamente.</p>
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying && <RefreshCw className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {retrying ? 'Tentando novamente…' : 'Tentar novamente'}
        </Button>
      </CardContent>
    </Card>
  );
}

function DashboardRefreshWarning({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between" role="status">
      <p><span className="font-semibold">Não foi possível atualizar o panorama. </span>Os dados abaixo são da última atualização disponível e podem estar desatualizados.</p>
      <Button variant="outline" size="sm" className="shrink-0" onClick={onRetry} disabled={retrying}>
        {retrying && <RefreshCw className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {retrying ? 'Tentando novamente…' : 'Tentar novamente'}
      </Button>
    </div>
  );
}

function PermissionState({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
        <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 font-semibold">{title}</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, description, compact = false }: { icon: LucideIcon; title: string; description: string; compact?: boolean }) {
  return (
    <div className={`grid place-items-center rounded-md border border-dashed border-border bg-secondary/40 p-5 text-center ${compact ? 'min-h-32' : 'min-h-40'}`}>
      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function DashboardSkeleton({ metricCount }: { metricCount: number }) {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando panorama">
      <span className="sr-only">Carregando panorama…</span>
      <section aria-hidden="true">
        <div className="mb-3 flex justify-between"><Skeleton className="h-6 w-52 motion-reduce:animate-none" /><Skeleton className="h-4 w-32 motion-reduce:animate-none" /></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: metricCount }, (_, index) => <Skeleton key={index} className="h-[172px] motion-reduce:animate-none" />)}
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]" aria-hidden="true">
        <Skeleton className="h-[300px] motion-reduce:animate-none" />
        <Skeleton className="h-[300px] motion-reduce:animate-none" />
      </section>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleDateString('pt-BR');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Horário não informado' : date.toLocaleString('pt-BR');
}
