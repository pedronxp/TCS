import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, ClipboardCheck, FileText, Gauge } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalDashboard, portalHome } from '@/lib/portal';

const metricIcons = [ClipboardCheck, CalendarDays, FileText, Gauge];

export function PortalDashboardPage() {
  const { access } = usePortalAuth();
  const query = useQuery({ queryKey: ['portal', 'dashboard', access?.userId], queryFn: fetchPortalDashboard });
  if (!access) return null;
  const root = portalHome(access.accountKind);

  return (
    <div className="page-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Visão geral</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em]">Olá, {access.displayName.split(' ')[0]}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acompanhe as prioridades, a agenda e o consumo da sua operação.</p>
        </div>
        {access.creationAllowed && (
          <Button asChild><Link to={`${root}/vistorias?nova=1`}>Nova vistoria <ArrowRight /></Link></Button>
        )}
      </header>

      {query.isLoading && <DashboardSkeleton />}
      {query.isError && (
        <Card><CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 text-center"><p className="font-semibold">Não foi possível carregar o painel.</p><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></CardContent></Card>
      )}
      {query.data && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
            {query.data.metrics.length > 0 ? query.data.metrics.map((metric, index) => {
              const Icon = metricIcons[index % metricIcons.length];
              return <MetricCard key={metric.key} icon={Icon} label={metric.label} value={metric.value} detail={metric.detail} />;
            }) : (
              <>
                <MetricCard icon={ClipboardCheck} label="Vistorias no período" value={0} />
                <MetricCard icon={CalendarDays} label="Próximos agendamentos" value={0} />
                <MetricCard icon={FileText} label="Documentos disponíveis" value={0} />
                <MetricCard icon={Gauge} label="Uso do plano" value={0} detail="Sem consumo registrado" />
              </>
            )}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Vistorias recentes</CardTitle>
                <Button asChild variant="ghost" size="sm" className="min-h-11"><Link to={`${root}/vistorias`}>Ver todas</Link></Button>
              </CardHeader>
              <CardContent>
                {query.data.recentInspections.length === 0 ? <Empty text="Nenhuma vistoria encontrada neste escopo." /> : (
                  <ul className="divide-y">
                    {query.data.recentInspections.map((inspection) => (
                      <li key={inspection.id} className="flex items-center justify-between gap-4 py-3">
                        <div><p className="text-sm font-semibold">{inspection.protocol}</p><p className="mt-1 text-xs text-muted-foreground">{inspection.occurredAt ? new Date(inspection.occurredAt).toLocaleDateString('pt-BR') : 'Data não informada'}</p></div>
                        <Badge>{inspection.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Próximos compromissos</CardTitle></CardHeader>
              <CardContent>
                {query.data.upcoming.length === 0 ? <Empty text="Sua agenda está livre nos próximos dias." /> : (
                  <ul className="space-y-3">
                    {query.data.upcoming.map((appointment) => (
                      <li key={appointment.id} className="rounded-md border bg-background p-3">
                        <p className="text-sm font-semibold">{appointment.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(appointment.scheduledAt).toLocaleString('pt-BR')}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Gauge; label: string; value: number; detail?: string }) {
  return <Card><CardContent className="p-5"><span className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-primary"><Icon className="h-[18px] w-[18px]" /></span><p className="mt-5 text-3xl font-bold">{value.toLocaleString('pt-BR')}</p><p className="mt-1 text-sm font-medium">{label}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>;
}

function Empty({ text }: { text: string }) {
  return <div className="grid min-h-32 place-items-center rounded-md border border-dashed bg-secondary/40 p-5 text-center text-sm text-muted-foreground">{text}</div>;
}

function DashboardSkeleton() {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-40" />)}</div>;
}
