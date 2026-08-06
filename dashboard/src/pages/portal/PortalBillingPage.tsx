import { useState } from 'react';
import { Check, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PUBLIC_PLANS, formatPublicPlanPrice } from '@/config/publicPlans';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { supabase } from '@/lib/supabase';

export function PortalBillingPage() {
  const { access, can } = usePortalAuth();
  const [periodicity, setPeriodicity] = useState<'monthly' | 'annual'>('monthly');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!access) return null;
  const audience = access.accountKind === 'organization' ? 'municipal' : 'individual';
  const plans = PUBLIC_PLANS.filter((plan) => plan.audience === audience);

  async function checkout(planId: string) {
    setSubmitting(planId);
    setMessage(null);
    const { data, error } = await supabase.functions.invoke('create-portal-checkout', {
      body: {
        plan_code: planId.replace(/-/g, '_'),
        periodicity,
        idempotency_key: crypto.randomUUID(),
      },
    });
    setSubmitting(null);
    const url = data?.checkout?.checkout_url;
    if (!error && typeof url === 'string') {
      window.location.assign(url);
      return;
    }
    setMessage(data?.error === 'payment_provider_not_configured'
      ? 'O contrato de checkout foi criado, mas o provedor de pagamento ainda não está configurado para esta implantação.'
      : 'Não foi possível iniciar o checkout. Tente novamente.');
  }

  return (
    <div className="page-stack">
      <header><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Conta</p><h1 className="mt-2 text-3xl font-semibold">Assinatura</h1><p className="mt-2 text-sm text-muted-foreground">A ativação ocorre somente após confirmação assinada do provedor.</p></header>
      <Card>
        <CardHeader className="sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Plano atual</CardTitle><p className="mt-1 text-sm text-muted-foreground">{access.planName ?? 'Nenhum plano contratado'}</p></div><Badge variant={access.subscriptionStatus === 'active' ? 'success' : 'warning'}>{access.subscriptionStatus}</Badge></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3"><Info label="Versão contratada" value={access.planVersionId ? access.planVersionId.slice(0, 8) : '—'} /><Info label="Consumo de vistorias" value={String(access.usage.inspections ?? 0)} /><Info label="Cancelamento ao fim do ciclo" value={access.cancelAtPeriodEnd ? 'Agendado' : 'Não'} /></CardContent>
      </Card>
      {can('billing.manage') && (
        <>
          <div className="flex gap-2" role="group" aria-label="Periodicidade"><Button variant={periodicity === 'monthly' ? 'default' : 'outline'} onClick={() => setPeriodicity('monthly')}>Mensal</Button><Button variant={periodicity === 'annual' ? 'default' : 'outline'} onClick={() => setPeriodicity('annual')}>Anual</Button></div>
          {message && <p className="rounded-md border border-warning/30 bg-warning-soft p-4 text-sm text-warning" role="status">{message}</p>}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => <Card key={plan.id}><CardContent className="flex h-full flex-col p-6"><CreditCard className="h-6 w-6 text-primary" /><h2 className="mt-4 text-xl font-semibold">{plan.name}</h2><p className="mt-2 text-2xl font-bold">{formatPublicPlanPrice(periodicity === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents)}</p><ul className="my-5 space-y-2">{plan.limits.map((limit) => <li key={limit} className="flex gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-success" />{limit}</li>)}</ul><Button className="mt-auto" onClick={() => void checkout(plan.id)} disabled={submitting !== null}>{submitting === plan.id ? 'Preparando…' : 'Escolher plano'}</Button></CardContent></Card>)}
          </section>
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-secondary p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}
