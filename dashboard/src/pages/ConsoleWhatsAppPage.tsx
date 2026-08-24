import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bot, Building2, ChevronRight, CircleAlert, MessageCircleMore, Smartphone, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { fetchOrgsComunicadosConsole, type BotRuntimeState } from '@/lib/comunicados';

const runtimeBadges: Record<BotRuntimeState, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' | 'secondary' | 'info' }> = {
  online: { label: 'Online', variant: 'success' },
  degraded: { label: 'Operação parcial', variant: 'warning' },
  reconnecting: { label: 'Reconectando', variant: 'warning' },
  awaiting_qr: { label: 'Aguardando QR', variant: 'info' },
  paused: { label: 'Pausado', variant: 'secondary' },
  offline: { label: 'Fora do ar', variant: 'destructive' },
  service_offline: { label: 'Docker fora do ar', variant: 'destructive' },
  unconfigured: { label: 'Sem número', variant: 'outline' },
  banned: { label: 'Número banido', variant: 'destructive' },
};

export function ConsoleWhatsAppPage() {
  const navigate = useNavigate();
  const organizationsQuery = useQuery({
    queryKey: ['console', 'comunicados', 'orgs'],
    queryFn: fetchOrgsComunicadosConsole,
  });
  const organizations = organizationsQuery.data ?? [];
  const connected = organizations.filter((item) => item.runtime && ['online', 'degraded'].includes(item.runtime.state)).length;
  const needsAttention = organizations.filter((item) => item.enviosFalhas > 0 || !item.runtime || !['online'].includes(item.runtime.state)).length;
  const communities = organizations.reduce((total, item) => total + item.comunidadesAtivas, 0);

  return (
    <div className="page-stack">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Suporte · Organizações</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold"><MessageCircleMore className="h-8 w-8 text-success" />WhatsApp Bot</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Acompanhe a conexão dos números e encontre rapidamente organizações que precisam de configuração ou suporte.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo das organizações no WhatsApp">
        <Summary label="Organizações online" value={connected} icon={Smartphone} />
        <Summary label="Comunidades ativas" value={communities} icon={Users} />
        <Summary label="Precisam de atenção" value={needsAttention} icon={CircleAlert} warning={needsAttention > 0} />
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 />Organizações</CardTitle></CardHeader>
        <CardContent>
          {organizationsQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando organizações…</p>}
          {organizationsQuery.isError && <div className="space-y-3 text-sm text-destructive" role="alert"><p>Não foi possível carregar o status do WhatsApp.</p><Button variant="outline" size="sm" onClick={() => void organizationsQuery.refetch()}>Tentar novamente</Button></div>}
          {!organizationsQuery.isLoading && organizations.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma organização encontrada.</p>}
          <ul className="divide-y">
            {organizations.map((organization) => {
              const configured = organization.numerosVinculados > 0 && organization.comunidadesAtivas > 0;
              const failing = organization.enviosFalhas > 0;
              const runtimeBadge = organization.runtime ? runtimeBadges[organization.runtime.state] : null;
              return (
                <li key={organization.organizationId}>
                  <button type="button" className="flex w-full min-w-0 items-center justify-between gap-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Abrir WhatsApp de ${organization.organizationName}`} onClick={() => navigate(`/app/whatsapp/${organization.organizationId}`)}>
                    <span className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 rounded-lg bg-success/10 p-2 text-success"><Bot className="h-5 w-5" /></span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="break-words text-sm font-semibold">{organization.organizationName}</span>
                          <Badge variant={runtimeBadge?.variant ?? 'outline'}>{runtimeBadge?.label ?? 'Sem leitura'}</Badge>
                          {failing && <Badge variant="destructive">Falha no envio</Badge>}
                          {!configured && !failing && <Badge variant="outline">Configuração pendente</Badge>}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{organization.municipality ?? 'Município não informado'} · {organization.runtime?.sessionsOnline ?? 0}/{organization.runtime?.sessionsTotal ?? organization.numerosVinculados} número(s) online · {organization.comunidadesAtivas} comunidade{organization.comunidadesAtivas === 1 ? '' : 's'}{organization.enviosPendentes > 0 ? ` · ${organization.enviosPendentes} na fila` : ''}</span>
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value, icon: Icon, warning = false }: { label: string; value: number; icon: typeof Smartphone; warning?: boolean }) {
  return <Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><span className={`rounded-lg p-2.5 ${warning ? 'bg-warning-soft text-warning' : 'bg-primary/10 text-primary'}`}><Icon className="h-5 w-5" /></span></CardContent></Card>;
}
