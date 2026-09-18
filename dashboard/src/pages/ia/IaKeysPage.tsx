import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/AsyncState';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { iaApi, type AiKeyRow } from '@/lib/ia';
import { useAuth } from '@/contexts/AuthContext';
import { IaNav } from './IaNav';

const PROVIDERS = ['nvidia', 'openai', 'gemini'] as const;

function StatusPill({ status }: { status: AiKeyRow['status'] }) {
  const map = {
    active: 'border-success/30 bg-success-soft text-success',
    cooldown: 'border-warning/30 bg-warning-soft text-warning',
    disabled: 'border-border bg-muted text-muted-foreground',
    error: 'border-destructive/30 bg-destructive/10 text-destructive',
  } as const;
  const label = { active: 'Ativa', cooldown: 'Esfriando', disabled: 'Pausada', error: 'Erro' }[status];
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>{label}</span>;
}

export function IaKeysPage() {
  const { can } = useAuth();
  const mayManage = can('ia.manage');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: 'nvidia', label: '', api_key: '', model: 'z-ai/glm-5.3', priority: 10, monthly_token_limit: '' });

  const keys = useQuery({ queryKey: ['ia', 'keys'], queryFn: iaApi.keysList, refetchInterval: 60_000 });

  const save = useMutation({
    mutationFn: () => iaApi.keySave({
      provider: form.provider,
      label: form.label,
      api_key: form.api_key,
      model: form.model,
      use_for: ['text'],
      priority: form.priority,
      monthly_token_limit: form.monthly_token_limit ? Number(form.monthly_token_limit) : null,
    }),
    onSuccess: () => {
      toast.success('Chave salva. O health check validará em instantes.');
      setShowForm(false);
      setForm({ provider: 'nvidia', label: '', api_key: '', model: 'z-ai/glm-5.3', priority: 10, monthly_token_limit: '' });
      void queryClient.invalidateQueries({ queryKey: ['ia'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'disabled' }) => iaApi.keySetStatus(id, status),
    onSuccess: () => {
      toast.success('Status atualizado.');
      void queryClient.invalidateQueries({ queryKey: ['ia', 'keys'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (keys.isLoading) return <LoadingState label="Carregando chaves" />;
  if (keys.isError || !keys.data) return <ErrorState error="Não foi possível carregar as chaves" onRetry={() => void keys.refetch()} />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chaves de API</h1>
          <p className="text-sm text-muted-foreground">Fallback automático por prioridade (menor número tenta primeiro).</p>
        </div>
        {mayManage && (
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" /> Nova chave
          </Button>
        )}
      </header>

      <IaNav />

      {showForm && mayManage && (
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar chave</CardTitle>
            <CardDescription>A chave é gravada com acesso restrito; depois do cadastro só exibimos os 4 últimos caracteres.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.label.trim() || !form.api_key.trim() || !form.model.trim()) {
                  toast.error('Preencha apelido, chave e modelo.');
                  return;
                }
                save.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="provider">Provedor</Label>
                <div className="flex gap-2" role="radiogroup" aria-label="Provedor de IA">
                  {PROVIDERS.map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={form.provider === p ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, provider: p }))}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="label">Apelido</Label>
                <Input id="label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Conta principal NVIDIA" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="api_key">Chave de API</Label>
                <Input id="api_key" type="password" value={form.api_key} onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))} placeholder="nvapi-..." autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">Modelo padrão</Label>
                <Input id="model" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="z-ai/glm-5.3" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority">Prioridade (menor = primeiro)</Label>
                <Input id="priority" type="number" min={1} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) || 100 }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="limit">Limite mensal de tokens (opcional)</Label>
                <Input id="limit" type="number" min={0} value={form.monthly_token_limit} onChange={(e) => setForm((f) => ({ ...f, monthly_token_limit: e.target.value }))} placeholder="Sem limite" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar chave'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {keys.data.length === 0 ? (
            <EmptyState title="Nenhuma chave cadastrada" description="Cadastre ao menos uma chave NVIDIA para habilitar a IA." />
          ) : (
            <ul className="divide-y divide-border">
              {keys.data.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{k.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {k.provider} · {k.model} · prioridade {k.priority} · {k.key_hint}
                      {k.monthly_token_limit ? ` · limite ${k.monthly_token_limit.toLocaleString('pt-BR')}` : ''}
                    </p>
                    {k.last_error_code && (
                      <p className="text-xs text-destructive">Último erro: {k.last_error_code} {k.last_error_at ? `(${new Date(k.last_error_at).toLocaleString('pt-BR')})` : ''}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={k.status} />
                    {mayManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: k.id, status: k.status === 'disabled' ? 'active' : 'disabled' })}
                      >
                        {k.status === 'disabled' ? 'Reativar' : 'Pausar'}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
