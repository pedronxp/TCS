import { useState } from 'react';
import { Check, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PUBLIC_PLANS, formatPublicPlanPrice } from '@/config/publicPlans';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { supabase } from '@/lib/supabase';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function trustedCheckoutUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const candidate = new URL(value, window.location.origin);
    return candidate.protocol === 'https:' && candidate.origin === window.location.origin ? candidate.href : null;
  } catch { return null; }
}

function validatedCheckoutUrl(value: unknown, expectedAmountCents: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (response.ok !== true || !response.checkout || typeof response.checkout !== 'object' || Array.isArray(response.checkout)) return null;
  const checkout = response.checkout as Record<string, unknown>;
  if (typeof checkout.checkout_id !== 'string' || !uuidPattern.test(checkout.checkout_id) || checkout.status !== 'pending' || checkout.amount_cents !== expectedAmountCents || checkout.currency !== 'BRL' || typeof checkout.plan_version_id !== 'string' || !uuidPattern.test(checkout.plan_version_id) || checkout.provider_configuration_required !== false) return null;
  return trustedCheckoutUrl(checkout.checkout_url);
}

export function PortalBillingPage() {
  const { access, can } = usePortalAuth();
  const [periodicity, setPeriodicity] = useState<'monthly' | 'annual'>('monthly');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!access) return null;
  const audience = access.accountKind === 'organization' ? 'municipal' : 'individual';
  const plans = PUBLIC_PLANS.filter((plan) => plan.audience === audience);
  const currentIndex = plans.findIndex((plan) => normalizePlanCode(plan.id) === normalizePlanCode(access.planName));
  const inspectionsUsed = access.usage.inspections ?? 0;
  const inspectionsLimit = access.limits.inspections ?? null;
  const inspectionsAvailable = inspectionsLimit === null ? 'Sem limite' : Math.max(inspectionsLimit - inspectionsUsed, 0).toLocaleString('pt-BR');

  async function checkout(planId: string) {
    const selectedPlan = plans.find((plan) => plan.id === planId);
    if (!selectedPlan) return;
    const expectedAmountCents = periodicity === 'annual' ? selectedPlan.annualPriceCents : selectedPlan.monthlyPriceCents;
    setSubmitting(planId); setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-checkout', { body: { plan_code: planId.replace(/-/g, '_'), periodicity, idempotency_key: crypto.randomUUID() } });
      const response = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
      const url = !error ? validatedCheckoutUrl(response, expectedAmountCents) : null;
      if (url) { window.location.assign(url); return; }
      setMessage(response?.error === 'payment_provider_not_configured' ? 'O checkout foi preparado, mas o provedor de pagamento ainda não está configurado.' : 'Não foi possível iniciar o checkout. Tente novamente.');
    } catch { setMessage('Não foi possível iniciar o checkout. Tente novamente.'); }
    finally { setSubmitting(null); }
  }

  return <div className="page-stack">
    <p className="rounded-md border border-border bg-secondary p-3 text-sm text-muted-foreground" role="status">Status confirmado pelo portal: {access.subscriptionStatus}. Alterações de plano dependem da confirmação do provedor.</p>
    <header><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Conta</p><h1 className="mt-2 text-3xl font-semibold">Assinatura</h1><p className="mt-2 text-sm text-muted-foreground">Seu plano, consumo atual e opções disponíveis para ampliar a capacidade.</p></header>
    <Card><CardHeader className="sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Plano atual</CardTitle><p className="mt-1 text-sm text-muted-foreground">{access.planName ?? 'Nenhum plano contratado'}</p></div><Badge variant={access.subscriptionStatus === 'active' ? 'success' : 'warning'} className={access.subscriptionStatus === 'active' ? undefined : 'text-foreground'}>{access.subscriptionStatus === 'active' ? 'Plano ativo' : access.subscriptionStatus}</Badge></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Info label="Versão contratada" value={access.planVersionId ? access.planVersionId.slice(0, 8) : '—'} /><Info label="Vistorias usadas" value={inspectionsUsed.toLocaleString('pt-BR')} /><Info label="Vistorias disponíveis" value={inspectionsAvailable} /><Info label="Renovação" value={formatDate(access.periodEnd)} /><Info label="Cancelamento ao fim do ciclo" value={access.cancelAtPeriodEnd ? 'Agendado' : 'Não'} /></CardContent></Card>
    {can('billing.manage') && <><fieldset className="flex flex-wrap gap-2"><legend className="sr-only">Periodicidade</legend>{([['monthly', 'Mensal'], ['annual', 'Anual']] as const).map(([value, label]) => <label key={value} className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium ${periodicity === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'}`}><input className="sr-only" type="radio" name="periodicity" value={value} checked={periodicity === value} onChange={() => setPeriodicity(value)} />{label}</label>)}</fieldset>{message && <p className="rounded-md border border-warning/30 bg-warning-soft p-4 text-sm text-foreground" role="alert">{message}</p>}<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plans.map((plan, index) => { const current = normalizePlanCode(plan.id) === normalizePlanCode(access.planName); const upgrade = currentIndex >= 0 && index > currentIndex; return <Card key={plan.id} className={current ? 'border-primary' : undefined}><CardContent className="flex h-full flex-col p-6"><CreditCard className="h-6 w-6 text-primary" /><div className="mt-4 flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">{plan.name}</h2>{current && <Badge variant="success">Atual</Badge>}</div><p className="mt-2 text-2xl font-bold">{formatPublicPlanPrice(periodicity === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents)} <span className="text-sm font-medium text-muted-foreground">por {periodicity === 'annual' ? 'ano' : 'mês'}</span></p><ul className="my-5 space-y-2">{plan.limits.map((limit) => <li key={limit} className="flex gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-success" />{limit}</li>)}</ul>{current ? <Button className="mt-auto" variant="outline" disabled>Plano em uso</Button> : <Button className="mt-auto" onClick={() => void checkout(plan.id)} disabled={submitting !== null || (currentIndex >= 0 && !upgrade)}>{submitting === plan.id ? 'Preparando…' : upgrade ? `Fazer upgrade para ${plan.name}` : 'Plano indisponível para downgrade'}</Button>}</CardContent></Card>; })}</section></>}
  </div>;
}

function normalizePlanCode(value: string | null) {
  const normalized = (value ?? '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  const aliases: Record<string, string> = {
    'individual-basico': 'individual-basic',
    'individual-profissional': 'individual-professional',
    'municipal-basico': 'municipal-basic',
    'municipal-profissional': 'municipal-professional',
    'municipal-completo': 'municipal-complete',
  };
  return aliases[normalized] ?? normalized;
}
function formatDate(value: string | null | undefined) { if (!value) return 'Não informado'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Não informado' : date.toLocaleDateString('pt-BR'); }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-secondary p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
