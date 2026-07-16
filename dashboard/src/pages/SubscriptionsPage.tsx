import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, X } from 'lucide-react';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui/AsyncState';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomers } from '@/hooks/useCustomers';
import { useSubscriptionMutation } from '@/hooks/useSubscriptionMutation';
import { supabase } from '@/lib/supabase';
import type { CustomerRecord } from '@/types/domain';
import type { Json } from '@/types/supabase';

const statuses = ['trial', 'active', 'grace', 'past_due', 'suspended', 'canceled', 'expired'];

interface SubscriptionRow {
  id: string;
  plan_id: string;
  organization_id: string | null;
  user_id: string | null;
  status: string;
  starts_at: string;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string | null;
  grace_ends_at: string | null;
  canceled_at: string | null;
  overrides: Json;
  created_at: string;
  plans: { name: string; audience: string } | null;
  organizations: { display_name: string } | null;
}

export function SubscriptionsPage() {
  const [editing, setEditing] = useState<SubscriptionRow | 'new' | null>(null);
  const { can } = useAuth();
  const customers = useCustomers('', '', 0, 100);
  const plans = useQuery({
    queryKey: ['commercial-plans-options'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plans').select('id,name,audience,status').neq('audience', 'compatibility').neq('status', 'retired').order('name');
      if (error) throw error;
      return data;
    },
  });
  const query = useQuery({
    queryKey: ['internal-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id,plan_id,organization_id,user_id,status,starts_at,trial_ends_at,current_period_start,current_period_end,grace_ends_at,canceled_at,overrides,created_at,plans(name,audience),organizations(display_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data satisfies SubscriptionRow[];
    },
  });
  const customerMap = useMemo(() => new Map(customers.data?.items.map((customer) => [customer.subject_id, customer]) ?? []), [customers.data]);

  if (query.isLoading || customers.isLoading || plans.isLoading) return <LoadingState label="Carregando assinaturas…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (customers.isError) return <ErrorState error={customers.error} onRetry={() => void customers.refetch()} />;
  if (plans.isError) return <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />;

  return <section><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">Assinaturas</h2><p className="mt-1 text-sm text-slate-500">Plano, período, trial, carência, suspensão, cancelamento e overrides auditados.</p></div>{can('commercial.write') && <button onClick={() => setEditing('new')} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" />Nova assinatura</button>}</div>{!query.data?.length ? <EmptyState title="Nenhuma assinatura" description="Atribua um plano ao primeiro cliente." /> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Cliente</th><th className="p-3">Plano</th><th className="p-3">Período</th><th className="p-3">Carência</th><th className="p-3">Status</th>{can('commercial.write') && <th className="p-3">Ações</th>}</tr></thead><tbody>{query.data.map((subscription) => { const customer = customerMap.get(subscription.organization_id || subscription.user_id || ''); return <tr key={subscription.id} className="border-t"><td className="p-3"><b>{subscription.organizations?.display_name || customer?.display_name || subscription.user_id?.slice(0, 8) || '—'}</b><p className="text-xs text-slate-500">{customer?.kind || 'organization'}</p></td><td className="p-3">{subscription.plans?.name || '—'}</td><td className="p-3">{formatDate(subscription.current_period_start)} — {formatDate(subscription.current_period_end)}</td><td className="p-3">{formatDate(subscription.grace_ends_at)}</td><td className="p-3"><StatusBadge value={subscription.status} /></td>{can('commercial.write') && <td className="p-3"><button onClick={() => setEditing(subscription)} aria-label="Editar assinatura" className="rounded-lg border p-2 text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Pencil className="h-4 w-4" /></button></td>}</tr>; })}</tbody></table></div>}<SubscriptionDialog open={Boolean(editing)} subscription={editing === 'new' ? undefined : editing ?? undefined} customers={customers.data?.items ?? []} plans={plans.data ?? []} onClose={() => setEditing(null)} /></section>;
}

function SubscriptionDialog({ open, subscription, customers, plans, onClose }: { open: boolean; subscription?: SubscriptionRow; customers: CustomerRecord[]; plans: { id: string; name: string; audience: string; status: string }[]; onClose: () => void }) {
  const [customerId, setCustomerId] = useState('');
  const [planId, setPlanId] = useState('');
  const [status, setStatus] = useState('trial');
  const [startsAt, setStartsAt] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [graceEndsAt, setGraceEndsAt] = useState('');
  const [overrides, setOverrides] = useState('{}');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useSubscriptionMutation();

  useEffect(() => {
    if (!open) return;
    const subjectId = subscription?.organization_id || subscription?.user_id;
    const customer = customers.find((item) => item.subject_id === subjectId);
    setCustomerId(customer?.customer_id || customers[0]?.customer_id || '');
    setPlanId(subscription?.plan_id || '');
    setStatus(subscription?.status || 'trial');
    setStartsAt(dateInput(subscription?.starts_at) || dateInput(new Date().toISOString()));
    setTrialEndsAt(dateInput(subscription?.trial_ends_at));
    setPeriodStart(dateInput(subscription?.current_period_start) || dateInput(new Date().toISOString()));
    setPeriodEnd(dateInput(subscription?.current_period_end));
    setGraceEndsAt(dateInput(subscription?.grace_ends_at));
    setOverrides(JSON.stringify(subscription?.overrides ?? {}, null, 2));
    setError(null);
  }, [customers, open, subscription]);
  const customer = customers.find((item) => item.customer_id === customerId);
  const compatiblePlans = plans.filter((plan) => plan.audience === (customer?.kind === 'organization' ? 'organization' : 'individual'));
  useEffect(() => { if (!compatiblePlans.some((plan) => plan.id === planId)) setPlanId(compatiblePlans[0]?.id || ''); }, [compatiblePlans, planId]);
  if (!open) return null;
  function requestSave() {
    if (!customerId || !planId) { setError('Selecione cliente e plano.'); return; }
    try { const parsed = JSON.parse(overrides); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(); }
    catch { setError('Overrides devem ser um objeto JSON válido.'); return; }
    setError(null); setConfirming(true);
  }
  return <><div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div role="dialog" aria-modal="true" aria-labelledby="subscription-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6"><div className="flex justify-between"><div><h2 id="subscription-title" className="text-xl font-bold">{subscription ? 'Editar assinatura' : 'Nova assinatura'}</h2><p className="text-sm text-slate-500">Todas as alterações exigem MFA e justificativa.</p></div><button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2"><X className="h-5 w-5" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Select label="Cliente" value={customerId} disabled={Boolean(subscription)} onChange={setCustomerId}>{customers.map((item) => <option key={item.customer_id} value={item.customer_id}>{item.display_name} · {item.kind}</option>)}</Select><Select label="Plano" value={planId} onChange={setPlanId}>{compatiblePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}{plan.status === 'draft' ? ' · rascunho' : ''}</option>)}</Select><Select label="Status" value={status} onChange={setStatus}>{statuses.map((item) => <option key={item}>{item}</option>)}</Select><Field label="Início" type="datetime-local" value={startsAt} onChange={setStartsAt} /><Field label="Fim do trial" type="datetime-local" value={trialEndsAt} onChange={setTrialEndsAt} /><Field label="Início do período" type="datetime-local" value={periodStart} onChange={setPeriodStart} /><Field label="Fim do período" type="datetime-local" value={periodEnd} onChange={setPeriodEnd} /><Field label="Carência até" type="datetime-local" value={graceEndsAt} onChange={setGraceEndsAt} /><label className="sm:col-span-2 text-sm"><span className="font-semibold">Overrides de recursos e limites (JSON)</span><textarea value={overrides} onChange={(event) => setOverrides(event.target.value)} rows={6} className="mt-1 w-full rounded-lg border p-3 font-mono text-xs" /></label></div>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button onClick={requestSave} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Salvar assinatura</button></div></div></div><HighRiskDialog open={confirming} title="Confirmar alteração comercial" description="Plano, período, status e overrides serão preservados na auditoria." confirmLabel="Salvar assinatura" onClose={() => setConfirming(false)} onConfirm={async (reason) => { const result = await mutation.mutateAsync({ customerId, subscriptionId: subscription?.id ?? null, action: subscription ? 'update' : 'create', payload: { plan_id: planId, status, starts_at: isoOrEmpty(startsAt), trial_ends_at: isoOrEmpty(trialEndsAt), current_period_start: isoOrEmpty(periodStart), current_period_end: isoOrEmpty(periodEnd), grace_ends_at: isoOrEmpty(graceEndsAt), overrides: JSON.parse(overrides) }, reason }); if (!result.ok) throw new Error(result.error); setConfirming(false); onClose(); }} /></>;
}

function Field({ label, value, type, onChange }: { label: string; value: string; type: string; onChange: (value: string) => void }) { return <label className="text-sm"><span className="font-semibold">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3" /></label>; }
function Select({ label, value, disabled, onChange, children }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void; children: React.ReactNode }) { return <label className="text-sm"><span className="font-semibold">{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3 disabled:bg-slate-100">{children}</select></label>; }
function dateInput(value?: string | null) { return value ? new Date(value).toISOString().slice(0, 16) : ''; }
function isoOrEmpty(value: string) { return value ? new Date(value).toISOString() : ''; }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString('pt-BR') : '—'; }
