import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { StatusBadge } from '@/components/domain/Badges';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/AsyncState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomers } from '@/hooks/useCustomers';
import { useSubscriptionMutation } from '@/hooks/useSubscriptionMutation';
import { jsonNumber, jsonObject } from '@/lib/json';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
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
  plans: {
    name: string;
    audience: string;
    current_version: number;
    plan_versions: { version: number; configuration: Json }[];
  } | null;
  organizations: { display_name: string } | null;
}

export function SubscriptionsPage() {
  const [editing, setEditing] = useState<SubscriptionRow | 'new' | null>(null);
  const { can } = useAuth();
  const customers = useCustomers('', '', 0, 100);
  const plans = useQuery({
    queryKey: ['commercial-plans-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('id,name,audience,status')
        .neq('audience', 'compatibility')
        .neq('status', 'retired')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
  const query = useQuery({
    queryKey: ['internal-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id,plan_id,organization_id,user_id,status,starts_at,trial_ends_at,current_period_start,current_period_end,grace_ends_at,canceled_at,overrides,created_at,plans(name,audience,current_version,plan_versions(version,configuration)),organizations(display_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SubscriptionRow[];
    },
  });
  const customerMap = useMemo(
    () => new Map(customers.data?.items.map((customer) => [customer.subject_id, customer]) ?? []),
    [customers.data],
  );
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const metrics = useMemo(() => subscriptionMetrics(rows), [rows]);

  function openNewSubscription() {
    setEditing('new');
  }

  return (
    <section className="page-stack max-w-[1094px]">
      <form
        id="subscription-create-form"
        className="hidden"
        onSubmit={(event) => {
          event.preventDefault();
          openNewSubscription();
        }}
      />

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Receita recorrente</p>
        <h1 className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.025em]">Assinaturas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe ativação, renovação, carência e risco financeiro ao longo do ciclo. Toda alteração em um plano, período ou status é registrada com motivo e horário.
        </p>
        {can('commercial.write') && (
          <Button className="mt-4 sm:hidden" onClick={openNewSubscription}>
            <Plus />
            Nova assinatura
          </Button>
        )}
      </div>

      <AsyncBoundary
        loading={query.isLoading || customers.isLoading || plans.isLoading}
        error={query.error || customers.error || plans.error}
        onRetry={() => void query.refetch()}
        empty={Boolean(query.data && !query.data.length)}
        emptyTitle="Nenhuma assinatura"
        emptyDescription="Atribua um plano ao primeiro cliente."
      >
        <CycleFlow metrics={metrics} />

        <div className="grid gap-4 xl:grid-cols-[repeat(3,minmax(0,1fr))_248px]">
          <SubscriptionMetric label="MRR contratado" value={formatCompactCurrency(metrics.mrrCents)} detail={`${metrics.recurring} ciclos`} tone="success" />
          <SubscriptionMetric label="Renovações em 30 dias" value={String(metrics.renewals.length)} detail={formatCompactCurrency(metrics.renewalCents)} tone="success" />
          <SubscriptionMetric label="Base saudável" value={`${metrics.healthyPercent}%`} detail={`${metrics.healthy} sem risco`} tone="success" />
          <div className="hidden xl:block" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,822px)_248px]">
          <Card className="min-w-0 shadow-none">
            <CardHeader><h2 className="text-[17px] font-semibold">Ciclos prioritários</h2></CardHeader>
            <CardContent className="px-0 pb-4">
              <DataTable headers={['Cliente', 'Plano', 'Renovação', 'Valor', 'Status']} minWidth={680}>
                {metrics.priorityRows.map((subscription) => {
                  const customer = customerMap.get(subscription.organization_id || subscription.user_id || '');
                  return (
                    <tr key={subscription.id} className="border-t">
                      <td className="p-3 pl-6">
                        <strong>{subscription.organizations?.display_name || customer?.display_name || subscription.user_id?.slice(0, 8) || '—'}</strong>
                      </td>
                      <td className="p-3 text-muted-foreground">{subscription.plans?.name || '—'}</td>
                      <td className="p-3">{subscription.current_period_end ? formatShortDate(subscription.current_period_end) : '—'}</td>
                      <td className="p-3 font-semibold">{formatCurrency(monthlyPriceCents(subscription))}</td>
                      <td className="p-3 pr-6">
                        <div className="flex items-center gap-2">
                          <StatusBadge value={subscription.status} />
                          {can('commercial.write') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Editar assinatura de ${subscription.organizations?.display_name || customer?.display_name || 'cliente'}`}
                              onClick={() => setEditing(subscription)}
                            >
                              <Pencil />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
              {rows.length > metrics.priorityRows.length && (
                <p className="px-6 pt-4 text-xs font-semibold text-primary">
                  {rows.length - metrics.priorityRows.length} outros ciclos disponíveis na base
                </p>
              )}
            </CardContent>
          </Card>

          <RenewalRadar metrics={metrics} />
        </div>
      </AsyncBoundary>

      <SubscriptionDialog
        open={Boolean(editing)}
        subscription={editing === 'new' ? undefined : editing ?? undefined}
        customers={customers.data?.items ?? []}
        plans={plans.data ?? []}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}

function CycleFlow({ metrics }: { metrics: ReturnType<typeof subscriptionMetrics> }) {
  const stages = [
    ['Teste', metrics.trial, 'bg-muted text-foreground'],
    ['Ativas', metrics.active, 'bg-primary text-primary-foreground'],
    ['Renovação', metrics.renewals.length, 'bg-muted text-foreground'],
    ['Carência', metrics.grace, 'bg-muted text-foreground'],
    ['Em atraso', metrics.pastDue, 'bg-destructive text-destructive-foreground'],
  ] as const;
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fluxo de ciclo</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-5">
        {stages.map(([label, value, tone], index) => (
          <div key={label} className="relative text-center">
            {index < stages.length - 1 && <span className="absolute left-[calc(50%+28px)] top-6 hidden h-px w-[calc(100%-56px)] bg-border sm:block" />}
            <span className={cn('relative z-10 mx-auto grid h-[46px] w-[46px] place-items-center rounded-full text-xs font-bold', tone)}>{value}</span>
            <span className="mt-3 block text-[10px] font-semibold">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-[11px] text-muted-foreground">Contagem real por estágio · nenhuma estimativa inferida</p>
    </section>
  );
}

function SubscriptionMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'success' }) {
  return (
    <Card className="min-h-[112px] shadow-none">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <strong className="text-[24px]">{value}</strong>
          <span className={cn('text-[10px] font-semibold', tone === 'success' && 'text-success')}>{detail}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function RenewalRadar({ metrics }: { metrics: ReturnType<typeof subscriptionMetrics> }) {
  const total = Math.max(1, metrics.renewals.length);
  const buckets = [
    ['Seguro', metrics.safe.length, 'bg-success', 'text-success'],
    ['Acompanhar', metrics.watch.length, 'bg-warning', 'text-warning'],
    ['Em risco', metrics.atRisk.length, 'bg-destructive', 'text-destructive'],
  ] as const;
  return (
    <aside className="rounded-lg border border-border bg-muted p-6">
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Radar de renovação</p>
      <strong className="mt-4 block text-[24px]">{formatCompactCurrency(metrics.renewalCents)}</strong>
      <p className="mt-1 text-[11px] text-muted-foreground">em ciclos nos próximos 30 dias</p>
      <div className="mt-8 space-y-7">
        {buckets.map(([label, value, bar]) => {
          const pct = total ? Math.min(100, Math.round(value * 100 / total)) : 0;
          return (
            <div key={label}>
              <div className="flex justify-between text-[11px] font-semibold">
                <span>{label}</span>
                <span className="text-foreground">{value} · {pct}%</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-card">
                <div className={cn('h-full rounded-full', bar)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-7 text-[11px] text-muted-foreground">Partição sobre {metrics.renewals.length} {metrics.renewals.length === 1 ? 'ciclo próximo' : 'ciclos próximos'} · sem estimativas inferidas</p>
    </aside>
  );
}

function SubscriptionDialog({
  open,
  subscription,
  customers,
  plans,
  onClose,
}: {
  open: boolean;
  subscription?: SubscriptionRow;
  customers: CustomerRecord[];
  plans: { id: string; name: string; audience: string; status: string }[];
  onClose: () => void;
}) {
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
  const selectedPlan = plans.find((plan) => plan.id === planId);
  const calculatedMrr = useMemo(() => {
    if (!subscription) return null;
    return monthlyPriceCents(subscription);
  }, [subscription]);

  useEffect(() => {
    if (!compatiblePlans.some((plan) => plan.id === planId)) setPlanId(compatiblePlans[0]?.id || '');
  }, [compatiblePlans, planId]);

  const daysToRenewal = useMemo(() => {
    if (!periodEnd) return null;
    return daysUntil(periodEnd);
  }, [periodEnd]);

  const riskLevel = useMemo(() => {
    if (!daysToRenewal || daysToRenewal < 0) return null;
    if (['grace', 'past_due', 'suspended'].includes(status)) return 'high';
    if (daysToRenewal <= 7) return 'high';
    if (daysToRenewal <= 14) return 'medium';
    return 'low';
  }, [daysToRenewal, status]);

  function requestSave() {
    if (!customerId || !planId) {
      setError('Selecione cliente e plano.');
      return;
    }
    if (!startsAt || !periodStart) {
      setError('Informe as datas de início.');
      return;
    }
    if (status === 'trial' && !trialEndsAt) {
      setError('Status trial exige data de término do trial.');
      return;
    }
    try {
      const parsed = JSON.parse(overrides);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
    } catch {
      setError('Overrides devem ser um objeto JSON válido.');
      return;
    }
    setError(null);
    setConfirming(true);
  }

  if (!open) return null;

  return (
    <>
      <Dialog open={!confirming} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{subscription ? 'Editar assinatura' : 'Nova assinatura'}</DialogTitle>
            <DialogDescription>
              {subscription ? 'Todas as alterações exigem MFA e justificativa auditável.' : 'Crie uma nova assinatura atribuindo um plano ao cliente.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Cliente e Plano */}
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cliente e Plano</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Cliente" value={customerId} disabled={Boolean(subscription)} onChange={setCustomerId} required>
                  {customers.map((item) => (
                    <option key={item.customer_id} value={item.customer_id}>
                      {item.display_name} · {ptBrLabel(item.kind)}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Plano" value={planId} onChange={setPlanId} required>
                  {compatiblePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                      {plan.status === 'draft' ? ' (rascunho)' : ''}
                    </option>
                  ))}
                </SelectField>
              </div>
              {selectedPlan?.status === 'draft' && (
                <p className="mt-2 text-xs text-foreground">⚠️ Este plano está em rascunho e pode não estar pronto para produção.</p>
              )}
            </section>

            {/* Status e Datas Críticas */}
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Status e Ciclo</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <SelectField label="Status" value={status} onChange={setStatus} required>
                  {statuses.map((item) => (
                    <option key={item} value={item}>
                      {ptBrLabel(item)}
                    </option>
                  ))}
                </SelectField>
                <DateField label="Início da assinatura" value={startsAt} onChange={setStartsAt} required />
                {status === 'trial' && <DateField label="Fim do trial" value={trialEndsAt} onChange={setTrialEndsAt} required />}
              </div>
            </section>

            {/* Período de Cobrança */}
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Período de Cobrança Atual</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField label="Início do período" value={periodStart} onChange={setPeriodStart} required />
                <DateField label="Fim do período" value={periodEnd} onChange={setPeriodEnd} />
              </div>
              {daysToRenewal !== null && daysToRenewal >= 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <span
                    className={cn(
                      'inline-block h-2 w-2 rounded-full',
                      riskLevel === 'high' && 'bg-destructive',
                      riskLevel === 'medium' && 'bg-warning',
                      riskLevel === 'low' && 'bg-success',
                    )}
                  />
                  <span className="text-muted-foreground">
                    Renovação em <strong className="text-foreground">{daysToRenewal} dias</strong>
                    {riskLevel === 'high' && ' — atenção necessária'}
                    {riskLevel === 'medium' && ' — acompanhar de perto'}
                  </span>
                </div>
              )}
            </section>

            {/* Carência e Cancelamento */}
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Carência e Cancelamento</h3>
              <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                <DateField label="Carência até" value={graceEndsAt} onChange={setGraceEndsAt} />
                <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">Ao confirmar o status cancelado, o servidor registra automaticamente a data e preserva o estado anterior na auditoria.</p>
              </div>
            </section>

            {/* MRR e Indicadores */}
            {subscription && (
              <section className="rounded-lg border bg-muted/30 p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Indicadores</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">MRR Calculado</p>
                    <p className="mt-1 text-lg font-semibold">{formatCurrency(calculatedMrr)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Criado em</p>
                    <p className="mt-1 text-sm">{new Date(subscription.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ID da Assinatura</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{subscription.id.slice(0, 8)}</p>
                  </div>
                </div>
              </section>
            )}

            {/* Overrides */}
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Overrides de Recursos e Limites
              </h3>
              <div className="space-y-2">
                <Label htmlFor="subscription-overrides">JSON de configuração personalizada</Label>
                <Textarea
                  id="subscription-overrides"
                  value={overrides}
                  onChange={(event) => setOverrides(event.target.value)}
                  rows={8}
                  placeholder='{\n  "storage_limit_gb": 100,\n  "inspections_limit": 5000\n}'
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Use para sobrescrever limites do plano. Deixe <code>{'{}'}</code> para usar configurações padrão.
                </p>
              </div>
            </section>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-3 py-2.5 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={requestSave} disabled={mutation.isPending}>
              {subscription ? 'Salvar alterações' : 'Criar assinatura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HighRiskDialog
        open={confirming}
        title="Confirmar alteração comercial"
        description="Plano, período, status e overrides serão preservados na auditoria. A alteração fica registrada com motivo e horário, e o estado anterior permanece disponível."
        confirmLabel="Salvar assinatura"
        onClose={() => setConfirming(false)}
        onConfirm={async (reason) => {
          const result = await mutation.mutateAsync({
            customerId,
            subscriptionId: subscription?.id ?? null,
            action: subscription ? 'update' : 'create',
            payload: {
              plan_id: planId,
              status,
              starts_at: isoOrEmpty(startsAt),
              trial_ends_at: isoOrEmpty(trialEndsAt),
              current_period_start: isoOrEmpty(periodStart),
              current_period_end: isoOrEmpty(periodEnd),
              grace_ends_at: isoOrEmpty(graceEndsAt),
              overrides: JSON.parse(overrides),
            },
            reason,
          });
          if (!result.ok) throw new Error(result.error);
          setConfirming(false);
          onClose();
        }}
      />
    </>
  );
}

function DateField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const id = `subscription-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input id={id} type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </div>
  );
}

function SelectField({
  label,
  value,
  disabled,
  onChange,
  required,
  children,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  required?: boolean;
  children: ReactNode;
}) {
  const id = `subscription-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
      >
        {children}
      </select>
    </div>
  );
}

function subscriptionMetrics(rows: SubscriptionRow[]) {
  const now = Date.now();
  const inThirtyDays = now + 30 * 24 * 60 * 60 * 1000;
  const renewals = rows.filter((row) => {
    if (!row.current_period_end || ['canceled', 'expired'].includes(row.status)) return false;
    const end = new Date(row.current_period_end).getTime();
    return end >= now && end <= inThirtyDays;
  });
  const recurring = rows.filter((row) => !['canceled', 'expired'].includes(row.status));
  const healthy = rows.filter((row) => ['trial', 'active'].includes(row.status)).length;
  const safe = renewals.filter((row) => daysUntil(row.current_period_end) > 14 && !['grace', 'past_due', 'suspended'].includes(row.status));
  const watch = renewals.filter((row) => {
    const days = daysUntil(row.current_period_end);
    return days > 7 && days <= 14 && !['grace', 'past_due', 'suspended'].includes(row.status);
  });
  const atRisk = renewals.filter((row) => !safe.includes(row) && !watch.includes(row));
  const priorityRows = [...rows]
    .filter((row) => row.current_period_end)
    .sort((left, right) => new Date(left.current_period_end || 0).getTime() - new Date(right.current_period_end || 0).getTime())
    .slice(0, 4);
  return {
    trial: rows.filter((row) => ['trial', 'trialing'].includes(row.status)).length,
    active: rows.filter((row) => row.status === 'active').length,
    grace: rows.filter((row) => row.status === 'grace').length,
    pastDue: rows.filter((row) => ['past_due', 'suspended'].includes(row.status)).length,
    recurring: recurring.length,
    healthy,
    healthyPercent: rows.length ? Math.round(healthy * 100 / rows.length) : 100,
    renewals,
    safe,
    watch,
    atRisk,
    priorityRows,
    mrrCents: recurring.reduce((total, row) => total + (monthlyPriceCents(row) || 0), 0),
    renewalCents: renewals.reduce((total, row) => total + (monthlyPriceCents(row) || 0), 0),
  };
}

function monthlyPriceCents(subscription: SubscriptionRow) {
  const plan = subscription.plans;
  const version = plan?.plan_versions.find((item) => item.version === plan.current_version)
    || [...(plan?.plan_versions ?? [])].sort((left, right) => right.version - left.version)[0];
  const configuration = jsonObject(version?.configuration);
  const commercial = jsonObject(configuration?.commercial);
  return jsonNumber(commercial?.monthly_price_cents);
}

function daysUntil(value: string | null) {
  return value ? Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : Number.POSITIVE_INFINITY;
}

function formatCompactCurrency(cents: number) {
  if (!cents) return 'R$ 0';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

function formatCurrency(cents: number | null) {
  if (cents === null) return 'Personalizado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(cents / 100);
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function dateInput(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

function isoOrEmpty(value: string) {
  return value ? new Date(value).toISOString() : '';
}
