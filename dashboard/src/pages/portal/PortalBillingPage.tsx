import { useState } from 'react';
import { Check, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PUBLIC_PLANS, formatPublicPlanPrice } from '@/config/publicPlans';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { supabase } from '@/lib/supabase';

function trustedCheckoutUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const candidate = new URL(value, window.location.origin);
    if (candidate.protocol !== 'https:' || candidate.origin !== window.location.origin) return null;
    return candidate.href;
  } catch {
    return null;
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validatedCheckoutUrl(value: unknown, expectedAmountCents: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (response.ok !== true || !response.checkout || typeof response.checkout !== 'object' || Array.isArray(response.checkout)) return null;
  const checkout = response.checkout as Record<string, unknown>;
  if (typeof checkout.checkout_id !== 'string' || !uuidPattern.test(checkout.checkout_id)
    || checkout.status !== 'pending'
    || checkout.amount_cents !== expectedAmountCents
    || checkout.currency !== 'BRL'
    || typeof checkout.plan_version_id !== 'string' || !uuidPattern.test(checkout.plan_version_id)
    || checkout.provider_configuration_required !== false) return null;
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

  async function checkout(planId: string) {
    const selectedPlan = plans.find((plan) => plan.id === planId);
    if (!selectedPlan) return;
    const expectedAmountCents = periodicity === 'annual' ? selectedPlan.annualPriceCents : selectedPlan.monthlyPriceCents;
    setSubmitting(planId);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-checkout', {
        body: {
          plan_code: planId.replace(/-/g, '_'),
          periodicity,
          idempotency_key: crypto.randomUUID(),
        },
      });
      const response = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
      const url = !error ? validatedCheckoutUrl(response, expectedAmountCents) : null;
      if (url) {
        window.location.assign(url);
        return;
      }
      setMessage(response?.error === 'payment_provider_not_configured'
        ? 'O contrato de checkout foi criado, mas o provedor de pagamento ainda não está configurado para esta implantação.'
        : !error && response?.ok === true
          ? 'O provedor retornou uma resposta fora do contrato seguro desta implantação. Nenhuma navegação foi realizada.'
          : 'Não foi possível iniciar o checkout. Tente novamente.');
    } catch {
      setMessage('Não foi possível iniciar o checkout. Tente novamente.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="page-stack">
      <p className="rounded-md border border-border bg-secondary p-3 text-sm text-muted-foreground" role="status">Status confirmado pelo portal: {access.subscriptionStatus || 'sem status'}. Qualquer alteração só passa a valer após confirmação do provedor.</p>
      <header><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Conta</p><h1 className="mt-2 text-3xl font-semibold">Assinatura</h1><p className="mt-2 text-sm text-muted-foreground">A ativação ocorre somente após confirmação assinada do provedor.</p></header>
      <Card>
        <CardHeader className="sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Plano atual</CardTitle><p className="mt-1 text-sm text-muted-foreground">{access.planName ?? 'Nenhum plano contratado'}</p></div><Badge variant={access.subscriptionStatus === 'active' ? 'success' : 'warning'} className={access.subscriptionStatus === 'active' ? undefined : 'text-foreground'}>{access.subscriptionStatus}</Badge></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3"><Info label="Versão contratada" value={access.planVersionId ? access.planVersionId.slice(0, 8) : '—'} /><Info label="Consumo de vistorias" value={String(access.usage.inspections ?? 0)} /><Info label="Cancelamento ao fim do ciclo" value={access.cancelAtPeriodEnd ? 'Agendado' : 'Não'} /></CardContent>
      </Card>
      {can('billing.manage') && (
        <>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Periodicidade</legend>
            {([['monthly', 'Mensal'], ['annual', 'Anual']] as const).map(([value, label]) => (
              <label key={value} className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${periodicity === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'}`}>
                <input className="sr-only" type="radio" name="periodicity" value={value} checked={periodicity === value} onChange={() => setPeriodicity(value)} />
                {label}
              </label>
            ))}
          </fieldset>
          {message && <p className="rounded-md border border-warning/30 bg-warning-soft p-4 text-sm text-foreground" role="alert">{message}</p>}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => <Card key={plan.id}><CardContent className="flex h-full flex-col p-6"><CreditCard className="h-6 w-6 text-primary" /><h2 className="mt-4 text-xl font-semibold">{plan.name}</h2><p className="mt-2 text-2xl font-bold">{formatPublicPlanPrice(periodicity === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents)} <span className="text-sm font-medium text-muted-foreground">por {periodicity === 'annual' ? 'ano' : 'mês'}</span></p><ul className="my-5 space-y-2">{plan.limits.map((limit) => <li key={limit} className="flex gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-success" />{limit}</li>)}</ul><Button className="mt-auto" onClick={() => void checkout(plan.id)} disabled={submitting !== null}>{submitting === plan.id ? 'Preparando…' : `Escolher ${plan.name} por ${periodicity === 'annual' ? 'ano' : 'mês'}`}</Button></CardContent></Card>)}
          </section>
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-secondary p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}
