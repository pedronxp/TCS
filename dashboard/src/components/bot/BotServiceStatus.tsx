import { useCallback, useEffect, useState } from 'react';
import { Bot, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { fetchBotOnline, fetchPortalBotRuntimeStatus, type BotOrganizationRuntime, type BotRuntimeState } from '@/lib/comunicados';

const runtimeCopy: Record<BotRuntimeState, { label: string; detail: string; variant: 'success' | 'warning' | 'destructive' | 'outline' | 'secondary' | 'info' }> = {
  online: { label: 'Online', detail: 'Números conectados e prontos para processar mensagens.', variant: 'success' },
  degraded: { label: 'Operação parcial', detail: 'Existe número online, mas outra sessão precisa de atenção.', variant: 'warning' },
  reconnecting: { label: 'Reconectando', detail: 'O serviço está ativo e tenta restabelecer o WhatsApp.', variant: 'warning' },
  awaiting_qr: { label: 'Aguardando QR', detail: 'Conclua a leitura do QR Code para ativar o número.', variant: 'info' },
  paused: { label: 'Pausado', detail: 'Os números desta organização foram pausados no painel.', variant: 'secondary' },
  offline: { label: 'Fora do ar', detail: 'O Docker responde, mas nenhum número desta organização está conectado.', variant: 'destructive' },
  service_offline: { label: 'Serviço fora do ar', detail: 'O Docker não envia heartbeat; novas mensagens permanecerão na fila.', variant: 'destructive' },
  unconfigured: { label: 'Não configurado', detail: 'A organização ainda não possui um número configurado.', variant: 'outline' },
  banned: { label: 'Número banido', detail: 'Todos os números configurados precisam ser substituídos.', variant: 'destructive' },
};

export function BotServiceStatus({ workspace }: { workspace: 'internal' | 'organization' }) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [runtime, setRuntime] = useState<BotOrganizationRuntime | null>(null);
  const [checking, setChecking] = useState(true);
  const refresh = useCallback(async () => {
    setChecking(true);
    if (workspace === 'organization') {
      try {
        const organizationRuntime = await fetchPortalBotRuntimeStatus();
        setRuntime(organizationRuntime);
        setOnline(organizationRuntime.serviceOnline);
      } catch {
        setRuntime(null);
        setOnline(false);
      }
    } else {
      setOnline(await fetchBotOnline());
    }
    setChecking(false);
  }, [workspace]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const destination = workspace === 'internal' ? '/app/whatsapp' : '/portal/municipal/whatsapp';
  const presentation = runtime ? runtimeCopy[runtime.state] : null;
  const healthy = runtime ? ['online', 'degraded'].includes(runtime.state) : online === true;

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Status do bot WhatsApp">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${healthy ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>
          {healthy ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Bot WhatsApp</p>
            <Badge
              variant={checking ? 'outline' : presentation?.variant ?? (online ? 'success' : 'warning')}
              className="text-foreground"
            >
              {checking ? 'Verificando' : presentation?.label ?? (online ? 'Online' : 'Offline ou iniciando')}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {presentation?.detail ?? (online ? 'Serviço pronto para processar a fila de mensagens.' : 'O painel continua disponível; os disparos aguardam o serviço responder.')}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={checking}>
          <RefreshCw className={checking ? 'animate-spin motion-reduce:animate-none' : ''} /> Atualizar
        </Button>
        <Button asChild variant="outline" size="sm"><Link to={destination}><Bot />Abrir bot</Link></Button>
      </div>
    </section>
  );
}
