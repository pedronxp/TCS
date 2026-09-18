import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Bot, Coins, RefreshCw, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/AsyncState';
import { iaApi } from '@/lib/ia';
import { useAuth } from '@/contexts/AuthContext';
import { IaNav } from './IaNav';

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  active: { label: 'Ativa', tone: 'text-success' },
  cooldown: { label: 'Esfriando', tone: 'text-warning' },
  disabled: { label: 'Pausada', tone: 'text-muted-foreground' },
  error: { label: 'Erro', tone: 'text-destructive' },
};

export function IaOverviewPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const mayManage = can('ia.manage');

  const overview = useQuery({ queryKey: ['ia', 'overview'], queryFn: iaApi.overview, refetchInterval: 30_000 });
  const keys = useQuery({ queryKey: ['ia', 'keys'], queryFn: iaApi.keysList, refetchInterval: 30_000 });

  const health = useMutation({
    mutationFn: iaApi.healthCheckNow,
    onSuccess: (r) => {
      toast.success(`Teste concluído: ${r.results?.length ?? 0} chave(s) verificadas.`);
      void queryClient.invalidateQueries({ queryKey: ['ia'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (overview.isLoading) return <LoadingState label="Carregando módulo de IA" />;
  if (overview.isError || !overview.data) return <ErrorState error="Não foi possível carregar Verifique sua permissão e tente novamente." onRetry={() => void overview.refetch()} />;

  const data = overview.data;
  const activeKeys = data.keys.find((k) => k.status === 'active')?.total ?? 0;
  const totalKeys = data.keys.reduce((acc, k) => acc + k.total, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">IA & Automação</h1>
          <p className="text-sm text-muted-foreground">Estado das chaves, consumo e operação do agente WhatsApp.</p>
        </div>
        {mayManage && (
          <Button onClick={() => health.mutate()} disabled={health.isPending} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            {health.isPending ? 'Testando…' : 'Testar chaves agora'}
          </Button>
        )}
      </header>

      <IaNav />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Chaves ativas</CardDescription>
            <CardTitle className="text-3xl">{activeKeys}<span className="text-base text-muted-foreground">/{totalKeys}</span></CardTitle>
          </CardHeader>
          <CardContent><Shuffle className="h-5 w-5 text-muted-foreground" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Chamadas hoje</CardDescription>
            <CardTitle className="text-3xl">{data.usage_today.total}</CardTitle>
          </CardHeader>
          <CardContent><Activity className="h-5 w-5 text-muted-foreground" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tokens (30 dias)</CardDescription>
            <CardTitle className="text-3xl">{data.usage_30d.tokens.toLocaleString('pt-BR')}</CardTitle>
          </CardHeader>
          <CardContent><Coins className="h-5 w-5 text-muted-foreground" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sessões WhatsApp ativas</CardDescription>
            <CardTitle className="text-3xl">{data.sessions_active}</CardTitle>
          </CardHeader>
          <CardContent><Bot className="h-5 w-5 text-muted-foreground" /></CardContent>
        </Card>
      </div>

      {data.fallbacks_24h > 0 && (
        <p className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          ⚠️ {data.fallbacks_24h} chamada(s) usaram fallback nas últimas 24h — confira a saúde das chaves.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Status das chaves</CardTitle>
          <CardDescription>Atualizado pelo health check automático (a cada 5 minutos).</CardDescription>
        </CardHeader>
        <CardContent>
          {keys.isLoading && <LoadingState label="Carregando chaves" />}
          {keys.data && keys.data.length === 0 && (
            <EmptyState title="Nenhuma chave cadastrada" description="Cadastre a primeira chave NVIDIA na aba Chaves de API." />
          )}
          <ul className="divide-y divide-border">
            {keys.data?.map((k) => {
              const s = STATUS_LABEL[k.status] ?? STATUS_LABEL.disabled;
              return (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium">{k.label} <span className="text-muted-foreground">({k.provider} · {k.model})</span></p>
                    <p className="text-xs text-muted-foreground">Prioridade {k.priority} · {k.key_hint}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${s.tone}`}>{s.label}</p>
                    <p className="text-xs text-muted-foreground">{k.tokens_used_month.toLocaleString('pt-BR')} tokens no mês</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
