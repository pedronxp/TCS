import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, CircleAlert, Filter, MessageSquareText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import {
  getInbox,
  markAllInboxMessagesRead,
  markInboxMessageRead,
  resolveInboxRoute,
  type InboxItem,
  type InboxWorkspace,
} from '@/lib/inbox';
import { cn } from '@/lib/utils';

export function InboxPage({ workspace }: { workspace: InboxWorkspace }) {
  const [filter, setFilter] = useState('all');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const queryKey = ['inbox', workspace] as const;
  const query = useQuery({ queryKey, queryFn: () => getInbox(workspace, { limit: 100 }) });
  const markOne = useMutation({
    mutationFn: (eventId: string) => markInboxMessageRead(eventId, workspace),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const markAll = useMutation({
    mutationFn: () => markAllInboxMessagesRead(workspace),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const items = useMemo(() => {
    const source = query.data?.items ?? [];
    if (filter === 'unread') return source.filter((item) => !item.readAt);
    if (filter === 'alerts') return source.filter((item) => ['warning', 'error', 'critical'].includes(item.severity));
    return source;
  }, [filter, query.data?.items]);

  async function openItem(item: InboxItem) {
    if (!item.readAt) await markOne.mutateAsync(item.id);
    navigate(resolveInboxRoute(item, workspace));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Atualizações da operação</p>
          <h1 className="mt-2 text-3xl font-semibold">Caixa de mensagens</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Acompanhe alterações, alertas e ações que afetam seu contexto de trabalho.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44"><Filter className="h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="unread">Não lidas</SelectItem>
              <SelectItem value="alerts">Alertas</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={(query.data?.unreadCount ?? 0) === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck /> Marcar lidas
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary icon={Bell} label="Não lidas" value={query.data?.unreadCount ?? 0} />
        <Summary icon={MessageSquareText} label="Mensagens" value={query.data?.items.length ?? 0} />
        <Summary icon={CircleAlert} label="Alertas" value={(query.data?.items ?? []).filter((item) => ['warning', 'error', 'critical'].includes(item.severity)).length} />
      </div>

      <Card>
        <CardHeader><CardTitle>Atividade recente</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {query.isLoading && <p className="p-6 text-sm text-muted-foreground">Carregando mensagens…</p>}
          {query.isError && <p className="p-6 text-sm text-destructive">Não foi possível carregar sua caixa. Tente novamente.</p>}
          {!query.isLoading && !query.isError && items.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nenhuma mensagem neste filtro.</p>}
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => void openItem(item)} className={cn('flex w-full gap-4 p-5 text-left outline-none hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', !item.readAt && 'bg-primary/[0.035]')}>
              <span className={cn('mt-2 h-2.5 w-2.5 shrink-0 rounded-full', item.readAt ? 'bg-muted' : item.severity === 'critical' || item.severity === 'error' ? 'bg-destructive' : item.severity === 'warning' ? 'bg-warning' : 'bg-primary')} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{item.title}</span>
                  <Badge variant="outline">{moduleLabel(item.moduleKey)}</Badge>
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{item.body}</span>
                <span className="mt-2 block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString('pt-BR')}</span>
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: number }) {
  return <Card><CardContent className="flex items-center gap-4 p-5"><span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><span><span className="block text-2xl font-semibold">{value}</span><span className="text-xs text-muted-foreground">{label}</span></span></CardContent></Card>;
}

function moduleLabel(moduleKey: string) {
  const labels: Record<string, string> = { whatsapp: 'WhatsApp', communication: 'Comunicados', notifications: 'Sistema' };
  return labels[moduleKey] ?? 'Plataforma';
}

