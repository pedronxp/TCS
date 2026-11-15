import { useRef, useState } from 'react';
import { Check, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PUBLIC_PLANS, formatPublicPlanPrice } from '@/config/publicPlans';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { portalSubscriptionPresentation } from '@/lib/portal';
import { supabase } from '@/lib/supabase';
import { TurnstileChallenge, turnstileEnabled } from '@/components/auth/TurnstileChallenge';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function trustedCheckoutUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const candidate = new URL(value, window.location.origin);
    const providerUrl = candidate.hostname === 'www.mercadopago.com.br' && candidate.pathname.startsWith('/checkout/');
    const allowedOrigin = candidate.origin === window.location.origin || providerUrl;
    return candidate.protocol === 'https:' && !candidate.username && !candidate.password && (!candidate.port || candidate.port === '443') && allowedOrigin ? candidate.href : null;
  } catch { return null; }
}

export function validatedCheckoutUrl(value: unknown, expectedAmountCents: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (response.ok !== true || !response.checkout || typeof response.checkout !== 'object' || Array.isArray(response.checkout)) return null;
  const checkout = response.checkout as Record<string, unknown>;
  if (typeof checkout.checkout_id !== 'string' || !uuidPattern.test(checkout.checkout_id) || !['pending', 'awaiting_payment'].includes(String(checkout.status)) || checkout.amount_cents !== expectedAmountCents || checkout.currency !== 'BRL' || typeof checkout.plan_version_id !== 'string' || !uuidPattern.test(checkout.plan_version_id) || checkout.provider_configuration_required !== false) return null;
  return trustedCheckoutUrl(checkout.checkout_url);
}

export function PortalBillingPage() {
  const { access, can } = usePortalAuth();
  const [periodicity, setPeriodicity] = useState<'monthly' | 'annual'>('monthly');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRevision, setCaptchaRevision] = useState(0);
  const operation = useRef<{ key: string; id: string } | null>(null);
  if (!access) return null;
  const audience = access.accountKind === 'organization' ? 'municipal' : 'individual';
  const plans = PUBLIC_PLANS.filter((plan) => plan.audience === audience);
  const currentIndex = plans.findIndex((plan) => normalizePlanCode(plan.id) === normalizePlanCode(access.planName));
  const inspectionsUsed = access.usage.inspections ?? 0;
  const inspectionsLimit = access.limits.inspections ?? null;
  const inspectionsAvailable = inspectionsLimit === null ? 'Sem limite' : Math.max(inspectionsLimit - inspectionsUsed, 0).toLocaleString('pt-BR');
  const subscription = portalSubscriptionPresentation(access.subscriptionStatus, access.cancelAtPeriodEnd);

  const renewalRequired = ['grace', 'past_due', 'expired', 'canceled'].includes(access.subscriptionStatus);
  const checkoutDisabled = submitting !== null || (turnstileEnabled && !captchaToken);

  async function checkout(planId: string) {
    if (turnstileEnabled && !captchaToken) {
      setMessage('Conclua a verificação de segurança para continuar.');
      return;
    }
    const selectedPlan = plans.find((plan) => plan.id === planId);
    if (!selectedPlan) return;
    const expectedAmountCents = periodicity === 'annual' ? selectedPlan.annualPriceCents : selectedPlan.monthlyPriceCents;
    const operationKey = planId + ':' + periodicity;
    if (!operation.current || operation.current.key !== operationKey) operation.current = { key: operationKey, id: crypto.randomUUID() };
    setSubmitting(planId); setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-checkout', { body: { plan_code: planId.replace(/-/g, '_'), periodicity, idempotency_key: operation.current.id, turnstile_token: captchaToken } });
      const response = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
      const url = !error ? validatedCheckoutUrl(response, expectedAmountCents) : null;
      if (url) { window.location.assign(url); return; }
      const errorResponse = error?.context as Response | undefined;
      const providerError = [403, 503].includes(errorResponse?.status ?? 0)
        ? await errorResponse!.json().catch(() => null)
        : null;
      const errorCode = response?.error ?? providerError?.error;
      if (typeof errorCode === 'string' && errorCode.startsWith('human_verification_')) {
        setMessage('Não foi possível concluir a verificação de segurança. Confirme a verificação e tente novamente.');
        return;
      }
      setMessage(errorCode === 'payment_provider_not_configured'
        ? 'O provedor de pagamento ainda não está configurado. Nenhum pagamento foi confirmado.'
        : 'Não foi possível iniciar o checkout. Tente novamente.');
    } catch { setMessage('Não foi possível iniciar o checkout. Tente novamente.'); }
    finally { setSubmitting(null); setCaptchaToken(null); setCaptchaRevision(value => value + 1); }
  }

  return <div className="page-stack">
    {subscription.preservesRead && !subscription.allowsCreate && (
      <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-foreground" role="status">
        Suas consultas continuam disponíveis. Novas operações de criação estão pausadas enquanto a assinatura não está regularizada.
      </p>
    )}
    <p className="rounded-md border border-border bg-secondary p-3 text-sm text-muted-foreground" role="status">Status confirmado pelo portal: {subscription.label}. Alterações de plano dependem da confirmação do provedor.</p>
    <header><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Conta</p><h1 className="mt-2 text-3xl font-semibold">Assinatura</h1><p className="mt-2 text-sm text-muted-foreground">Seu plano, consumo atual e opções disponíveis para ampliar a capacidade.</p></header>
    <Card><CardHeader className="sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Plano atual</CardTitle><p className="mt-1 text-sm text-muted-foreground">{access.planName ?? 'Nenhum plano contratado'}</p></div><Badge variant={subscription.tone} className={subscription.tone === 'success' ? undefined : 'text-foreground'}>{subscription.label}</Badge></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Info label="Versão contratada" value={access.planVersionId ? access.planVersionId.slice(0, 8) : '—'} /><Info label="Vistorias usadas" value={inspectionsUsed.toLocaleString('pt-BR')} /><Info label="Vistorias disponíveis" value={inspectionsAvailable} /><Info label="Renovação" value={formatDate(access.periodEnd)} /><Info label="Cancelamento ao fim do ciclo" value={access.cancelAtPeriodEnd ? 'Agendado' : 'Não'} /></CardContent></Card>
    {can('billing.manage') && <><fieldset className="flex flex-wrap gap-2"><legend className="sr-only">Periodicidade</legend>{([['monthly', 'Mensal'], ['annual', 'Anual']] as const).map(([value, label]) => <label key={value} className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium ${periodicity === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'}`}><input className="sr-only" type="radio" name="periodicity" value={value} checked={periodicity === value} onChange={() => setPeriodicity(value)} />{label}</label>)}</fieldset>{turnstileEnabled && <TurnstileChallenge key={captchaRevision} action="portal_checkout" onToken={setCaptchaToken} />}{message && <p className="rounded-md border border-warning/30 bg-warning-soft p-4 text-sm text-foreground" role="alert">{message}</p>}<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plans.map((plan, index) => { const current = normalizePlanCode(plan.id) === normalizePlanCode(access.planName); const upgrade = currentIndex >= 0 && index > currentIndex; return <Card key={plan.id} className={current ? 'border-primary' : undefined}><CardContent className="flex h-full flex-col p-6"><CreditCard className="h-6 w-6 text-primary" /><div className="mt-4 flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">{plan.name}</h2>{current && <Badge variant="success">Atual</Badge>}</div><p className="mt-2 text-2xl font-bold">{formatPublicPlanPrice(periodicity === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents)} <span className="text-sm font-medium text-muted-foreground">por {periodicity === 'annual' ? 'ano' : 'mês'}</span></p><ul className="my-5 space-y-2">{plan.limits.map((limit) => <li key={limit} className="flex gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-success" />{limit}</li>)}</ul>{current && !renewalRequired ? <Button className="mt-auto" variant="outline" disabled>Plano em uso</Button> : <Button className="mt-auto" onClick={() => void checkout(plan.id)} disabled={checkoutDisabled || (!current && currentIndex >= 0 && !upgrade)}>{submitting === plan.id ? 'Preparando…' : current ? 'Renovar plano' : upgrade ? `Fazer upgrade para ${plan.name}` : 'Plano indisponível para downgrade'}</Button>}</CardContent></Card>; })}</section></>}
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
