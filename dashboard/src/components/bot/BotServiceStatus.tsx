import { useCallback, useEffect, useState } from 'react';
import { Bot, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { fetchBotOnline } from '@/lib/comunicados';

export function BotServiceStatus({ workspace }: { workspace: 'internal' | 'organization' }) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const refresh = useCallback(async () => {
    setChecking(true);
    setOnline(await fetchBotOnline());
    setChecking(false);
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const destination = workspace === 'internal' ? '/app/whatsapp' : '/portal/municipal/whatsapp';

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Status do bot WhatsApp">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${online ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>
          {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Bot WhatsApp</p>
            <Badge variant={online ? 'success' : checking ? 'outline' : 'warning'}>
              {online ? 'Online' : checking ? 'Verificando' : 'Offline ou iniciando'}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {online ? 'Serviço pronto para processar a fila de mensagens.' : 'O painel continua disponível; os disparos aguardam o serviço responder.'}
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
