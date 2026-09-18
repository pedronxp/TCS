import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/AsyncState';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { iaApi, type AiFeatureRow } from '@/lib/ia';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { IaNav } from './IaNav';

const STAGES = [
  { key: 'dev', label: '🧪 Desenvolvimento' },
  { key: 'validation', label: '🔬 Validação' },
  { key: 'ga', label: '🌍 Padrão p/ todos' },
] as const;

const SURFACE_LABEL: Record<string, string> = { app: 'App', whatsapp: 'WhatsApp', painel: 'Painel' };

export function IaRolloutPage() {
  const { can } = useAuth();
  const mayManage = can('ia.manage');
  const queryClient = useQueryClient();
  const [grantTarget, setGrantTarget] = useState<{ feature: string; mode: 'org' | 'user' } | null>(null);
  const [orgId, setOrgId] = useState('');
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const [featureFilter, setFeatureFilter] = useState('');
  const [grantFilter, setGrantFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');

  const features = useQuery({ queryKey: ['ia', 'features'], queryFn: iaApi.featuresList });
  const grants = useQuery({ queryKey: ['ia', 'grants'], queryFn: iaApi.grantsList });
  const orgs = useQuery({
    queryKey: ['ia', 'orgs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('id,display_name').order('display_name');
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['ia', 'features'] });
    void queryClient.invalidateQueries({ queryKey: ['ia', 'grants'] });
  };

  const setStage = useMutation({
    mutationFn: ({ key, stage }: { key: string; stage: AiFeatureRow['stage'] }) => iaApi.featureSetStage(key, stage),
    onSuccess: () => { toast.success('Estágio atualizado.'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const grant = useMutation({
    mutationFn: () => iaApi.grantSet({
      feature_key: grantTarget!.feature,
      organization_id: grantTarget!.mode === 'org' ? orgId : null,
      user_id: grantTarget!.mode === 'user' ? userId : null,
      enabled: true,
      note: note || null,
    }),
    onSuccess: () => {
      toast.success('Liberação registrada.');
      setGrantTarget(null); setOrgId(''); setUserId(''); setNote('');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeGrant = useMutation({
    mutationFn: (id: string) => iaApi.grantRemove(id),
    onSuccess: () => { toast.success('Liberação removida.'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleGrant = useMutation({
    mutationFn: (g: { id: string; feature_key: string; organization_id: string | null; user_id: string | null; enabled: boolean; note: string | null }) =>
      iaApi.grantSet({
        feature_key: g.feature_key,
        organization_id: g.organization_id,
        user_id: g.user_id,
        enabled: !g.enabled,
        note: g.note,
      }),
    onSuccess: () => { toast.success('Checkbox atualizado.'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const visibleFeatures = useMemo(() => {
    const q = featureFilter.trim().toLowerCase();
    return (features.data ?? []).filter((f) =>
      !q || f.name.toLowerCase().includes(q) || f.key.toLowerCase().includes(q));
  }, [features.data, featureFilter]);

  const grantsOf = (featureKey: string) => {
    const q = grantFilter.trim().toLowerCase();
    return (grants.data ?? [])
      .filter((g) => g.feature_key === featureKey)
      .filter((g) => (orgFilter === 'all' ? true : g.organization_id === orgFilter))
      .filter((g) =>
        !q ||
        (g.organization_name ?? '').toLowerCase().includes(q) ||
        (g.user_email ?? '').toLowerCase().includes(q) ||
        (g.user_name ?? '').toLowerCase().includes(q));
  };

  if (features.isLoading) return <LoadingState label="Carregando funcionalidades" />;
  if (features.isError || !features.data) return <ErrorState error="Não foi possível carregar" onRetry={() => void features.refetch()} />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Liberação de IA (rollout)</h1>
        <p className="text-sm text-muted-foreground">
          Cada funcionalidade só aparece para quem você liberar — por organização ou por usuário — até virar padrão para todos.
        </p>
      </header>

      <IaNav />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Filtre funcionalidades e liberações por organização ou usuário.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-feature">Funcionalidade</Label>
            <Input id="f-feature" value={featureFilter} onChange={(e) => setFeatureFilter(e.target.value)} placeholder="buscar por nome..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-grant">Organização ou usuário</Label>
            <Input id="f-grant" value={grantFilter} onChange={(e) => setGrantFilter(e.target.value)} placeholder="nome ou e-mail..." />
          </div>
          <div className="space-y-1.5">
            <Label>Organização específica</Label>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant={orgFilter === 'all' ? 'default' : 'outline'} onClick={() => setOrgFilter('all')}>Todas</Button>
              {(orgs.data ?? []).map((o) => (
                <Button key={o.id} size="sm" variant={orgFilter === o.id ? 'default' : 'outline'} onClick={() => setOrgFilter(o.id)}>
                  {o.display_name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {visibleFeatures.map((f) => (
        <Card key={f.key}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{f.name}</CardTitle>
                <CardDescription>{SURFACE_LABEL[f.surface] ?? f.surface} · {f.description}</CardDescription>
              </div>
              <div className="flex gap-1.5">
                {STAGES.map((s) => (
                  <Button
                    key={s.key}
                    size="sm"
                    variant={f.stage === s.key ? 'default' : 'outline'}
                    disabled={!mayManage || setStage.isPending}
                    onClick={() => setStage.mutate({ key: f.key, stage: s.key })}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{f.grants_active} liberação(ões) ativa(s)</p>
              {mayManage && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setGrantTarget({ feature: f.key, mode: 'org' })}>+ Organização</Button>
                  <Button size="sm" variant="outline" onClick={() => setGrantTarget({ feature: f.key, mode: 'user' })}>+ Usuário</Button>
                </div>
              )}
            </div>

            {grantTarget?.feature === f.key && (
              <form
                className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (grantTarget.mode === 'org' && !orgId) { toast.error('Escolha a organização.'); return; }
                  if (grantTarget.mode === 'user' && !userId.trim()) { toast.error('Informe o ID do usuário.'); return; }
                  grant.mutate();
                }}
              >
                {grantTarget.mode === 'org' ? (
                  <div className="space-y-1.5">
                    <Label>Organização</Label>
                    <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                      {(orgs.data ?? []).map((o) => (
                        <Button key={o.id} type="button" size="sm" variant={orgId === o.id ? 'default' : 'outline'} onClick={() => setOrgId(o.id)}>
                          {o.display_name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="user-id">ID do usuário (UUID)</Label>
                    <Input id="user-id" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="w-80" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="note">Nota (opcional)</Label>
                  <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Piloto org X" />
                </div>
                <Button type="submit" disabled={grant.isPending}>{grant.isPending ? 'Salvando…' : 'Liberar'}</Button>
                <Button type="button" variant="ghost" onClick={() => setGrantTarget(null)}>Cancelar</Button>
              </form>
            )}

            {grantsOf(f.key).length > 0 && (
              <ul className="divide-y divide-border rounded-lg border">
                {grantsOf(f.key).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <label className="flex cursor-pointer items-center gap-3">
                      <Checkbox
                        checked={g.enabled}
                        disabled={!mayManage || toggleGrant.isPending}
                        onCheckedChange={() => toggleGrant.mutate(g)}
                        aria-label={`Liberação de ${f.name} para ${g.organization_name ?? g.user_email}`}
                      />
                      <span className={g.enabled ? '' : 'text-muted-foreground line-through'}>
                        {g.organization_id ? `🏢 ${g.organization_name ?? g.organization_id}` : `👤 ${g.user_email ?? g.user_id}`}
                        {g.note ? <span className="text-muted-foreground"> — {g.note}</span> : null}
                      </span>
                    </label>
                    {mayManage && (
                      <Button size="sm" variant="ghost" onClick={() => removeGrant.mutate(g.id)}>Remover</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      {visibleFeatures.length === 0 && <EmptyState title="Nenhuma funcionalidade encontrada" description="Ajuste os filtros acima." />}
    </div>
  );
}
