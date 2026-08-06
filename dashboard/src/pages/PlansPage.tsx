import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Boxes,
  CalendarDays,
  Check,
  CircleCheck,
  Edit3,
  Gauge,
  Headphones,
  Loader2,
  LockKeyhole,
  Rocket,
  Save,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { useAuth } from '@/contexts/AuthContext';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { usePlanMutation } from '@/hooks/usePlanMutation';
import { Button } from '@/components/ui/Button';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { cn } from '@/lib/utils';
import type { Json } from '@/types/supabase';

type PlanStatus = 'draft' | 'active' | 'retired';
type ResourceCode = 'users' | 'inspections' | 'invitations' | 'storage_bytes' | 'sessions';
type Priority = 'low' | 'normal' | 'high' | 'critical';

interface CommercialConfig {
  [key: string]: import('@/types/supabase').Json | undefined;
  monthly_price_cents: number | null;
  annual_price_cents: number | null;
  currency: 'BRL';
  trial_days: number;
  grace_days: number;
  overage_policy: 'block' | 'manual_review' | 'allow_and_bill' | 'custom';
  support_tier: 'standard' | 'priority' | 'specialized';
  support_channels: string[];
  support_hours: string;
}

interface FeatureRow {
  code: string;
  name: string;
  category: string;
  description: string | null;
  active: boolean;
}

interface PlanRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  audience: 'individual' | 'organization' | 'compatibility';
  status: PlanStatus;
  current_version: number;
  plan_features: { feature_code: string; enabled: boolean }[];
  plan_limits: { resource_code: ResourceCode; hard_limit: number | null; warning_percent: number }[];
  plan_versions: { version: number; configuration: Json; published_at: string | null }[];
  support_sla_policies: { priority: Priority; response_minutes: number; resolution_minutes: number | null; escalation_minutes: number | null }[];
}

interface LimitDraft {
  enabled: boolean;
  unlimited: boolean;
  hardLimit: string;
  warningPercent: string;
}

interface SlaDraft {
  enabled: boolean;
  responseHours: string;
  resolutionHours: string;
  escalationHours: string;
}

interface PlanDraft {
  name: string;
  description: string;
  status: PlanStatus;
  monthlyPrice: string;
  annualPrice: string;
  trialDays: string;
  graceDays: string;
  overagePolicy: CommercialConfig['overage_policy'];
  supportTier: CommercialConfig['support_tier'];
  supportChannels: string;
  supportHours: string;
  features: Record<string, boolean>;
  limits: Record<ResourceCode, LimitDraft>;
  sla: Record<Priority, SlaDraft>;
}

const RESOURCE_META: { code: ResourceCode; label: string; hint: string }[] = [
  { code: 'users', label: 'Usuários / agentes', hint: 'Quantidade ativa no plano' },
  { code: 'inspections', label: 'Vistorias por período', hint: 'Vistorias sincronizadas no ciclo' },
  { code: 'invitations', label: 'Convites por período', hint: 'Convites municipais emitidos' },
  { code: 'storage_bytes', label: 'Armazenamento (bytes)', hint: 'Fotos e laudos enviados' },
  { code: 'sessions', label: 'Sessões simultâneas', hint: 'Acessos ativos por usuário' },
];

const PRIORITY_META: { code: Priority; label: string }[] = [
  { code: 'low', label: 'Baixa' },
  { code: 'normal', label: 'Normal' },
  { code: 'high', label: 'Alta' },
  { code: 'critical', label: 'Crítica' },
];

const STATUS_LABEL: Record<PlanStatus, string> = { draft: 'Rascunho', active: 'Ativo', retired: 'Retirado' };
const OVERAGE_LABEL: Record<CommercialConfig['overage_policy'], string> = {
  block: 'Bloquear novo consumo',
  manual_review: 'Enviar para análise manual',
  allow_and_bill: 'Permitir e cobrar excedente',
  custom: 'Definido em contrato',
};
const SUPPORT_LABEL: Record<CommercialConfig['support_tier'], string> = {
  standard: 'Padrão',
  priority: 'Prioritário',
  specialized: 'Especializado',
};

const DEFAULT_COMMERCIAL: CommercialConfig = {
  monthly_price_cents: null,
  annual_price_cents: null,
  currency: 'BRL',
  trial_days: 0,
  grace_days: 0,
  overage_policy: 'block',
  support_tier: 'standard',
  support_channels: ['E-mail'],
  support_hours: 'Dias úteis, horário comercial',
};

export function PlansPage({ demo = false }: { demo?: boolean }) {
  const { can } = useAuth();
  const canWrite = can('commercial.write');
  const [plans, setPlans] = useState<PlanRow[]>(demo ? createDemoPlans() : []);
  const [features, setFeatures] = useState<FeatureRow[]>(demo ? DEMO_FEATURES : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<{ plan: PlanRow; draft: PlanDraft } | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<'organization' | 'individual' | 'all'>('organization');
  const planMutation = usePlanMutation();

  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    setError(null);
    const [plansResult, featuresResult] = await Promise.all([
      supabase
        .from('plans')
        .select('id,code,name,description,audience,status,current_version,plan_features(feature_code,enabled),plan_limits(resource_code,hard_limit,warning_percent),plan_versions(version,configuration,published_at),support_sla_policies(priority,response_minutes,resolution_minutes,escalation_minutes)')
        .order('name'),
      supabase.from('features').select('code,name,category,description,active').order('category').order('name'),
    ]);
    const firstError = plansResult.error || featuresResult.error;
    if (firstError) setError(firstError.message);
    else {
      setPlans((plansResult.data || []).map((plan): PlanRow => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        audience: parseAudience(plan.audience),
        status: parsePlanStatus(plan.status),
        current_version: plan.current_version,
        plan_features: plan.plan_features,
        plan_limits: plan.plan_limits.map((limit) => ({ ...limit, resource_code: parseResourceCode(limit.resource_code) })),
        plan_versions: plan.plan_versions,
        support_sla_policies: plan.support_sla_policies.map((policy) => ({ ...policy, priority: parsePriority(policy.priority) })),
      })));
      setFeatures(featuresResult.data || []);
    }
    setLoading(false);
  }, [demo]);

  useEffect(() => {
    load();
  }, [load]);

  const commercialPlans = useMemo(() => plans.filter(plan => plan.audience !== 'compatibility'), [plans]);
  const compatibility = plans.find(plan => plan.audience === 'compatibility');
  const visiblePlans = useMemo(
    () => commercialPlans.filter((plan) => audienceFilter === 'all' || plan.audience === audienceFilter),
    [audienceFilter, commercialPlans],
  );
  const publishedVersions = useMemo(
    () => commercialPlans
      .flatMap((plan) => plan.plan_versions
        .filter((version) => version.published_at)
        .map((version) => ({ plan, version })))
      .sort((a, b) => (b.version.published_at || '').localeCompare(a.version.published_at || ''))
      .slice(0, 4),
    [commercialPlans],
  );
  const draftCount = commercialPlans.filter((plan) => plan.status === 'draft').length;

  const savePlan = async (plan: PlanRow, draft: PlanDraft, reason: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      validateDraft(draft);
      const commercial = commercialPayload(draft);
      const limits = limitsPayload(draft);
      const sla = slaPayload(draft);

      if (demo) {
        setPlans(current => current.map(item => item.id === plan.id
          ? applyDemoSave(item, draft, commercial, limits, sla)
          : item));
        setNotice('Proposta atualizada na demonstração local. Nenhum dado real foi alterado.');
      } else {
        const saved = await planMutation.mutateAsync({ planId: plan.id, plan: { name: draft.name.trim(), description: draft.description.trim() || null, status: draft.status }, commercial, features: draft.features, limits, sla, reason });
        if (!saved.ok) throw new Error(saved.error);
        await load();
        setNotice('Proposta salva e uma nova versão comercial foi criada.');
      }
      setEditing(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a proposta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-stack mx-auto max-w-[1094px]" aria-labelledby="plans-title">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Catálogo comercial</p>
          <h1 id="plans-title" className="mt-1 text-3xl font-black tracking-tight sm:text-[34px]">Planos</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Versões, limites e condições comerciais disponíveis para cada perfil de operação.
          </p>
        </div>
        <div className="inline-flex w-fit rounded-lg border bg-card p-1" role="group" aria-label="Filtrar planos por público">
          {([
            ['organization', 'Municipais'],
            ['individual', 'Individuais'],
            ['all', 'Todos'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={audienceFilter === value}
              className={cn(
                'rounded-md px-3 py-2 text-xs font-bold transition-colors',
                audienceFilter === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary',
              )}
              onClick={() => setAudienceFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {demo && <DemoBadge />}

      <AsyncBoundary
        loading={loading}
        error={error && !editing ? new Error(error) : undefined}
        empty={!loading && !error && commercialPlans.length === 0}
        onRetry={() => void load()}
        loadingLabel="Carregando catálogo comercial…"
        emptyTitle="Nenhum plano comercial"
        emptyDescription="Os planos cadastrados aparecerão aqui."
      >
        <div className="flex flex-col gap-3 rounded-lg bg-info px-5 py-4 text-info-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-info-foreground/15">
              <Rocket className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold">Versionamento comercial ativo</p>
              <p className="mt-0.5 text-xs text-info-foreground/75">
                Toda alteração gera uma nova versão auditável sem sobrescrever o histórico.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full bg-info-foreground/15 px-3 py-1.5 text-[11px] font-bold">
            {draftCount} {draftCount === 1 ? 'rascunho' : 'rascunhos'}
          </span>
        </div>

        {notice && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-success/25 bg-success-soft px-4 py-3 text-sm text-success">
            <Check className="h-4 w-4" aria-hidden="true" /> {notice}
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_252px]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visiblePlans.map((plan, index) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                features={features}
                featured={audienceFilter === 'organization' && index === Math.min(1, visiblePlans.length - 1)}
                onEdit={canWrite ? () => { setError(null); setEditing(plan); } : undefined}
              />
            ))}
          </div>

          <aside className="rounded-lg border bg-card p-5" aria-labelledby="version-history-title">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Publicações</p>
                <h2 id="version-history-title" className="mt-1 font-black">Versões recentes</h2>
              </div>
              <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="mt-5 space-y-4">
              {publishedVersions.map(({ plan, version }) => (
                <div key={`${plan.id}-${version.version}`} className="border-l-2 border-primary/25 pl-3">
                  <p className="text-sm font-bold">{plan.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    v{version.version} · {formatDate(version.published_at)}
                  </p>
                </div>
              ))}
              {publishedVersions.length === 0 && (
                <p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">Ainda não há versões publicadas.</p>
              )}
            </div>
            <div className="mt-6 border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground">Cobertura do catálogo</p>
              <p className="mt-1 text-2xl font-black">{commercialPlans.length}</p>
              <p className="text-xs text-muted-foreground">planos comerciais registrados</p>
            </div>
          </aside>
        </div>

        <section className="rounded-lg border bg-card p-5" aria-labelledby="comparison-title">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Visão rápida</p>
              <h2 id="comparison-title" className="mt-1 font-black">Comparativo comercial</h2>
            </div>
            <span className="text-xs text-muted-foreground">{visiblePlans.length} planos exibidos</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {visiblePlans.slice(0, 3).map((plan) => {
              const commercial = getCommercial(plan);
              return (
                <div key={plan.id} className="rounded-xl bg-secondary p-4">
                  <p className="text-sm font-bold">{plan.name}</p>
                  <p className="mt-2 text-lg font-black text-primary">{formatPrice(commercial.monthly_price_cents)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatLimit(plan, 'users', 'usuários')} · {SUPPORT_LABEL[commercial.support_tier]}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {compatibility && (
          <div className="flex items-center gap-3 rounded-xl border border-dashed bg-secondary/60 p-4 text-sm text-muted-foreground">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            <div><b className="text-foreground">{compatibility.name}</b> é um plano técnico de transição e não pode ser comercializado ou editado aqui.</div>
          </div>
        )}
      </AsyncBoundary>

      {editing && (
        <PlanEditor
          plan={editing}
          featureCatalog={features}
          saving={saving}
          error={error}
          onClose={() => { if (!saving) { setEditing(null); setError(null); } }}
          onSave={draft => setPendingSave({ plan: editing, draft })}
        />
      )}
      {pendingSave && <HighRiskDialog open title="Confirmar nova versão do plano" description="Preço, trial, carência, recursos, limites e SLA serão preservados na auditoria." confirmLabel="Salvar nova versão" onClose={() => setPendingSave(null)} onConfirm={async reason => { await savePlan(pendingSave.plan, pendingSave.draft, reason); setPendingSave(null); }} />}
    </section>
  );
}

function PlanCard({ plan, features, featured, onEdit }: { plan: PlanRow; features: FeatureRow[]; featured?: boolean; onEdit?: () => void }) {
  const commercial = getCommercial(plan);
  const enabledFeatures = plan.plan_features.filter(item => item.enabled);
  const normalSla = plan.support_sla_policies.find(item => item.priority === 'normal');
  return (
    <article className={cn('flex min-h-[378px] flex-col rounded-lg border p-5', featured ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold', featured ? 'bg-primary-foreground/15 text-primary-foreground' : statusClass(plan.status))}>{STATUS_LABEL[plan.status]}</span>
            <span className={cn('text-xs', featured ? 'text-primary-foreground/65' : 'text-muted-foreground')}>v{plan.current_version}</span>
          </div>
          <h2 className="text-lg font-black">{plan.name}</h2>
          <p className={cn('mt-1 line-clamp-3 text-xs leading-5', featured ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{plan.description || 'Sem descrição comercial.'}</p>
        </div>
        {featured && <span className="rounded-full bg-primary-foreground px-2 py-1 text-[9px] font-black uppercase text-primary">Destaque</span>}
      </div>

      <div className="mt-5">
        <p className={cn('text-2xl font-black', featured ? 'text-primary-foreground' : 'text-primary')}>{formatPrice(commercial.monthly_price_cents)}</p>
        <p className={cn('text-[10px] font-semibold uppercase tracking-wide', featured ? 'text-primary-foreground/60' : 'text-muted-foreground')}>por mês</p>
      </div>

      <div className="mt-5 space-y-2.5">
        {[
          formatLimit(plan, 'users', 'usuários'),
          formatLimit(plan, 'inspections', 'vistorias'),
          `${SUPPORT_LABEL[commercial.support_tier]} · ${normalSla ? `${formatHours(normalSla.response_minutes)} resposta` : 'SLA contratual'}`,
          enabledFeatures[0] ? (features.find((item) => item.code === enabledFeatures[0].feature_code)?.name || enabledFeatures[0].feature_code) : 'Recursos por contrato',
        ].map((line) => (
          <div key={line} className={cn('flex items-start gap-2 text-xs', featured ? 'text-primary-foreground/80' : 'text-foreground')}>
            <CircleCheck className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', featured ? 'text-primary-foreground' : 'text-success')} aria-hidden="true" />
            <span>{line}</span>
          </div>
        ))}
      </div>

      <div className={cn('mt-auto border-t pt-4', featured ? 'border-primary-foreground/15' : 'border-border')}>
        {onEdit ? (
          <Button variant={featured ? 'secondary' : 'outline'} className="w-full" onClick={onEdit}>
            <Edit3 className="h-4 w-4" /> Editar versão
          </Button>
        ) : (
          <p className={cn('text-center text-xs', featured ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
            {OVERAGE_LABEL[commercial.overage_policy]}
          </p>
        )}
      </div>
    </article>
  );
}

function PlanEditor({ plan, featureCatalog, saving, error, onClose, onSave }: {
  plan: PlanRow;
  featureCatalog: FeatureRow[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: PlanDraft) => void;
}) {
  const [draft, setDraft] = useState<PlanDraft>(() => createDraft(plan, featureCatalog));
  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => setDraft(current => ({ ...current, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/60 p-3 backdrop-blur-sm sm:p-8">
      <div role="dialog" aria-modal="true" aria-labelledby="plan-editor-title" className="w-full max-w-6xl overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4 sm:px-7">
          <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Editor comercial • versão atual {plan.current_version}</p><h2 id="plan-editor-title" className="text-xl font-bold text-foreground">{plan.name}</h2></div>
          <button onClick={onClose} disabled={saving} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Fechar editor"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-6 p-5 sm:p-7">
          {error && <div className="rounded-lg border border-destructive/25 bg-destructive-soft p-4 text-sm text-destructive">{error}</div>}

          <EditorSection icon={<Edit3 />} title="Identificação da proposta" description="Nome, descrição e disponibilidade comercial.">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <Field label="Nome do plano"><input value={draft.name} onChange={event => set('name', event.target.value)} className={inputClass} /></Field>
              <Field label="Status"><select value={draft.status} onChange={event => set('status', event.target.value as PlanStatus)} className={inputClass}><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="retired">Retirado</option></select></Field>
            </div>
            <Field label="Descrição"><textarea rows={3} value={draft.description} onChange={event => set('description', event.target.value)} className={inputClass} /></Field>
          </EditorSection>

          <EditorSection icon={<BadgeDollarSign />} title="Condições comerciais" description="Preços em reais; deixe em branco para valor personalizado por contrato.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Preço mensal (R$)"><input type="number" min="0" step="0.01" placeholder="Personalizado" value={draft.monthlyPrice} onChange={event => set('monthlyPrice', event.target.value)} className={inputClass} /></Field>
              <Field label="Preço anual (R$)"><input type="number" min="0" step="0.01" placeholder="Personalizado" value={draft.annualPrice} onChange={event => set('annualPrice', event.target.value)} className={inputClass} /></Field>
              <Field label="Teste grátis (dias)"><input type="number" min="0" max="365" value={draft.trialDays} onChange={event => set('trialDays', event.target.value)} className={inputClass} /></Field>
              <Field label="Carência (dias)"><input type="number" min="0" max="365" value={draft.graceDays} onChange={event => set('graceDays', event.target.value)} className={inputClass} /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Ao atingir o limite"><select value={draft.overagePolicy} onChange={event => set('overagePolicy', event.target.value as CommercialConfig['overage_policy'])} className={inputClass}>{Object.entries(OVERAGE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Modalidade de suporte"><select value={draft.supportTier} onChange={event => set('supportTier', event.target.value as CommercialConfig['support_tier'])} className={inputClass}>{Object.entries(SUPPORT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Canais de suporte" hint="Separe por vírgula"><input value={draft.supportChannels} onChange={event => set('supportChannels', event.target.value)} placeholder="E-mail, WhatsApp, telefone" className={inputClass} /></Field>
              <Field label="Horário de atendimento"><input value={draft.supportHours} onChange={event => set('supportHours', event.target.value)} placeholder="Segunda a sexta, 8h às 18h" className={inputClass} /></Field>
            </div>
          </EditorSection>

          <EditorSection icon={<Boxes />} title="Catálogo de recursos" description="ARV significa Vistoria de Árvores.">
            <div className="grid gap-3 md:grid-cols-2">
              {featureCatalog.filter(feature => feature.active).map(feature => {
                const enabled = !!draft.features[feature.code];
                return <label key={feature.code} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${enabled ? 'border-primary/30 bg-info-soft' : 'border-border bg-card hover:border-ring'}`}><input type="checkbox" checked={enabled} onChange={event => set('features', { ...draft.features, [feature.code]: event.target.checked })} className="mt-1 h-4 w-4 accent-primary" /><span><b className="text-sm text-foreground">{feature.name}</b><span className="mt-1 block text-xs text-muted-foreground">{feature.description || feature.code}</span></span></label>;
              })}
            </div>
          </EditorSection>

          <EditorSection icon={<Gauge />} title="Limites e alertas" description="Ative apenas os recursos controlados; sem limite mantém a medição sem bloquear.">
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[760px] text-sm"><thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Recurso</th><th className="p-3">Controlar</th><th className="p-3">Sem limite</th><th className="p-3">Limite</th><th className="p-3">Alerta</th></tr></thead><tbody>{RESOURCE_META.map(resource => {
                const limit = draft.limits[resource.code];
                const update = (patch: Partial<LimitDraft>) => set('limits', { ...draft.limits, [resource.code]: { ...limit, ...patch } });
                return <tr key={resource.code} className="border-t border-border"><td className="p-3"><b className="text-foreground">{resource.label}</b><span className="block text-xs text-muted-foreground">{resource.hint}</span></td><td className="p-3"><input type="checkbox" checked={limit.enabled} onChange={event => update({ enabled: event.target.checked })} className="h-4 w-4 accent-primary" /></td><td className="p-3"><input type="checkbox" disabled={!limit.enabled} checked={limit.unlimited} onChange={event => update({ unlimited: event.target.checked })} className="h-4 w-4 accent-primary disabled:opacity-30" /></td><td className="p-3"><input type="number" min="0" disabled={!limit.enabled || limit.unlimited} value={limit.hardLimit} onChange={event => update({ hardLimit: event.target.value })} className={`${inputClass} w-32 disabled:bg-secondary disabled:text-muted-foreground`} /></td><td className="p-3"><div className="flex items-center gap-1"><input type="number" min="1" max="100" disabled={!limit.enabled} value={limit.warningPercent} onChange={event => update({ warningPercent: event.target.value })} className={`${inputClass} w-24 disabled:bg-secondary`} /><span className="text-muted-foreground">%</span></div></td></tr>;
              })}</tbody></table>
            </div>
          </EditorSection>

          <EditorSection icon={<Headphones />} title="Metas de SLA" description="Horas corridas para primeira resposta, resolução e escalonamento; deixe os campos opcionais vazios.">
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[760px] text-sm"><thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Prioridade</th><th className="p-3">Aplicar</th><th className="p-3">1ª resposta (h)</th><th className="p-3">Resolução (h)</th><th className="p-3">Escalonar após (h)</th></tr></thead><tbody>{PRIORITY_META.map(priority => {
                const sla = draft.sla[priority.code];
                const update = (patch: Partial<SlaDraft>) => set('sla', { ...draft.sla, [priority.code]: { ...sla, ...patch } });
                return <tr key={priority.code} className="border-t border-border"><td className="p-3 font-semibold text-foreground">{priority.label}</td><td className="p-3"><input type="checkbox" checked={sla.enabled} onChange={event => update({ enabled: event.target.checked })} className="h-4 w-4 accent-primary" /></td><td className="p-3"><input type="number" min="0.25" step="0.25" disabled={!sla.enabled} value={sla.responseHours} onChange={event => update({ responseHours: event.target.value })} className={`${inputClass} w-32 disabled:bg-secondary`} /></td><td className="p-3"><input type="number" min="0.25" step="0.25" disabled={!sla.enabled} value={sla.resolutionHours} onChange={event => update({ resolutionHours: event.target.value })} placeholder="Opcional" className={`${inputClass} w-32 disabled:bg-secondary`} /></td><td className="p-3"><input type="number" min="0.25" step="0.25" disabled={!sla.enabled} value={sla.escalationHours} onChange={event => update({ escalationHours: event.target.value })} placeholder="Opcional" className={`${inputClass} w-32 disabled:bg-secondary`} /></td></tr>;
              })}</tbody></table>
            </div>
          </EditorSection>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-4 sm:px-7">
          <p className="text-xs text-muted-foreground">Ao salvar, o sistema cria a versão {plan.current_version + 1} e registra a alteração na auditoria.</p>
          <div className="flex gap-2"><button onClick={onClose} disabled={saving} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary">Cancelar</button><button onClick={() => onSave(draft)} disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Salvando...' : 'Salvar nova versão'}</button></div>
        </footer>
      </div>
    </div>
  );
}

function EditorSection({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-border bg-card p-5"><div className="mb-5 flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-info-soft text-info [&>svg]:h-5 [&>svg]:w-5">{icon}</div><div><h3 className="font-bold text-foreground">{title}</h3><p className="text-xs text-muted-foreground">{description}</p></div></div><div className="space-y-4">{children}</div></section>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-foreground">{label}{hint && <span className="font-normal text-muted-foreground">• {hint}</span>}</span>{children}</label>;
}

function DemoBadge() {
  return <span className="w-fit rounded-full border border-warning/25 bg-warning-soft px-3 py-1.5 text-xs font-bold text-warning">Demonstração local</span>;
}

const inputClass = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-[3px] focus:ring-ring/20';

function getCommercial(plan: PlanRow): CommercialConfig {
  const version = plan.plan_versions.find(item => item.version === plan.current_version) || [...plan.plan_versions].sort((a, b) => b.version - a.version)[0];
  const configuration = jsonObject(version?.configuration);
  const value = jsonObject(configuration?.commercial);
  if (!value) return DEFAULT_COMMERCIAL;
  const overage = jsonString(value.overage_policy);
  const support = jsonString(value.support_tier);
  return {
    monthly_price_cents: jsonNumber(value.monthly_price_cents),
    annual_price_cents: jsonNumber(value.annual_price_cents),
    currency: 'BRL',
    trial_days: jsonNumber(value.trial_days) ?? DEFAULT_COMMERCIAL.trial_days,
    grace_days: jsonNumber(value.grace_days) ?? DEFAULT_COMMERCIAL.grace_days,
    overage_policy: overage === 'manual_review' || overage === 'allow_and_bill' || overage === 'custom' ? overage : 'block',
    support_tier: support === 'priority' || support === 'specialized' ? support : 'standard',
    support_channels: jsonArray(value.support_channels).filter((item): item is string => typeof item === 'string'),
    support_hours: jsonString(value.support_hours) || DEFAULT_COMMERCIAL.support_hours,
  };
}

function parsePlanStatus(value: string): PlanStatus {
  if (value === 'active' || value === 'retired') return value;
  return 'draft';
}

function parseAudience(value: string): PlanRow['audience'] {
  if (value === 'individual' || value === 'organization') return value;
  return 'compatibility';
}

function parseResourceCode(value: string): ResourceCode {
  if (value === 'inspections' || value === 'invitations' || value === 'storage_bytes' || value === 'sessions') return value;
  return 'users';
}

function parsePriority(value: string): Priority {
  if (value === 'low' || value === 'high' || value === 'critical') return value;
  return 'normal';
}

function createDraft(plan: PlanRow, featureCatalog: FeatureRow[]): PlanDraft {
  const commercial = getCommercial(plan);
  const features = Object.fromEntries(featureCatalog.map(feature => [feature.code, plan.plan_features.find(item => item.feature_code === feature.code)?.enabled || false]));
  const limits = Object.fromEntries(RESOURCE_META.map(resource => {
    const current = plan.plan_limits.find(item => item.resource_code === resource.code);
    return [resource.code, { enabled: !!current, unlimited: !!current && current.hard_limit === null, hardLimit: current?.hard_limit?.toString() || '', warningPercent: String(current?.warning_percent || 80) }];
  })) as Record<ResourceCode, LimitDraft>;
  const sla = Object.fromEntries(PRIORITY_META.map(priority => {
    const current = plan.support_sla_policies.find(item => item.priority === priority.code);
    return [priority.code, { enabled: !!current, responseHours: minutesToInput(current?.response_minutes), resolutionHours: minutesToInput(current?.resolution_minutes), escalationHours: minutesToInput(current?.escalation_minutes) }];
  })) as Record<Priority, SlaDraft>;
  return {
    name: plan.name,
    description: plan.description || '',
    status: plan.status,
    monthlyPrice: centsToInput(commercial.monthly_price_cents),
    annualPrice: centsToInput(commercial.annual_price_cents),
    trialDays: String(commercial.trial_days),
    graceDays: String(commercial.grace_days),
    overagePolicy: commercial.overage_policy,
    supportTier: commercial.support_tier,
    supportChannels: commercial.support_channels.join(', '),
    supportHours: commercial.support_hours,
    features,
    limits,
    sla,
  };
}

function validateDraft(draft: PlanDraft) {
  if (!draft.name.trim()) throw new Error('Informe o nome do plano.');
  for (const [label, value] of [['Teste grátis', draft.trialDays], ['Carência', draft.graceDays]] as const) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 365) throw new Error(`${label} deve estar entre 0 e 365 dias.`);
  }
  for (const resource of RESOURCE_META) {
    const limit = draft.limits[resource.code];
    if (!limit.enabled) continue;
    if (!limit.unlimited && (!Number.isInteger(Number(limit.hardLimit)) || Number(limit.hardLimit) < 0)) throw new Error(`Informe um limite válido para ${resource.label}.`);
    if (!Number.isInteger(Number(limit.warningPercent)) || Number(limit.warningPercent) < 1 || Number(limit.warningPercent) > 100) throw new Error(`O alerta de ${resource.label} deve estar entre 1% e 100%.`);
  }
  for (const priority of PRIORITY_META) {
    const sla = draft.sla[priority.code];
    if (sla.enabled && (!sla.responseHours || Number(sla.responseHours) <= 0)) throw new Error(`Informe a primeira resposta do SLA ${priority.label}.`);
  }
}

function commercialPayload(draft: PlanDraft): CommercialConfig {
  return {
    monthly_price_cents: moneyToCents(draft.monthlyPrice),
    annual_price_cents: moneyToCents(draft.annualPrice),
    currency: 'BRL',
    trial_days: Number(draft.trialDays),
    grace_days: Number(draft.graceDays),
    overage_policy: draft.overagePolicy,
    support_tier: draft.supportTier,
    support_channels: draft.supportChannels.split(',').map(value => value.trim()).filter(Boolean),
    support_hours: draft.supportHours.trim(),
  };
}

function limitsPayload(draft: PlanDraft) {
  return Object.fromEntries(RESOURCE_META.flatMap(resource => {
    const value = draft.limits[resource.code];
    return value.enabled ? [[resource.code, { hard_limit: value.unlimited ? null : Number(value.hardLimit), warning_percent: Number(value.warningPercent) }]] : [];
  }));
}

function slaPayload(draft: PlanDraft) {
  return Object.fromEntries(PRIORITY_META.flatMap(priority => {
    const value = draft.sla[priority.code];
    return value.enabled ? [[priority.code, { response_minutes: hoursToMinutes(value.responseHours), resolution_minutes: hoursToMinutes(value.resolutionHours), escalation_minutes: hoursToMinutes(value.escalationHours) }]] : [];
  }));
}

function applyDemoSave(plan: PlanRow, draft: PlanDraft, commercial: CommercialConfig, limits: ReturnType<typeof limitsPayload>, sla: ReturnType<typeof slaPayload>): PlanRow {
  const version = plan.current_version + 1;
  return {
    ...plan,
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    status: draft.status,
    current_version: version,
    plan_features: Object.entries(draft.features).map(([feature_code, enabled]) => ({ feature_code, enabled })),
    plan_limits: Object.entries(limits).map(([resource_code, value]) => ({ resource_code: resource_code as ResourceCode, ...(value as { hard_limit: number | null; warning_percent: number }) })),
    plan_versions: [...plan.plan_versions, { version, configuration: { commercial }, published_at: draft.status === 'active' ? new Date().toISOString() : null }],
    support_sla_policies: Object.entries(sla).map(([priority, value]) => ({ priority: priority as Priority, ...(value as { response_minutes: number; resolution_minutes: number | null; escalation_minutes: number | null }) })),
  };
}

function statusClass(status: PlanStatus) {
  if (status === 'active') return 'bg-success-soft text-success';
  if (status === 'retired') return 'bg-secondary text-muted-foreground';
  return 'bg-warning-soft text-warning';
}

function moneyToCents(value: string) { return value.trim() === '' ? null : Math.round(Number(value) * 100); }
function centsToInput(value: number | null | undefined) { return value == null ? '' : (value / 100).toFixed(2); }
function hoursToMinutes(value: string) { return value.trim() === '' ? null : Math.round(Number(value) * 60); }
function minutesToInput(value: number | null | undefined) { return value == null ? '' : String(value / 60); }
function formatPrice(value: number | null) { return value == null ? 'Personalizado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100); }
function formatHours(minutes: number) { return minutes % 1440 === 0 ? `${minutes / 1440} dia(s)` : `${minutes / 60}h`; }
function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'não publicada';
}
function formatLimit(plan: PlanRow, resource: ResourceCode, label: string) {
  const limit = plan.plan_limits.find((item) => item.resource_code === resource);
  if (!limit || limit.hard_limit == null) return `${label} sem limite`;
  return `${new Intl.NumberFormat('pt-BR').format(limit.hard_limit)} ${label}`;
}

const DEMO_FEATURES: FeatureRow[] = [
  { code: 'inspection_standard', name: 'Vistoria padrão', category: 'inspection_model', description: 'Fluxos de vistoria já disponíveis no aplicativo', active: true },
  { code: 'inspection_arv', name: 'Vistoria de Árvores (ARV)', category: 'inspection_model', description: 'Formulário técnico para vistoria de árvores', active: true },
  { code: 'training_mode', name: 'Modo treinamento', category: 'module', description: 'Turmas e vistorias de treinamento', active: true },
  { code: 'reports_basic', name: 'Relatórios básicos', category: 'module', description: 'Laudos e exportações essenciais', active: true },
  { code: 'reports_advanced', name: 'Relatórios avançados', category: 'module', description: 'Relatórios e análises ampliadas', active: true },
  { code: 'reports_institutional', name: 'Relatórios institucionais', category: 'module', description: 'Relatórios personalizados para organizações', active: true },
  { code: 'indicators_essential', name: 'Indicadores essenciais', category: 'module', description: 'Indicadores e mapas essenciais', active: true },
  { code: 'indicators_complete', name: 'Indicadores completos', category: 'module', description: 'Indicadores e mapas completos', active: true },
  { code: 'indicators_custom', name: 'Indicadores personalizados', category: 'module', description: 'Indicadores configurados para a organização', active: true },
  { code: 'municipal_coordination', name: 'Coordenação municipal', category: 'module', description: 'Agentes, convites e sessões da organização', active: true },
];

const DEMO_COMMERCIAL: Record<string, CommercialConfig> = {
  individual_basic: { monthly_price_cents: 7990, annual_price_cents: 79900, currency: 'BRL', trial_days: 14, grace_days: 7, overage_policy: 'block', support_tier: 'standard', support_channels: ['E-mail'], support_hours: 'Dias úteis, 9h às 18h (BRT)' },
  individual_professional: { monthly_price_cents: 14990, annual_price_cents: 149900, currency: 'BRL', trial_days: 14, grace_days: 7, overage_policy: 'block', support_tier: 'priority', support_channels: ['E-mail', 'Portal'], support_hours: 'Dias úteis, 8h às 18h (BRT)' },
  municipal_basic: { monthly_price_cents: 149000, annual_price_cents: 1490000, currency: 'BRL', trial_days: 30, grace_days: 15, overage_policy: 'manual_review', support_tier: 'standard', support_channels: ['E-mail', 'Portal'], support_hours: 'Dias úteis, 8h às 18h (BRT)' },
  municipal_professional: { monthly_price_cents: 399000, annual_price_cents: 3990000, currency: 'BRL', trial_days: 30, grace_days: 15, overage_policy: 'manual_review', support_tier: 'priority', support_channels: ['E-mail', 'Portal', 'WhatsApp'], support_hours: 'Dias úteis, 8h às 18h (BRT), com prioridade' },
  municipal_complete: { monthly_price_cents: 699000, annual_price_cents: 6990000, currency: 'BRL', trial_days: 30, grace_days: 30, overage_policy: 'custom', support_tier: 'specialized', support_channels: ['E-mail', 'Portal', 'WhatsApp', 'Telefone'], support_hours: 'Atendimento estendido e plantão crítico conforme contrato' },
};

const DEMO_DESCRIPTIONS: Record<string, string> = {
  individual_basic: 'Para o profissional autônomo que está iniciando a operação digital.',
  individual_professional: 'Para profissionais com maior volume de vistorias e relatórios avançados.',
  municipal_basic: 'Para prefeituras com equipes de até 10 agentes e operação municipal essencial.',
  municipal_professional: 'Para prefeituras com equipes de até 30 agentes, indicadores completos e suporte prioritário.',
  municipal_complete: 'Plano municipal completo a partir do valor-base, com ARV, treinamento e condições ajustáveis por contrato.',
};

const DEMO_SLA: Record<string, PlanRow['support_sla_policies']> = {
  individual_basic: createSla([[4320, 10080, 2880], [2880, 7200, 1440], [1440, 4320, 720], [720, 2880, 360]]),
  individual_professional: createSla([[2880, 7200, 1440], [1440, 4320, 720], [480, 2880, 240], [240, 1440, 120]]),
  municipal_basic: createSla([[2880, 7200, 1440], [1440, 4320, 720], [480, 2880, 240], [240, 1440, 120]]),
  municipal_professional: createSla([[1440, 4320, 720], [480, 2880, 240], [240, 1440, 120], [120, 720, 60]]),
  municipal_complete: createSla([[480, 2880, 240], [240, 1440, 120], [120, 720, 60], [60, 480, 30]]),
};

function createSla(values: [number, number, number][]): PlanRow['support_sla_policies'] {
  const priorities: Priority[] = ['low', 'normal', 'high', 'critical'];
  return values.map(([response_minutes, resolution_minutes, escalation_minutes], index) => ({ priority: priorities[index], response_minutes, resolution_minutes, escalation_minutes }));
}

function createDemoPlans(): PlanRow[] {
  const data = [
    ['individual-basic', 'individual_basic', 'Individual Básico', 'individual', 30, 1, 10, 1073741824],
    ['individual-pro', 'individual_professional', 'Individual Profissional', 'individual', 150, 1, 50, 5368709120],
    ['municipal-basic', 'municipal_basic', 'Municipal Básico', 'organization', 300, 10, 50, 21474836480],
    ['municipal-pro', 'municipal_professional', 'Municipal Profissional', 'organization', 1000, 30, 200, 107374182400],
    ['municipal-complete', 'municipal_complete', 'Municipal Completo', 'organization', 5000, 100, 1000, 536870912000],
  ] as const;
  const enabled: Record<string, string[]> = {
    individual_basic: ['inspection_standard', 'reports_basic'],
    individual_professional: ['inspection_standard', 'reports_advanced'],
    municipal_basic: ['inspection_standard', 'reports_basic', 'indicators_essential', 'municipal_coordination'],
    municipal_professional: ['inspection_standard', 'reports_advanced', 'indicators_complete', 'municipal_coordination'],
    municipal_complete: DEMO_FEATURES.map(feature => feature.code),
  };
  const plans = data.map(([id, code, name, audience, inspections, users, invitations, storageBytes]): PlanRow => {
    const commercial = DEMO_COMMERCIAL[code];
    return { id, code, name, description: DEMO_DESCRIPTIONS[code], audience, status: 'draft', current_version: 2, plan_features: DEMO_FEATURES.map(feature => ({ feature_code: feature.code, enabled: enabled[code].includes(feature.code) })), plan_limits: [
      { resource_code: 'users', hard_limit: users, warning_percent: 80 },
      { resource_code: 'inspections', hard_limit: inspections, warning_percent: 80 },
      { resource_code: 'invitations', hard_limit: invitations, warning_percent: 80 },
      { resource_code: 'storage_bytes', hard_limit: storageBytes, warning_percent: 80 },
      { resource_code: 'sessions', hard_limit: 1, warning_percent: 100 },
    ], plan_versions: [{ version: 2, configuration: { commercial }, published_at: null }], support_sla_policies: DEMO_SLA[code] };
  });
  plans.push({ id: 'compatibility', code: 'compatibility', name: 'Compatibilidade', description: 'Fluxo legado durante a migração.', audience: 'compatibility', status: 'active', current_version: 1, plan_features: [], plan_limits: [], plan_versions: [], support_sla_policies: [] });
  return plans;
}
