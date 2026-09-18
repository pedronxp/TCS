import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/AsyncState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { iaApi } from '@/lib/ia';
import { useAuth } from '@/contexts/AuthContext';
import { IaNav } from './IaNav';

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleString('pt-BR') : '—';
}

export function IaLogsPage() {
  const { can } = useAuth();
  const mayManage = can('ia.manage');
  const queryClient = useQueryClient();

  const usage = useQuery({ queryKey: ['ia', 'usage'], queryFn: () => iaApi.usageRecent(50) });
  const sessions = useQuery({ queryKey: ['ia', 'wa-sessions'], queryFn: iaApi.whatsappSessions });
  const cron = useQuery({ queryKey: ['ia', 'cron'], queryFn: iaApi.cronStatus, refetchInterval: 60_000 });

  const revoke = useMutation({
    mutationFn: (id: string) => iaApi.whatsappSessionRevoke(id),
    onSuccess: () => {
      toast.success('Sessão revogada.');
      void queryClient.invalidateQueries({ queryKey: ['ia', 'wa-sessions'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (usage.isLoading || sessions.isLoading) return <LoadingState label="Carregando registros" />;
  if (usage.isError || sessions.isError) return <ErrorState error="Não foi possível carregar" onRetry={() => { void usage.refetch(); void sessions.refetch(); }} />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Uso de IA e sessões do bot</h1>
        <p className="text-sm text-muted-foreground">Trilha de auditoria LGPD: cada chamada de IA e cada sessão autenticada do WhatsApp.</p>
      </header>

      <IaNav />

      <Card>
        <CardHeader>
          <CardTitle>Rotinas automáticas</CardTitle>
          <CardDescription>Agendamentos do sistema (pg_cron) e últimas execuções.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(cron.data?.jobs ?? []).map((j) => (
            <div key={j.jobname} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{j.jobname}</p>
                <p className="text-xs text-muted-foreground">Agenda: {j.schedule} (UTC)</p>
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${j.active ? 'border-success/30 bg-success-soft text-success' : 'border-border bg-muted text-muted-foreground'}`}>
                {j.active ? 'Ativa' : 'Pausada'}
              </span>
            </div>
          ))}
          {(cron.data?.recent_runs ?? []).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Últimas execuções</p>
              <ul className="divide-y divide-border text-sm">
                {cron.data!.recent_runs.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{r.jobname} — {r.status === 'succeeded' ? '✅' : '❌'} {r.return_message === '' ? 'ok' : r.return_message}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(r.start_time)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessões do WhatsApp</CardTitle>
          <CardDescription>Revogar obriga novo login (e-mail + código) no próximo contato.</CardDescription>
        </CardHeader>
        <CardContent>
          {(sessions.data ?? []).length === 0 ? (
            <EmptyState title="Nenhuma sessão registrada" description="As sessões do bot WhatsApp aparecerão aqui após o primeiro atendimento." />
          ) : (
            <ul className="divide-y divide-border">
              {(sessions.data ?? []).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium">{s.phone} <span className="text-muted-foreground">({s.state})</span></p>
                    <p className="text-xs text-muted-foreground">
                      {s.user_name ?? s.user_email ?? 'não identificado'} · {s.organization_name ?? '-'} · último contato {fmtDate(s.last_interaction_at)}
                      {s.consent_lgpd ? ' · LGPD ✓' : ''}
                    </p>
                  </div>
                  {mayManage && (
                    <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(s.id)}>Revogar</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimas chamadas de IA</CardTitle>
          <CardDescription>Inclui sucessos, erros e quando o fallback entrou em ação.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(usage.data ?? []).length === 0 ? (
            <EmptyState title="Nenhuma chamada registrada" description="O histórico de chamadas de IA aparecerá aqui." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usage.data ?? []).map((u, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{fmtDate(u.created_at)}</TableCell>
                    <TableCell>{u.feature ?? '—'}</TableCell>
                    <TableCell className="text-xs">{u.provider}/{u.model}</TableCell>
                    <TableCell>{u.tokens_input + u.tokens_output}</TableCell>
                    <TableCell>
                      {u.success
                        ? (u.fallback_used ? '✅ via fallback' : '✅')
                        : `❌ ${u.error_code ?? 'erro'}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
