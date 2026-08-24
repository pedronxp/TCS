import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { supabase } from '@/lib/supabase';
import {
  getInbox,
  inboxHome,
  markAllInboxMessagesRead,
  markInboxMessageRead,
  resolveInboxRoute,
  type InboxItem,
  type InboxWorkspace,
} from '@/lib/inbox';
import { cn } from '@/lib/utils';

const inboxQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export function InboxBell({ workspace }: { workspace: InboxWorkspace }) {
  return (
    <QueryClientProvider client={inboxQueryClient}>
      <InboxBellContent workspace={workspace} />
    </QueryClientProvider>
  );
}

function InboxBellContent({ workspace }: { workspace: InboxWorkspace }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const queryKey = ['inbox', workspace] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => getInbox(workspace, { limit: 8 }),
    refetchInterval: 30_000,
  });
  const readMutation = useMutation({
    mutationFn: (eventId: string) => markInboxMessageRead(eventId, workspace),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox', workspace] }),
  });
  const readAllMutation = useMutation({
    mutationFn: () => markAllInboxMessagesRead(workspace),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox', workspace] }),
  });

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user || cancelled) return;
      channel = supabase
        .channel(`inbox:${workspace}:${data.user.id}:${crypto.randomUUID()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'inbox_recipients',
          filter: `recipient_user_id=eq.${data.user.id}`,
        }, () => {
          void queryClient.invalidateQueries({ queryKey: ['inbox', workspace] });
        })
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient, workspace]);

  async function openItem(item: InboxItem) {
    if (!item.readAt) await readMutation.mutateAsync(item.id);
    setOpen(false);
    navigate(resolveInboxRoute(item, workspace));
  }

  const unread = query.data?.unreadCount ?? 0;
  return (
    <DropdownMenu open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) void query.refetch();
    }}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-10 w-10 rounded-full" aria-label="Abrir notificações">
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(23rem,calc(100vw-2rem))] overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Caixa de mensagens</DropdownMenuLabel>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void query.refetch()} aria-label="Atualizar mensagens">
              <RefreshCw className={cn('h-3.5 w-3.5', query.isFetching && 'animate-spin motion-reduce:animate-none')} />
            </Button>
            {unread > 0 && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => readAllMutation.mutate()} aria-label="Marcar todas como lidas">
                <CheckCheck className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
          {query.isLoading ? (
            <p className="px-2 py-5 text-sm text-muted-foreground">Carregando mensagens…</p>
          ) : query.isError ? (
            <div className="space-y-2 px-2 py-4">
              <p className="text-sm text-destructive">Não foi possível carregar a caixa.</p>
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button>
            </div>
          ) : query.data?.items.length === 0 ? (
            <p className="px-2 py-5 text-sm text-muted-foreground">Nenhuma mensagem para você.</p>
          ) : query.data?.items.map((item) => (
            <DropdownMenuItem key={item.id} onSelect={() => void openItem(item)} className="items-start gap-3 whitespace-normal py-2.5">
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.readAt ? 'bg-transparent' : severityDot(item.severity))} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="m-2 mt-0">
          <Link to={inboxHome(workspace)} onClick={() => setOpen(false)}>Ver todas as mensagens</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function severityDot(severity: InboxItem['severity']) {
  if (severity === 'critical' || severity === 'error') return 'bg-destructive';
  if (severity === 'warning') return 'bg-warning';
  if (severity === 'success') return 'bg-success';
  return 'bg-primary';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Agora' : new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}
